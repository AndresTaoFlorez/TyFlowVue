Tengo todo el contexto claro. Aquí el diagnóstico antes del prompt:

---

**Applications mobile:** El panel de conversations simplemente se oculta con `display:none` en `< 768px` sin alternativa. Outlook mobile lo resuelve con **navegación tipo tab/bottom bar** — el árbol es la vista por defecto y hay un botón/gesto para ir a conversations del folder seleccionado. Actualmente no existe esa transición.

**Calendario mobile:** 7 columnas en 320px = ~40px por columna. Inutilizable. Google Calendar y Teams en mobile cambian a **vista de día** o máximo **3 días** con un scroll horizontal para navegar entre días. El touch actual bloquea el scroll nativo de la página porque `e.preventDefault()` se llama demasiado temprano.

---

Aquí los dos prompts, uno para cada problema:

---

**`D:\Projects\TyFlowVue\.claude\docs\applications\fix_mobile_applications.md`**

```markdown
# Fix Mobile — Vista Applications

## Problema
En viewports < 768px, el panel de Conversations desaparece completamente sin
ninguna forma de accederlo. El usuario queda atrapado solo con el árbol de folders
sin poder ver el contenido del folder seleccionado.

## Comportamiento objetivo (estilo Outlook mobile)

En mobile (< 768px) la vista debe funcionar con navegación entre dos pantallas:

**Pantalla 1 — Árbol (default):**
```
┌─────────────────────────────┐
│  Aplicaciones               │
├─────────────────────────────┤
│  📦 App 1              [⋯] │
│    📁 Nivel Tier 1          │
│      👤 Juan García    [⋯] │
│        📂 Bandeja A    [⋯] │
│        📂 Bandeja B    [⋯] │
│  📦 App 2              [⋯] │
│  📦 App 3              [⋯] │
│                             │
│                             │
│                             │
│ ════════════════════════════│
│  [Árbol]     [Conversaciones]  ← bottom tab bar
└─────────────────────────────┘
```

**Pantalla 2 — Conversations (al tocar tab o al seleccionar folder):**
```
┌─────────────────────────────┐
│  ← Bandeja A                │  ← back button con nombre del folder
├─────────────────────────────┤
│                             │
│  [placeholder / panel de    │
│   conversaciones]           │
│                             │
│                             │
│ ════════════════════════════│
│  [Árbol]     [Conversaciones]  ← bottom tab bar
└─────────────────────────────┘
```

## Implementación

### 1. Leer primero
Lee completos:
- `src/presentation/views/ApplicationsView.vue`
- `src/presentation/components/ConversationPanel.vue`
- `src/styles/tokens.css`

### 2. Estado mobile en ApplicationsView

Ya existe `isMobile` y `mobileShowConversations`. Úsalos correctamente:

```js
// En ApplicationsView.vue — ya deben existir, verificar y completar si faltan
const isMobile = ref(window.innerWidth < 768)
const mobilePanel = ref('tree') // 'tree' | 'conversations'

function onResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) mobilePanel.value = 'tree'
}

// Cuando el usuario selecciona un folder en mobile → ir automáticamente a conversations
function onFolderSelect(node) {
  appStore.selectFolder(node.id)
  if (isMobile.value) mobilePanel.value = 'conversations'
}
```

### 3. Template mobile

En el template de ApplicationsView, envuelve el split en lógica mobile:

```html
<!-- Mobile: mostrar solo el panel activo -->
<template v-if="isMobile">
  <!-- Panel árbol -->
  <div v-show="mobilePanel === 'tree'" class="app-mobile-panel">
    <!-- Contenido del panel izquierdo existente va aquí -->
  </div>

  <!-- Panel conversations -->
  <div v-show="mobilePanel === 'conversations'" class="app-mobile-panel">
    <!-- Back header -->
    <div class="app-mobile-back">
      <button class="app-mobile-back__btn" @click="mobilePanel = 'tree'">
        <i class="bx bx-arrow-back"></i>
      </button>
      <span class="app-mobile-back__title">
        {{ selectedFolderName || 'Conversaciones' }}
      </span>
    </div>
    <!-- Panel de conversations -->
    <ConversationPanel :selected-folder-id="appStore.selectedFolderId" />
  </div>

  <!-- Bottom tab bar -->
  <nav class="app-mobile-tabs">
    <button
      class="app-mobile-tabs__btn"
      :class="{ 'app-mobile-tabs__btn--active': mobilePanel === 'tree' }"
      @click="mobilePanel = 'tree'"
    >
      <i class="bx bx-folder-open"></i>
      <span>Árbol</span>
    </button>
    <button
      class="app-mobile-tabs__btn"
      :class="{ 'app-mobile-tabs__btn--active': mobilePanel === 'conversations' }"
      @click="mobilePanel = 'conversations'"
    >
      <i class="bx bx-envelope"></i>
      <span>Conversaciones</span>
    </button>
  </nav>
</template>

<!-- Desktop: layout split normal -->
<template v-else>
  <!-- layout split existente sin cambios -->
</template>
```

### 4. CSS mobile

Añade al `<style scoped>` de ApplicationsView:

```css
/* ── Mobile panels ── */
.app-mobile-panel {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

/* ── Back header ── */
.app-mobile-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-main);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-mobile-back__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 1.2rem;
  transition: background 0.15s;
}

.app-mobile-back__btn:hover {
  background: var(--bg-card);
}

.app-mobile-back__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Bottom tab bar ── */
.app-mobile-tabs {
  display: flex;
  border-top: 1px solid var(--border-light);
  background: var(--bg-main);
  flex-shrink: 0;
}

.app-mobile-tabs__btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  gap: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-weight: 500;
  transition: color 0.15s;
  min-height: 52px; /* área táctil mínima */
}

.app-mobile-tabs__btn i {
  font-size: 1.25rem;
}

.app-mobile-tabs__btn--active {
  color: var(--primary-500);
}

/* Asegurarse que en mobile la vista principal sea flex column */
@media (max-width: 767px) {
  .app-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
}
```

### 5. Verificación
- [ ] En 375px: al entrar a `/app/applications` se ve el árbol + bottom tab bar.
- [ ] Al tocar una carpeta → cambia automáticamente a panel de conversations.
- [ ] El botón back `←` vuelve al árbol.
- [ ] El tab bar funciona para alternar manualmente en cualquier momento.
- [ ] En desktop (> 768px): comportamiento existente sin ningún cambio.
- [ ] `npm run build` sin errores.
```

---

**`D:\Projects\TyFlowVue\.claude\docs\work-windows\fix_mobile_calendar.md`**

```markdown
# Fix Mobile — Vista Calendario

## Problema
En mobile (< 768px), el calendario muestra 7 columnas en ~320px de ancho.
Cada columna tiene ~40px — los bloques de ventanas son ilegibles y el touch
bloquea el scroll nativo de la página. No existe un modo de vista por día.

## Comportamiento objetivo (estilo Google Calendar / Teams mobile)

En mobile, el calendario cambia a **vista de día** con navegación swipe o flechas:

```
┌─────────────────────────────┐
│ ← Lun 26  Mar 27  Mié 28 → │  ← nav de días (swipeable)
├─────────────────────────────┤
│ 00:00                       │
│ 01:00                       │
│ ...                         │
│ 08:00  ┌────────────────┐   │
│        │ Juan - App 1   │   │
│        │ 08:00 - 10:00  │   │
│        └────────────────┘   │
│ 09:00                       │
│ 10:00                       │
│ ...                         │
└─────────────────────────────┘
```

Solo 1 columna de día visible a la vez. Swipe horizontal o flechas para
cambiar de día. El scroll vertical funciona sin bloqueos.

## Implementación

### 1. Leer primero
Lee completos:
- `src/presentation/components/WeekCalendar.vue`
- `src/presentation/views/CalendarioView.vue`
- `src/styles/tokens.css`

### 2. Prop y estado de vista en WeekCalendar

```js
// WeekCalendar.vue — añadir en <script setup>
const props = defineProps({
  // ... props existentes ...
  // nuevo:
  isMobile: { type: Boolean, default: false }
})

// Día activo en vista mobile (0-6, donde 0 = primer día de la semana)
const activeMobileDay = ref(0)

// Al montar en mobile, posicionar en el día actual
onMounted(() => {
  if (props.isMobile) {
    const todayIdx = props.weekDates.findIndex(d =>
      d.toDateString() === new Date().toDateString()
    )
    activeMobileDay.value = todayIdx >= 0 ? todayIdx : 0
  }
})

// Swipe horizontal
let swipeStartX = 0
let swipeStartY = 0

const onCalSwipeStart = (e) => {
  swipeStartX = e.touches[0].clientX
  swipeStartY = e.touches[0].clientY
}

const onCalSwipeEnd = (e) => {
  const dx = e.changedTouches[0].clientX - swipeStartX
  const dy = e.changedTouches[0].clientY - swipeStartY
  // Solo procesar si el gesto es más horizontal que vertical
  if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 40) return
  if (dx < 0 && activeMobileDay.value < 6) activeMobileDay.value++
  if (dx > 0 && activeMobileDay.value > 0) activeMobileDay.value--
}
```

### 3. Template mobile en WeekCalendar

Reestructura el template con v-if para bifurcar entre desktop y mobile:

```html
<template>
  <div class="cal" @touchstart.passive="props.isMobile && onCalSwipeStart($event)"
                   @touchend.passive="props.isMobile && onCalSwipeEnd($event)">

    <!-- ── MOBILE: vista de 1 día ── -->
    <template v-if="props.isMobile">

      <!-- Nav de días -->
      <div class="cal-mobile-nav">
        <button class="cal-mobile-nav__arrow"
                :disabled="activeMobileDay === 0"
                @click="activeMobileDay--">
          <i class="bx bx-chevron-left"></i>
        </button>

        <div class="cal-mobile-nav__days">
          <button
            v-for="(date, idx) in weekDates"
            :key="idx"
            class="cal-mobile-nav__day"
            :class="{
              'cal-mobile-nav__day--active': idx === activeMobileDay,
              'cal-mobile-nav__day--today': idx === todayIndex
            }"
            @click="activeMobileDay = idx"
          >
            <span class="cal-mobile-nav__label">{{ dayLabels[idx] }}</span>
            <span class="cal-mobile-nav__num">{{ date.getDate() }}</span>
          </button>
        </div>

        <button class="cal-mobile-nav__arrow"
                :disabled="activeMobileDay === 6"
                @click="activeMobileDay++">
          <i class="bx bx-chevron-right"></i>
        </button>
      </div>

      <!-- Grid de 1 día -->
      <div class="cal-scroll">
        <div class="cal-body cal-body--mobile">

          <!-- Gutter de horas -->
          <div class="cal-gutter">
            <div v-for="h in visibleHours" :key="h" class="cal-gutter__slot"
                 :style="{ height: HOUR_H + 'px' }">
              <span class="cal-gutter__label">{{ formatHour(h) }}</span>
            </div>
          </div>

          <!-- Columna del día activo -->
          <div class="cal-col" :class="{ 'cal-col--today': activeMobileDay === todayIndex }">
            <div
              v-for="slot in totalSlots"
              :key="slot"
              class="cal-cell"
              :style="{ height: SLOT_H + 'px' }"
              :data-day="activeMobileDay"
              :data-slot="slot - 1"
              @touchstart="onCellTouchstart(activeMobileDay, slot - 1, $event)"
            ></div>

            <!-- Línea de tiempo actual -->
            <div v-if="activeMobileDay === todayIndex" class="cal-now"
                 :style="{ top: currentTimeTop + 'px' }">
              <span class="cal-now__dot"></span>
              <span class="cal-now__line"></span>
            </div>

            <!-- Bloques del día activo -->
            <template v-for="item in groupedByDay[activeMobileDay]"
                      :key="item.type === 'group' ? item.id : item.window.id">
              <WindowGroupBlock
                v-if="item.type === 'group'"
                :group="item"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="0"
                :total-cols="1"
                :specialists="specialists"
                @click="$emit('group-select', item)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :application-name="appName(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="0"
                :total-cols="1"
                @click="$emit('select', item.window)"
              />
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ── DESKTOP: grid de 7 días (código existente sin cambios) ── -->
    <template v-else>
      <!-- ... template actual tal como está ... -->
    </template>

  </div>
</template>
```

### 4. Pasar `isMobile` desde CalendarioView

En `CalendarioView.vue`:
```js
const isMobile = ref(window.innerWidth < 768)
function onResize() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
```

```html
<WeekCalendar
  :windows="windowsFiltradas"
  :week-dates="weekDates"
  :specialists="userStore.users"
  :applications="userStore.applications"
  :selectable="authStore.isAdmin"
  :is-mobile="isMobile"
  @select="openModal"
  @group-select="openGroupModal"
  @create="openCreateModal"
/>
```

### 5. CSS mobile del calendario

Añade al `<style scoped>` de WeekCalendar:

```css
/* ── Mobile nav de días ── */
.cal-mobile-nav {
  display: flex;
  align-items: center;
  background: #252839;
  border-bottom: 1px solid #3b3f54;
  padding: 0.4rem 0.25rem;
  gap: 0.25rem;
  flex-shrink: 0;
}

.cal-mobile-nav__arrow {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c7293;
  font-size: 1.2rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.cal-mobile-nav__arrow:not(:disabled):hover {
  color: #c8cdd8;
  background: rgba(255,255,255,0.05);
}

.cal-mobile-nav__arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.cal-mobile-nav__days {
  flex: 1;
  display: flex;
  justify-content: space-around;
  gap: 0.15rem;
}

.cal-mobile-nav__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0.1rem;
  border-radius: var(--radius-sm);
  gap: 0.1rem;
  transition: background 0.15s;
}

.cal-mobile-nav__day--active {
  background: rgba(42, 199, 143, 0.12);
}

.cal-mobile-nav__day--today .cal-mobile-nav__num {
  color: var(--primary-500);
  font-weight: 700;
}

.cal-mobile-nav__label {
  font-size: 0.5rem;
  font-weight: 600;
  color: #6c7293;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-mobile-nav__num {
  font-size: 0.9rem;
  font-weight: 600;
  color: #c8cdd8;
  line-height: 1;
}

/* ── Grid mobile (1 columna) ── */
.cal-body--mobile {
  grid-template-columns: 2.5rem 1fr;
}
```

### 6. Corregir el bloqueo de scroll en touch

El problema actual: `e.preventDefault()` en `onTouchmove` bloquea el scroll
de la página completa cuando el usuario no está haciendo drag.

Corrección en `onTouchmove`:

```js
const onTouchmove = (e) => {
  // Si no hay drag activo de ningún tipo, NO bloquear scroll
  if (!dragging.value && !blockDragging.value) return
  // Solo prevenir scroll cuando hay un drag genuino en curso
  e.preventDefault()
  // ... resto del código existente
}
```

Además, en las celdas del grid, cambiar de `@touchstart` a `@touchstart.passive`
excepto cuando se necesite `preventDefault` — que solo es durante el drag, no al inicio.

### 7. Verificación

- [ ] En 375px: el calendario muestra 1 columna con la semana en pills arriba.
- [ ] Swipe izquierda → siguiente día. Swipe derecha → día anterior.
- [ ] Los 7 pills de días son tocables para saltar directamente.
- [ ] El día de hoy está destacado en verde.
- [ ] El scroll vertical dentro del grid funciona sin bloqueos.
- [ ] Las ventanas de trabajo se ven legibles en el ancho completo.
- [ ] Tocar una ventana abre el modal de detalle.
- [ ] En desktop (> 768px): comportamiento existente sin ningún cambio.
- [ ] `npm run build` sin errores.
```

---
