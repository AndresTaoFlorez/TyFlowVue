# TyFlowVue — Auditoría profunda y plan de corrección

> Fecha: 2026-06-05. Reemplaza al documento de realineación anterior.
> Fase 1 (diagnóstico) completada. Fase 2 (correcciones) en progreso.

---

## Tabla resumen

| # | Falla | Severidad | Esfuerzo | Backend? | Estado |
|---|-------|-----------|----------|----------|--------|
| **A1** | resizeGroup/rescheduleGroup usan loop individual en vez de batch | Crítica | S | No | **Hecho** |
| **E1** | wsClient.connect() no se llama al recargar con sesión válida | Crítica | S | No | **Hecho** |
| **F1** | No hay sellado de timeline — front permite editar lo que el backend rechaza | Alta | M | Sí | **Hecho** |
| **E2** | No hay indicador visual de desconexión WS | Alta | M | No | **Hecho** |
| **B1** | useCasesStore no hace SWR (siempre full fetch) | Media | S | No | **Hecho** |
| **B2** | useSettingsStore duplica datos de useUserStore (3 fetches redundantes) | Media | M | No | **Hecho** |
| **C1** | ConversationPanel embebido en ApplicationsView (mezcla concerns) | Media | L | Decisión UX | Diferido |
| **E3** | selectedCase queda stale cuando RT remueve caso de lista filtrada | Baja | S | No | **Hecho** |
| **B3** | Workloads se re-fetchean sin cache por applicationId | Baja | S | No | **Hecho** |
| **C2** | FetchAssignmentsByConversationUseCase desalineado con modelo case-centric | Baja | M | Sí | Diferido |
| **F3** | No existe zoom/responsive por espacio disponible | Baja | L | No | Diferido |

---

## Fichas de falla

### A1 — resizeGroup/rescheduleGroup usan loop individual en vez de batch

- **Archivos:** `useCalendarStore.js` (L1035-1078, L1108-1162), `UpdateWorkWindowUseCase.js`, `RescheduleWorkWindowUseCase.js`, `BatchUpdateWorkWindowsUseCase.js`
- **Causa raíz:** `resizeGroup` (L1064) y `rescheduleGroup` (L1141) iteran `for...of` llamando use cases individuales, en vez de `batchUpdateWorkWindowsUseCase`. Las funciones hermanas `batchReschedule` (L748) y `batchResize` (L802) sí usan batch.
- **Evidencia:** L1063-1065 loop individual vs L748 batch.
- **Flujo roto:** Vista → store resizeGroup → optimismo → loop N calls → si falla una → catch revierte TODO → "no hizo nada".
- **Fix:** Reescribir para construir array `items` y llamar `batchUpdateWorkWindowsUseCase(items)`.

### E1 — wsClient.connect() no se llama al recargar con sesión válida

- **Archivos:** `main.js` (L24-32), `useAuthStore.js` (L27)
- **Causa raíz:** `main.js` L30 llama `fetchProfile()` pero nunca `wsClient.connect()`. La conexión WS solo se establece en `login()`.
- **Evidencia:** `grep "wsClient.connect" src/` → solo `useAuthStore.js:27`.
- **Flujo roto:** Recarga → JWT válido → perfil cargado → WS nunca conecta → sin tiempo real.
- **Fix:** Añadir `wsClient.connect()` después de `fetchProfile()` en `main.js`.

### F1 — No hay sellado de timeline ✓

- **Archivos:** `WorkWindow.js`, `useCalendarStore.js`
- **Causa raíz:** No existían getters temporales. El store no guardaba contra editar ventanas en turno activo.
- **Reglas backend** (de `fn_update_work_window.sql`): in-shift (now entre starts_at/ends_at, is_active) → starts_at inmutable; herencia no activable post-inicio.
- **Fix aplicado:**
  1. `WorkWindow.js`: getters `isInShift`, `hasStarted`, `canEditStart`
  2. `useCalendarStore.js`: guards en 7 funciones — `resizeWindow`, `resizeGroup`, `rescheduleWindow`, `rescheduleGroup`, `batchReschedule`, `batchResize` (top), `horizontalExpand` (herencia)
  3. Errores con `userMessage` en español para mostrar al usuario

### E2 — No hay indicador visual de desconexión WS

- **Archivos:** `wsClient.js`
- **Causa raíz:** wsClient no expone estado observable. Backoff silencioso.
- **Fix:** Exponer `status` ref reactivo + componente de banner en MainLayout.

### B1 — useCasesStore no hace SWR

- **Archivos:** `useCasesStore.js` (L62-83)
- **Causa raíz:** `loadCases()` siempre hace full fetch + replaceAll. No usa `syncInBackground()`.
- **Fix:** Si hay cache, mostrar instantáneamente y revalidar en background.

### B2 — useSettingsStore duplica datos de useUserStore

- **Archivos:** `useSettingsStore.js` (L22-51), `useUserStore.js` (L76-103), `SettingsView.vue` (L35-36)
- **Causa raíz:** SettingsView llama `loadSelects()` (4 fetches) + `loadAll()` (3 fetches duplicados).
- **Fix:** settingsStore debe leer roles/levels/categories de userStore.

### E3 — selectedCase queda stale cuando RT remueve caso

- **Archivos:** `useCasesStore.js` (L269-291, L308-323)
- **Causa raíz:** Cuando RT remueve caso de lista filtrada, selectedCase se actualiza pero no se cierra el modal.
- **Fix:** Cerrar modal o avisar cuando selectedCase sale del filtro.

### B3 — Workloads sin cache por applicationId

- **Archivos:** `CaseLoadsView.vue` (L42-51)
- **Causa raíz:** `loadWorkloads(appId)` siempre fetcha, sin cache por app.
- **Fix:** Map cache en store por applicationId.

### C1 — ConversationPanel en ApplicationsView (diferido)

- Requiere decisión de producto sobre dónde vive la visualización de conversaciones.

### C2 — FetchAssignmentsByConversationUseCase (diferido)

- Depende de backend (`GET /assignments?case_id=...`).

### F3 — Zoom/responsive (diferido)

- Feature nueva, no corrección.
