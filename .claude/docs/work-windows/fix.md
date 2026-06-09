# TyFlow Calendar — Full Bug Sweep (sequential, no skipping)

## Context

You are working on **TyFlowVue** (`AndresTaoFlorez/TyFlowVue`), the Vue 3 frontend of
TyFlow, a case/work-window management system. The codebase follows a strict clean
architecture: `domain → application → infrastructure → presentation`. Business rules
live in `domain`, never in `presentation`.

The scope of this task is the calendar module:
`src/presentation/components/calendar/` plus everything it depends on
(`src/presentation/stores/useCalendarStore.js`,
`src/application/use-cases/work-windows/*`,
`src/infrastructure/repositories/WorkWindowRepository.js`,
`src/domain/entities/WorkWindow.js`,
and the shared `src/presentation/components/shared/ContextMenu.vue`).

There are stale duplicate copies under `sketch/tyflow_calendar/` and `sketch/tyflow_cases/`.
**Ignore the `sketch/` folders entirely.** They are dead code. Only the real module under
`src/` is in scope.

### The core disease (read this before touching anything)

The calendar mixes two incompatible notions of time:
- **time-of-day** (a decimal hour like `17.0`, produced by the `startHour`/`endHour`
  getters and by `_timeToMinutes`), and
- **absolute instant** (the real `starts_at` / `ends_at` timestamptz, and the
  epoch-based `_dateTimeToAbsMinutes`).

Multiple batch and validation paths reason in time-of-day and silently drop the date.
This single root cause produces several of the bugs below. When you fix them, the
guiding principle is: **batch and validation logic must operate on the absolute
instant (`startsAt`/`endsAt`) and on deltas measured in milliseconds — never on
`startHour`/`endHour` decimals.** A window's own date must survive every operation.

## Rules of engagement

1. **Do not skip anything.** Work the bugs in the exact numbered order below. Do not
   reorder, batch, or "while I'm here" your way into unrelated changes.
2. **Two phases per bug.** For each bug: (a) confirm the diagnosis against the real code
   and report what you found, then (b) fix it. If the real code contradicts the diagnosis
   written here, STOP and report the discrepancy instead of forcing the fix.
3. **No narrative victories.** A bug is not "done" because you describe a fix. Each bug
   has a required *executable proof* — a test, a grep, a build, or a traced data flow with
   actual output pasted back. If you cannot produce the proof, the bug stays open and you
   say so plainly.
4. **No cosmetic drift.** Do not reformat files, rename things, add comments, or
   "improve" code outside the specific fix. Minimal diffs only.
5. **Respect the architecture.** Business/temporal rules belong in `domain` (the
   `WorkWindow` entity). Presentation consumes them; it does not re-implement them.
6. **English in code, Spanish in user-facing strings** (error `userMessage`, UI labels).
7. **Preserve optimistic update + undo.** Several store actions apply an optimistic
   mutation, call a use-case, then push an undo closure. Any fix must keep all three
   consistent — including the undo path. A fix that corrects the forward operation but
   leaves undo applying the old (broken) logic is incomplete.
8. After every fix, run the build and the test suite. Paste the actual output. A passing
   claim without pasted output does not count.

## Step 0 — Orientation (required before Bug 1)

Read these files end to end and report a one-paragraph summary of each, confirming the
time-of-day vs absolute-instant split actually exists where claimed:

- `src/domain/entities/WorkWindow.js` (note: `startHour`, `endHour`, `startTime`,
  `endTime`, `scheduledDate`, `endDate`, `spansMultipleDays` are all **derived getters**
  off `startsAt`/`endsAt`; `startHour`/`endHour` discard the date)
- `src/presentation/stores/useCalendarStore.js` (focus: `batchResize`,
  `batchReschedule`, `_checkOverlap`, `_checkInheritance`, `_dateTimeToAbsMinutes`,
  `_timeToMinutes`, `_toHM`, `_buildOptimistic`)
- `src/application/use-cases/work-windows/BatchUpdateWorkWindowsUseCase.js`
- `src/presentation/components/calendar/WeekCalendar.vue` (focus: `windowsByDay`
  multi-day proxy block, the resize handlers, the swipe/`_commitPan` block)
- `src/presentation/components/calendar/WindowBlock.vue` (focus: `showTopHandle`,
  `showBottomHandle`, `showSideHandles`, `multiDayPos`)
- `src/presentation/components/calendar/WorkWindowModal.vue`
- `src/presentation/components/shared/ContextMenu.vue`

**Proof for Step 0:** paste the grep output for `startHour`, `endHour`, `_timeToMinutes`,
and `_dateTimeToAbsMinutes` across `src/`, so we can see every site that reasons in
time-of-day.

---

## Bug 1 (CRITICAL — data corruption) — Batch resize/reschedule flattens dates

**Symptom:** Select two grouped work windows on *different* dates, then resize them. Both
end up with the same time range; the per-window date is destroyed.

**Diagnosis to confirm:** In `useCalendarStore.batchResize` (and the analogous
`batchReschedule`), the delta is applied via `_toHM(orig.endHour + deltaHours)` /
`_toHM(orig.startHour + deltaHours)`. `startHour`/`endHour` are time-of-day only, so two
windows ending at 17:00 on different days collapse to the same value. Then
`BatchUpdateWorkWindowsUseCase` rebuilds the timestamp with
`WorkWindow.toTimestampTz(endDate, endTime)` where `endDate = data.targetDate || w.scheduledDate`
— but batch resize never passes `targetDate`, and `scheduledDate` is the *start* day, so
multi-day windows get the wrong end date too.

**Fix direction:** Reimplement the batch math to operate on absolute instants. Compute a
single delta in milliseconds (from `deltaSlots` → minutes → ms, or from the
target/origin instants for reschedule) and apply it to each window's own `startsAt` /
`endsAt` (`new Date(w.startsAt).getTime() + deltaMs`). Each window keeps its own date.
Stop routing batch operations through `startHour`/`endHour` / `_toHM`. Update the undo
closure to use the same absolute-instant math (inverse delta), not the old per-field
restore that assumes a single shared day. Keep the optimistic mutation in sync with the
real payload.

**Executable proof required:**
- A unit/integration test that: builds two `WorkWindow`s with the same time-of-day but
  **different dates**, selects both, applies a batch resize of N slots, and asserts via a
  `_toRaw()` round-trip that each resulting `endsAt` (or `startsAt`) still carries its
  **own original date** and that the two windows did **not** converge.
- A second assertion that undo restores both windows to their exact original
  `starts_at`/`ends_at`.
- Paste the passing test output.

---

## Bug 2 (CRITICAL — data corruption) — False-positive overlap detection

**Symptom:** Overlap validation flags conflicts that aren't real (and misses real ones on
multi-day windows).

**Diagnosis to confirm:** `_checkOverlap` filters by `w.scheduledDate !== date` (start-day
only) and compares with `_timeToMinutes(w.startTime)` (minutes-of-day, 0–1440), while
`_checkInheritance` uses `_dateTimeToAbsMinutes` (epoch-absolute minutes). Two different
time scales in the same store. The day-only scale makes windows on different days look
like they share the 0–1440 range, and multi-day windows whose start day differs from the
checked day are skipped.

**Fix direction:** Make overlap detection use the same absolute-instant scale as
inheritance (`_dateTimeToAbsMinutes` or direct `starts_at`/`ends_at` comparison). Overlap
must compare full instants, not time-of-day, and must correctly include multi-day windows
on every day they cover. Do not introduce a third time scale — converge on one.

**Executable proof required:**
- A test proving the previous false positive no longer fires: two windows, same
  time-of-day, different dates → `_checkOverlap` returns no conflict.
- A test proving a genuine same-instant overlap is still detected.
- A test proving a multi-day window is detected as overlapping on a day other than its
  start day.
- Paste passing output.

---

## Bug 3 (UX) — Cannot resize a multi-day window from the top

**Symptom:** A window that spans two days can't be resized upward. The user is forced into
a side-resize-then-vertical-resize dance.

**Diagnosis to confirm:** In `WeekCalendar.windowsByDay`, multi-day windows are rendered as
per-day proxies; the start handle exists only on the `first` proxy and the end handle only
on the `last` proxy (`WindowBlock.showTopHandle` / `showBottomHandle` gated by
`multiDayPos`). When the window's start day falls **outside** the visible week
(`startIdx === -1`), `first` is forced to `0` but `_isFirstDay` stays `false`, so no
visible proxy exposes the start handle — the start becomes unreachable by drag.

**Fix direction:** Two parts.
1. Make the start/end editable even when the corresponding boundary day is off-screen:
   the edge proxy that is visible should still allow adjusting the real `starts_at` /
   `ends_at`, translating a vertical drag into a change of the full timestamp (date +
   time), not the clamped `startHour`.
2. Ensure the `WorkWindowModal` path is a reliable fallback: selecting a multi-day window
   must let the user edit `startsAt` and `endsAt` with explicit dates (the modal already
   has `editStartDate`/`editEndDate` — verify they are wired and not bypassed for
   multi-day). Drag is a shortcut, not the only way.

**Executable proof required:**
- A test (or a traced computed-output dump) showing that for a multi-day window whose
  start day is off-screen, a visible proxy now exposes a start handle, and that a
  simulated top-resize produces a new `starts_at` with the **correct original start date**
  (not shifted to the visible day).
- Confirm the modal edit path updates `starts_at`/`ends_at` independently for a multi-day
  window. Paste output.

---

## Bug 4 (UX) — Mobile has no usable action menu

**Symptom:** On mobile, the context actions (edit, toggle, copy, cut, delete) aren't
reachable in a usable way.

**Diagnosis to confirm:** `WeekCalendar` emits `context-window` / `context-group` /
`context-cell` with `clientX/clientY`, and `onLongPressStart` fires the menu on touch
long-press. But `ContextMenu.vue` positions itself at the cursor coordinates — on mobile
that lands under the finger and often off-viewport. There is no mobile-specific
presentation.

**Fix direction:** Add a mobile variant of the contextual menu: when `isMobile`, present
the same actions as a bottom-sheet / action-sheet anchored to the bottom of the viewport
(not at the touch point), with comfortably tappable rows. Reuse the existing action set
and emitted events; do not fork the action logic. Keep the desktop cursor-anchored
behavior unchanged. Use CSS design tokens (no hardcoded colors) and BEM, per the frontend
constitution.

**Executable proof required:**
- Build passes. Paste the relevant template/script diff of `ContextMenu.vue` showing the
  `isMobile` branch and the bottom-sheet markup.
- A short manual-verification checklist of which actions render in the mobile sheet for a
  window vs a group vs a cell, confirmed against the emitted-event payloads.

---

## Bug 5 (UX — swipe transition) — Side swipe shows an empty intermediate frame

**Symptom:** On mobile, swiping left/right between day/week/month shows a blank
intermediate state instead of the next view sliding in continuously.

**Diagnosis to confirm:** In `WeekCalendar`, `_commitPan` animates the current content
fully off-screen, *then* emits `next-*`/`prev-*` and waits a tick, *then* slides new
content in from the opposite side. This two-beat "exit → navigate → enter" sequence leaves
a gap where nothing is on screen, made worse because the navigation (and the resulting
`weekDates` watcher recompute of `windowsByDay`/`groupedByDay`) lands inside that gap.

**Fix direction:** Convert to a single continuous transition. Render a three-panel track
(prev / current / next) and translate the whole track in one transition to the
destination panel; only after the transition completes, reorder data so "next" becomes
"current" and reset the track position with transition disabled (the user never sees the
reset because content is identical). No frame should ever show empty space, and no visible
reflow should occur mid-swipe. This is a structural change to the pan/transition block —
do not break the coexisting block-drag, long-press, and resize that share the same touch
handlers (the `panLock` horizontal/vertical gate and the `touchOnBlock` cancellation must
keep working).

**Executable proof required:**
- Build passes.
- A traced description (with the relevant code) showing the destination panel is mounted
  and on-screen *before* the slide animation begins, i.e. there is no `nextTick`/navigate
  step *between* exit and enter.
- Confirm `panLock` gating and `touchOnBlock` drag-cancellation still function (point to
  the preserved logic). Paste the diff of the rewritten pan block.

---

## Bug 6 (architecture cleanup — do last, only if 1–5 are green)

**Symptom / smell:** `WorkWindowModal.vue` re-implements `isFuture`, `isInShift`,
`isEnded`, `isSealed` as local computeds with hand-rolled `new Date(...)` comparisons,
duplicating getters that already exist on the `WorkWindow` entity — and they have already
diverged (the modal's `isInShift` adds `&& isActive`; the entity's does not).

**Fix direction:** Have the modal consume the entity getters (`window.canEdit`,
`window.canToggle`, `window.isInShift`, `window.isEnded`, etc.) instead of recomputing.
If the modal needs a rule the entity lacks, add it to the entity (domain), not the
component. Verify the `WeekCalendar` resize-handle visibility logic also defers to entity
rules rather than ad-hoc date math.

**Executable proof required:**
- Grep showing no remaining hand-rolled temporal date comparisons in
  `WorkWindowModal.vue`.
- A test confirming modal-exposed editability flags match the entity getters for a
  future, an in-shift, and an ended window. Paste output.

---

## Final gate (do not declare the task complete without this)

Paste, in one block:
1. `npm run build` output (must succeed).
2. Full test-suite output (all calendar tests passing).
3. `git diff --stat` of every file changed.
4. A per-bug table: Bug # | confirmed-as-diagnosed? | fixed? | proof artifact.

If any bug could not be fixed or the diagnosis was wrong, say so explicitly in that table.
Do not paper over an open item. A partial, honest result is correct; a "all done" claim
without the pasted build + test output is not acceptable.