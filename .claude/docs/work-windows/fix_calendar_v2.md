
**Problemas confirmados en el código:**

1. **No existen vistas Day/Month** — `CalendarioView` solo tiene `weekOffset`, siempre 7 columnas. No hay selector de vista en la toolbar, solo flechas de navegación de semana.

2. **Solapamiento mal calculado** — `windowsByDay` asigna columnas con un loop simple que no cubre todos los casos de overlap. Cuando 3+ ventanas se solapan, `_totalCols` se calcula mal y los bloques se pisan.

3. **Drag roto en mobile** — `onBlockDragMove` usa `e.clientY || e.touches?.[0]?.clientY` pero durante `touchmove` el `e.clientY` no existe — la condición siempre cae al lado equivocado. El timer de 300ms de long-press interfiere con el scroll cuando el usuario intenta scrollear rápido.

4. **Cero validación de fechas pasadas** — `canSubmit` solo verifica que haya fechas y filas con especialista. No hay ninguna lógica que rechace fechas anteriores a hoy, ni horas pasadas si es hoy mismo.

5. **No se pueden agregar personas a ventana existente** — `WorkWindowModal` tiene modo edición pero solo permite cambiar `startTime`, `endTime` y una nota. No hay forma de agregar otro especialista/app a una ventana creada.

6. **Mobile con 7 columnas** — el CSS responsive en `< 480px` solo reduce fuentes, `grid-template-columns: 2rem repeat(7, 1fr)` sigue ahí. 7 columnas en 320px = ~40px cada una.

Aquí el prompt completo:

---

```markdown
# Fix Integral — Módulo Calendario

## Regla de trabajo obligatoria
Antes de tocar código: lee cada archivo completo. Después de escribir: traza el
flujo completo, verifica que no rompiste otros módulos, corre `npm run build`.
No declares nada "listo" sin haberlo comprobado explícitamente.

---

## Paso 0 — Auditoría previa

Lee completos ANTES de escribir una sola línea:
- `src/presentation/views/CalendarioView.vue`
- `src/presentation/components/WeekCalendar.vue`
- `src/presentation/components/WorkWindowModal.vue`
- `src/presentation/components/CreateWorkWindowModal.vue`
- `src/presentation/components/WindowBlock.vue`
- `src/presentation/components/WindowGroupBlock.vue`
- `src/presentation/components/WindowGroupPanel.vue`
- `src/presentation/composables/useWindowGroups.js`
- `src/application/use-cases/work-windows/*.js` (todos)
- `src/infrastructure/repositories/WorkWindowRepository.js`
- `D:\Projects\bd_tyflow\src\app\presentation\routes\work_window_routes.py`

Reporta antes de continuar:
- ¿El endpoint de crear acepta `{ windows: [...] }` con múltiples objetos?
- ¿Existe endpoint PATCH/PUT para editar una ventana (horario, especialista)?
- ¿El endpoint de crear acepta agregar una nueva fila
  `{ specialist_id, application_id }` a una ventana existente?
- ¿Qué campos valida el backend en create?

---

## Paso 1 — Toolbar de vistas (Day / Week) al estilo Teams

### 1.1 Añadir selector de vista en CalendarioView

La toolbar actual solo tiene flechas de semana. Añade un selector de vista:

```
[ ← ] [ Hoy ] [ → ]   Lun 26 – Dom 1 jun     [ Día | Semana ]
```

Estado en CalendarioView:
```js
const calView = ref('week') // 'week' | 'day'
const dayOffset = ref(0)    // offset en días para vista de día
```

En vista `day`, `weekDates` se reemplaza por un array de 1 solo elemento
(la fecha activa). Las flechas navegan de día en día en lugar de semana a semana.

En vista `week`, comportamiento actual.

El label cambia:
- `week`: "Lun 26 – Dom 1 jun 2025"
- `day`: "Lunes, 26 may 2025"

Pasar `calView` a `WeekCalendar` como prop:
```js
defineProps({
  // ...existentes
  viewMode: { type: String, default: 'week' } // 'week' | 'day'
})
```

### 1.2 WeekCalendar en modo day

Cuando `viewMode === 'day'`, el grid cambia a 1 sola columna:

```css
/* En modo day */
.cal-header,
.cal-body {
  grid-template-columns: 3.5rem 1fr;
}
```

Los bloques de ventanas ocupan el 100% del ancho disponible en modo día
(no hay columnas laterales, `_totalCols = 1`).

### 1.3 Mobile: modo day por defecto

En viewports `< 768px`, forzar `calView = 'day'` automáticamente:

```js
// CalendarioView.vue
const isMobile = ref(window.innerWidth < 768)
watch(isMobile, (mobile) => {
  if (mobile && calView.value === 'week') calView.value = 'day'
})
```

En mobile, el selector de vista no se muestra — solo flechas de día y label del día.
Añadir swipe horizontal en el propio WeekCalendar para cambiar día en mobile:

```js
// WeekCalendar.vue — solo cuando viewMode === 'day' y es touch
let swipeStartX = 0
const onCalTouchStart = (e) => {
  if (props.viewMode !== 'day') return
  swipeStartX = e.touches[0].clientX
}
const onCalTouchEnd = (e) => {
  if (props.viewMode !== 'day') return
  const dx = e.changedTouches[0].clientX - swipeStartX
  if (Math.abs(dx) < 50) return
  emit(dx < 0 ? 'next-day' : 'prev-day')
}
```

CalendarioView escucha `@next-day` y `@prev-day` para incrementar/decrementar
`dayOffset`.

---

## Paso 2 — Corregir el solapamiento de bloques

### 2.1 Diagnóstico del algoritmo actual

El loop en `windowsByDay` asigna columnas incrementando si hay overlap con `_col === col`,
pero solo verifica contra una columna a la vez. Con 3+ ventanas solapadas, el resultado
es incorrecto: varios bloques terminan con el mismo `_col` y se pisan.

### 2.2 Algoritmo correcto (interval graph coloring)

Reemplaza la lógica de asignación de columnas dentro de `windowsByDay`:

```js
// Para cada día, asignar columnas correctamente
for (let d = 0; d < 7; d++) {
  const blocks = [...windowsByDay[d]].sort((a, b) => a.startHour - b.startHour)
  
  // Asignar columna: la mínima columna libre en ese instante
  const colEndTimes = [] // colEndTimes[col] = hora en que esa columna queda libre
  
  for (const block of blocks) {
    // Buscar la primera columna disponible (que haya terminado antes del inicio de este bloque)
    let assignedCol = colEndTimes.findIndex(endTime => endTime <= block.startHour)
    if (assignedCol === -1) {
      assignedCol = colEndTimes.length
      colEndTimes.push(block.endHour)
    } else {
      colEndTimes[assignedCol] = block.endHour
    }
    block._col = assignedCol
  }
  
  const totalCols = colEndTimes.length || 1
  for (const block of windowsByDay[d]) {
    block._totalCols = totalCols
  }
}
```

Este algoritmo es O(n log n) y garantiza que nunca dos bloques tengan el mismo `_col`
si se solapan.

### 2.3 Verificar en WindowBlock

Confirma que `WindowBlock.vue` calcula su `left` y `width` usando `col` y `totalCols`
correctamente:
```js
// Esperado en WindowBlock
const left = computed(() => `calc(${(props.col / props.totalCols) * 100}% + 2px)`)
const width = computed(() => `calc(${(1 / props.totalCols) * 100}% - 4px)`)
```
Si no es así, corrigelo.

---

## Paso 3 — Validación de fechas pasadas en CreateWorkWindowModal

### 3.1 Regla de negocio

Una ventana de trabajo solo puede crearse para:
- Fechas **futuras** (cualquier hora es válida).
- **Hoy**, pero solo si la hora de FIN es al menos 30 minutos superior a la hora actual.

### 3.2 Implementar en CreateWorkWindowUseCase

```js
// CreateWorkWindowUseCase.js
export async function createWorkWindowUseCase(data) {
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  
  for (const date of data.dates) {
    if (date < todayISO) {
      throw new DomainError('No se pueden crear ventanas en fechas pasadas.')
    }
    if (date === todayISO) {
      // Verificar que endTime sea >= ahora + 30 min
      const [endH, endM] = data.endTime.split(':').map(Number)
      const endMinutes = endH * 60 + endM
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (endMinutes < nowMinutes + 30) {
        throw new DomainError(
          'Para el día de hoy, la hora de fin debe ser al menos 30 minutos posterior a la hora actual.'
        )
      }
    }
  }
  
  // ...resto de la lógica existente
}
```

### 3.3 Feedback visual en CreateWorkWindowModal

Las fechas pasadas en el selector de días deben mostrarse deshabilitadas/grises
con un cursor `not-allowed`. Si el usuario intenta seleccionarlas, no deben añadirse
a `selectedDates`.

Para el día de hoy, si el `endTime` actual no cumple la regla de 30 minutos,
mostrar un mensaje de error inline debajo del selector de hora (no como toast,
sino como texto rojo pequeño junto al campo).

```js
// Computed en CreateWorkWindowModal
const endTimeError = computed(() => {
  if (!selectedDates.value.includes(todayISO())) return null
  if (!endTime.value) return null
  const [endH, endM] = endTime.value.split(':').map(Number)
  const endMinutes = endH * 60 + endM
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (endMinutes < nowMinutes + 30) {
    return 'La hora de fin debe ser al menos 30 min posterior a la hora actual para hoy.'
  }
  return null
})
```

El botón de crear debe estar deshabilitado si `endTimeError` tiene valor.

---

## Paso 4 — Agregar personas a ventana existente desde WorkWindowModal

### 4.1 Nueva acción en el modal

En el modal de detalle de una ventana (`WorkWindowModal.vue`), añadir una
sección "Agregar a este horario" que permita asignar otro especialista + aplicación
con el mismo `scheduledDate`, `startTime` y `endTime`.

UI sugerida (dentro del modal, al final):
```
────────────────────────────────
Agregar al mismo horario
[Especialista ▼] [Aplicación ▼] [+ Agregar]
```

Al confirmar, emite `@add-window` con los datos del nuevo especialista/app:
```js
emit('add-window', {
  scheduledDate: props.window.scheduledDate,
  startTime: props.window.startTime,
  endTime: props.window.endTime,
  specialistId: addSpecialistId.value,
  applicationId: addApplicationId.value,
})
```

### 4.2 Recibir en CalendarioView

En `CalendarioView`, `@add-window` llama a `createWorkWindowUseCase` con los
datos de la nueva ventana (misma fecha/hora, diferente especialista/app).
La nueva ventana se añade al array `windows.value` sin recargar todo.

### 4.3 Props necesarios

`WorkWindowModal` necesita recibir listas de especialistas y aplicaciones disponibles
para renderizar los dropdowns. Añade las props:
```js
specialists: { type: Array, default: () => [] }
applications: { type: Array, default: () => [] }
```

CalendarioView ya tiene `userStore.users` y `userStore.applications` — pásalos.

---

## Paso 5 — Corregir el drag en mobile

### 5.1 Bug: e.clientY durante touchmove

En `onBlockDragMove`:
```js
// BUG actual:
e.clientY || e.touches?.[0]?.clientY
// En touchmove, e.clientY es undefined → siempre usa el lado derecho
// PERO e.touches[0] durante touchmove sí existe — el bug es que la
// condición no funciona porque undefined || value siempre da value,
// pero el problema real es que e.clientX durante mouse events está bien,
// mientras que en touch events HAY que usar e.touches[0]
```

Corrige de forma explícita:
```js
const onBlockDragMove = (e) => {
  if (!blockDragging.value) return
  const clientX = e.touches ? e.touches[0]?.clientX : e.clientX
  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  if (clientX == null || clientY == null) return
  const el = document.elementFromPoint(clientX, clientY)
  if (el?.dataset.slot !== undefined) {
    draggedTargetDay.value = parseInt(el.dataset.day)
    draggedTargetSlot.value = parseInt(el.dataset.slot)
  }
}
```

Aplica el mismo fix a `onTouchmove` donde se usa `touch.clientX/Y`.

### 5.2 Separar touch-scroll de touch-drag

El problema principal en mobile es que `touchstart` en las celdas previene el
scroll de la página. La solución:

- Las celdas NO deben tener `@touchstart` con `preventDefault` por defecto.
- El `touchTimer` de 300ms antes de activar drag es correcto — pero el listener
  de `touchmove` en el documento NO debe llamar `e.preventDefault()` hasta que
  el drag esté confirmado (`touchActive.value === true`).

```js
const onTouchmove = (e) => {
  // Si el long-press aún no se activó → el usuario está scrolleando, no intervenir
  if (!touchActive.value && !blockDragging.value) {
    if (touchTimer) {
      clearTimeout(touchTimer)
      touchTimer = null
    }
    return // NO llamar preventDefault — dejar que el scroll nativo funcione
  }
  // Solo aquí, con drag confirmado, prevenir scroll
  e.preventDefault()
  const clientX = e.touches[0]?.clientX
  const clientY = e.touches[0]?.clientY
  // ...resto del código
}
```

---

## Paso 6 — Responsive completo (estilo Teams Calendar)

### 6.1 Mobile (< 768px): vista día con navegación

Ya cubierto en Paso 1.3. Además:

- En mobile, la toolbar debe ser compacta:
  ```
  [ ← ] Lunes 26 may [ → ]
  ```
  Sin filtros de especialista/app visibles (moverlos a un botón de filtro `⚙`
  que abre un panel deslizable).

- El botón "+ Nueva Ventana" en mobile se reduce a un FAB (floating action button)
  circular en la esquina inferior derecha:
  ```css
  .btn-create--fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    z-index: 50;
  }
  ```

### 6.2 Tablet (768px – 1024px): vista semana reducida

- Mostrar el selector de vista (Día/Semana).
- En vista semana: columnas más estrechas pero funcionales.
- Los filtros se muestran en la toolbar pero en tamaño compacto.

### 6.3 Desktop (> 1024px): comportamiento actual preservado

Sin cambios en desktop.

---

## Paso 7 — Verificación integral

```bash
npm run build
# Sin errores propios del código.
```

### Vistas
- [ ] En desktop: selector Día/Semana visible en la toolbar.
- [ ] En vista Semana: 7 columnas, navegación semanal. Sin cambios al actual.
- [ ] En vista Día: 1 columna, navegación diaria con flechas.
- [ ] En mobile (375px): siempre vista Día, sin selector visible, swipe funciona.
- [ ] Swipe izquierda → día siguiente. Swipe derecha → día anterior.
- [ ] En mobile: FAB visible en la esquina inferior derecha.
- [ ] En mobile: filtros ocultos por defecto.

### Solapamiento
- [ ] 2 ventanas solapadas en el mismo día → 2 columnas sin pisarse.
- [ ] 3 ventanas solapadas → 3 columnas sin pisarse.
- [ ] 1 ventana sola → ocupa el 100% del ancho de la columna.
- [ ] Ventanas no solapadas → cada una ocupa 100% del ancho.

### Validación de fechas
- [ ] Al seleccionar una fecha pasada en el modal de creación → no se puede
  añadir a `selectedDates`.
- [ ] Fechas pasadas en el selector aparecen grises con `cursor: not-allowed`.
- [ ] Si el día seleccionado es hoy y `endTime` < ahora + 30min → error inline visible.
- [ ] El botón crear está deshabilitado mientras hay `endTimeError`.
- [ ] Si se corrige la hora de fin → el error desaparece y el botón se habilita.
- [ ] La validación existe también en `CreateWorkWindowUseCase` (defensa en profundidad).

### Agregar personas a ventana existente
- [ ] En el modal de detalle de ventana, hay sección "Agregar al mismo horario".
- [ ] Se pueden seleccionar especialista y aplicación.
- [ ] Al confirmar, aparece una nueva ventana en el grid con el mismo horario.
- [ ] La nueva ventana se añade sin recargar todo el calendario.
- [ ] Si la API falla, no queda ninguna ventana fantasma en el estado local.

### Drag
- [ ] En desktop: arrastrar celda vacía → preview visible → modal de creación abre.
- [ ] En desktop: arrastrar ventana existente → ghost visible → ventana se mueve.
- [ ] En mobile: scroll vertical funciona sin activar drag.
- [ ] En mobile: long-press (300ms) activa el drag de ventana existente.
- [ ] En mobile: si el usuario mueve el dedo antes de 300ms → se cancela el
  long-press y el scroll continúa normalmente.

### General
- [ ] No hay `console.error` sin capturar en ningún flujo normal.
- [ ] Todos los errores de API muestran toast descriptivo.
- [ ] El calendario en mobile no tiene scroll horizontal.
```
