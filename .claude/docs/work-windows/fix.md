```markdown
# Refactor & Mejora del Módulo Calendario — TyFlowVue

## Contexto del proyecto
Vue 3 + Vite + Pinia + Vue Router. Clean Architecture de 4 capas:
`View → Store → UseCase → Repository → HTTP Client`
El módulo ya existe y funciona parcialmente. Tu trabajo es corregirlo, mejorarlo
y verificar cada cambio antes de pasar al siguiente.

## Regla de trabajo obligatoria
**Nunca declares algo como "listo" hasta haber**:
1. Leído el archivo modificado completo después de escribirlo.
2. Trazado el flujo completo desde la vista hasta la API y de vuelta.
3. Verificado que no rompiste ningún otro módulo que use los mismos stores o componentes.
4. Corrido `npm run build` y confirmado que compila sin errores ni warnings relevantes.
5. Si encuentras un error al verificar, corrígelo y vuelve a verificar desde el paso 1.
No asumas que algo funciona si no lo has comprobado explícitamente.

---

## Paso 0 — Lectura y auditoría previa (no toques código aún)

Lee completamente estos archivos antes de escribir una sola línea:

- `src/presentation/views/CalendarioView.vue`
- `src/presentation/components/WeekCalendar.vue`
- `src/presentation/components/WindowBlock.vue`
- `src/presentation/components/WorkWindowModal.vue`
- `src/presentation/components/CreateWorkWindowModal.vue`
- `src/application/use-cases/work-windows/*.js` (todos)
- `src/infrastructure/repositories/WorkWindowRepository.js`
- `src/domain/entities/WorkWindow.js`
- `.claude/docs/work-windows/api-endpoints.md`
- `.claude/docs/work-windows/data-model.md`
- `D:\Projects\bd_tyflow\src\app\presentation\routes\work_window_routes.py`

Del último archivo extrae:
- El schema exacto que acepta el endpoint POST `/work-windows` (¿acepta array `windows: [...]`?).
- Los campos opcionales vs obligatorios.
- Si hay un endpoint PATCH o PUT para mover/editar una ventana existente.

Reporta lo que encontraste antes de continuar.

---

## Paso 1 — Correcciones de Clean Architecture

### 1.1 Sacar la entidad `WorkWindow` de la vista

`CalendarioView.vue` importa y construye `WorkWindow` directamente para el update
optimista en `handleOpen` y `handleCloseSession`. Esto viola la arquitectura.

**Solución**: Crea dos use cases nuevos que encapsulen el resultado esperado:

```
src/application/use-cases/work-windows/OpenWorkWindowUseCase.js   ← ya existe, ampliar
src/application/use-cases/work-windows/CloseWorkWindowUseCase.js  ← ya existe, ampliar
```

Cada use case debe:
1. Llamar al repositorio (POST open/close).
2. Devolver el `WorkWindow` actualizado — ya sea recargándolo con GET o construyendo
   el estado esperado internamente (nunca en la vista).

La vista solo debe recibir la entidad resultante y reemplazarla en el array local.
Elimina el `import { WorkWindow }` de `CalendarioView.vue`.

### 1.2 Mover el formateo de timezone al use case

En `CreateWorkWindowModal.vue` existe:
```js
startTime: form.value.startTime + ':00-05'
```
Esto es lógica de negocio (Colombia UTC-5). Muévelo a `CreateWorkWindowUseCase.js`.
La vista solo debe pasar `startTime: '08:00'`, el use case aplica el formato correcto.

### 1.3 Corregir el bug de `emit` no awaitable en `WorkWindowModal.vue`

```js
// BUG: emit() no devuelve Promise, accionando se resetea inmediatamente
await emit('open', props.window)
```

Solución: El componente no debe ser el que llame acciones async. 
Usa el patrón de callback con Promise explícita o mueve el estado de loading al padre
(`CalendarioView`). Elige la solución más limpia para este proyecto y aplícala
consistentemente en los tres handlers (open, close, delete).

### 1.4 Enriquecer los use cases vacíos

Los use cases actuales son pass-through sin valor. Añade al menos:
- Validación de que `startTime < endTime`.
- Validación de que `specialistId` y `applicationId` no sean vacíos.
- Para create: normalización del formato de tiempo (ver 1.2).
- Lanzar errores de dominio descriptivos, no dejar que el error HTTP llegue crudo a la vista.

---

## Paso 2 — Calendar UX: scroll, mobile y thresholds

### 2.1 Scroll y comportamiento mobile

El calendario debe comportarse como Google Calendar o Teams:
- Scroll vertical suave dentro del grid de horas en mobile y desktop.
- El header de días debe ser sticky al hacer scroll vertical.
- La columna de horas (gutter) debe ser sticky al hacer scroll horizontal si hay overflow.
- En mobile, el drag-select debe funcionar con touch de forma natural (preventDefault
  correcto sin bloquear el scroll de la página cuando no se está arrastrando).
- Añadir `touch-action: none` solo sobre las celdas del grid, no sobre el contenedor.

### 2.2 Thresholds de padding top/bottom

Problema actual: ventanas muy al inicio (ej. 00:00) o al final (23:30) quedan cortadas.

Solución:
- Añadir `padding-top` y `padding-bottom` al scroll container que sea al menos
  igual a la mitad de una celda de hora (`SLOT_H`).
- El threshold no debe afectar el posicionamiento absoluto de los bloques — solo
  agrega espacio visual en los extremos.
- Verificar que una ventana de 00:00–01:00 y una de 22:00–23:30 se vean completas
  sin ser cortadas por el borde.

### 2.3 Rendimiento del calendario

- El interval de `now` (tiempo actual) se crea pero nunca se limpia si el componente
  se desmonta y remonta. Verifica que el `onUnmounted` lo limpie correctamente.
- La línea de tiempo actual solo debe renderizarse si el día de hoy está en la semana
  visible. Actualmente usa `todayIndex` que puede ser `-1` — verifica que no haya
  renders erróneos cuando la semana no incluye hoy.

---

## Paso 3 — Creación multi-día y multi-ventana

### 3.1 El drag horizontal debe crear múltiples ventanas

Actualmente el drag-select emite `range-selected` con información de múltiples días
pero `CreateWorkWindowUseCase` solo crea una ventana. 

Tras leer `work_window_routes.py` (Paso 0), confirma si el endpoint acepta
`{ windows: [...] }` con múltiples objetos. Si es así:

- `WorkWindowRepository.create()` ya envía `{ windows: [...] }` pero solo con un elemento.
  Modifícalo para aceptar un array de ventanas.
- `CreateWorkWindowUseCase` debe aceptar un array de payloads y delegar al repositorio.
- Cuando el usuario arrastra sobre 3 días y confirma en el modal, se deben crear
  3 ventanas en una sola llamada API con el mismo horario para cada día seleccionado.

### 3.2 Actualizar el modal de creación para multi-día

Cuando el drag cubre múltiples días, el modal debe:
- Mostrar claramente qué días están seleccionados (chips o lista).
- Permitir deseleccionar días individuales antes de crear.
- Mostrar un contador: "Se crearán N ventanas".
- El campo de fecha individual desaparece y se reemplaza por la lista de días.

### 3.3 Verificación

Después de implementar, verifica:
1. Drag sobre 1 día → 1 llamada API con array de 1 ventana → ventana aparece en el grid.
2. Drag sobre 3 días → 1 llamada API con array de 3 ventanas → 3 ventanas aparecen.
3. Si la API falla, no quedan ventanas fantasma en el estado local.

---

## Paso 4 — Formulario de creación enriquecido (estilo Teams/Google Calendar)

El modal actual es demasiado simple. Rediseña `CreateWorkWindowModal.vue` con:

### 4.1 Múltiples especialistas + aplicaciones cruzadas

- El campo "Especialista" debe permitir seleccionar **múltiples** especialistas.
- Cada especialista puede estar asignado a **una aplicación diferente** en la misma ventana.
- UI sugerida: lista de filas, cada fila es `[Especialista] [Aplicación] [X eliminar]`.
  Botón "+ Agregar persona" añade una fila nueva.
- Al confirmar se genera un array de ventanas: una por cada fila especialista+aplicación,
  todas con el mismo horario y fechas.

### 4.2 Control de fecha y hora más rico

- El rango de tiempo debe poder editarse con inputs claros (no solo `<input type="time">`
  escondido). Muestra el rango de forma legible: "Lunes 2 jun · 08:00 – 17:00 (9h)".
- Permitir ajustar el horario directamente en el modal sin tener que cerrar y redibujar.

### 4.3 Vista previa de conflictos

Si dos filas tienen el mismo especialista con diferente aplicación en el mismo horario,
mostrar un indicador visual de advertencia (no bloquear la creación, solo avisar).

---

## Paso 5 — Agrupación visual de ventanas con horario compartido

### 5.1 Lógica de agrupación

En `WeekCalendar.vue`, cuando en un mismo día y misma franja horaria hay N ventanas
de diferentes especialistas o aplicaciones, en lugar de mostrar N bloques comprimidos
(el comportamiento actual de columnas), mostrar **un bloque de grupo**:

- El bloque de grupo muestra: cantidad de ventanas, íconos o iniciales de los especialistas.
- Al hacer click se abre un panel lateral o modal que lista las ventanas individuales
  del grupo con sus datos (especialista, app, estado open/closed).
- Desde ese panel se puede interactuar con cada ventana individual (abrir sesión,
  cerrar sesión, eliminar).

### 5.2 Criterio de agrupación

Agrupa ventanas cuando:
- Mismo `scheduledDate`.
- `startHour` y `endHour` idénticos (o solapamiento > 80% del bloque mayor).
- Más de 1 ventana cumple la condición.

### 5.3 Implementación

- Extrae la lógica de agrupación a un composable:
  `src/presentation/composables/useWindowGroups.js`
- `WeekCalendar` consume el composable y decide si renderiza `WindowBlock` individual
  o un nuevo `WindowGroupBlock`.
- Crea `src/presentation/components/WindowGroupBlock.vue` para el bloque de grupo.
- Crea `src/presentation/components/WindowGroupPanel.vue` para el panel de detalle.

---

## Paso 6 — Drag-to-reschedule (mover ventana existente)

### 6.1 Flujo

- El usuario puede arrastrar un `WindowBlock` existente a otra celda del grid.
- Durante el drag se muestra un ghost del bloque en la posición destino.
- Al soltar, si hay un endpoint PATCH/PUT (verificado en Paso 0), se llama la API
  para actualizar `scheduled_date`, `start_time`, `end_time`.
- Si no existe endpoint de edición, muestra un toast indicando que la operación
  no está disponible y cancela el drag sin modificar estado.

### 6.2 Separación de drags

El grid tiene dos modos de drag:
- **Celda vacía** → crea nueva ventana (comportamiento actual).
- **WindowBlock existente** → mueve ventana (nuevo comportamiento).

Deben coexistir sin interferir. Usa `data-window-id` en el bloque para distinguirlos.

### 6.3 Crear use case

```
src/application/use-cases/work-windows/RescheduleWorkWindowUseCase.js
```

---

## Paso 7 — Verificación final integral

Después de completar todos los pasos, ejecuta esta checklist en orden.
**No marques nada como completo sin haberlo probado:**

### Build
```bash
npm run build
# Debe compilar sin errores. Warnings de unused vars son aceptables solo si son
# de librerías externas. Warnings propios del código deben corregirse.
```

### Revisión de arquitectura
- [ ] `CalendarioView.vue` no importa nada de `@/domain/`.
- [ ] `CalendarioView.vue` no importa nada de `@/infrastructure/`.
- [ ] Los use cases de work-windows tienen al menos una validación cada uno.
- [ ] El formateo `':00-05'` no aparece en ningún componente Vue.
- [ ] `WorkWindowModal.vue` no usa `await emit(...)`.

### Revisión de componentes
- [ ] En mobile (viewport 375px), el calendario hace scroll vertical sin problemas.
- [ ] Las ventanas en hora 00:xx y 23:xx son visibles sin ser cortadas.
- [ ] La línea de tiempo actual no aparece cuando la semana visible no incluye hoy.
- [ ] El interval de tiempo se limpia al desmontar `WeekCalendar`.

### Revisión de funcionalidades
- [ ] Drag en 1 celda → modal abre con 1 día → crea 1 ventana → aparece en grid.
- [ ] Drag horizontal en 3 días → modal muestra 3 días → crea 3 ventanas en 1 llamada API.
- [ ] Seleccionar 2 especialistas distintos con apps distintas → crea 2 ventanas en 1 llamada.
- [ ] Ventanas con mismo horario en mismo día se agrupan visualmente.
- [ ] Click en grupo → panel muestra ventanas individuales con acciones.
- [ ] Abrir/cerrar sesión desde panel de grupo funciona correctamente.
- [ ] Si existe endpoint de edición: arrastrar ventana la mueve y actualiza en API.
- [ ] Si no existe endpoint: arrastrar muestra toast y no modifica estado.

### Revisión de errores
- [ ] Si la API devuelve error al crear, ninguna ventana queda en estado local.
- [ ] Si la API devuelve error al abrir/cerrar sesión, el estado local no se corrompe.
- [ ] Errores de red muestran toast descriptivo, no crashean el componente.

---

## Notas de estilo y consistencia

- Mantén el sistema de diseño existente: CSS variables de `tokens.css`, sin Tailwind,
  sin librerías de componentes externas.
- Los nuevos componentes deben seguir el mismo patrón de `<script setup>` + `<template>`
  + `<style scoped>` que el resto del proyecto.
- Los textos en español, consistente con el resto de la UI.
- No introduzcas dependencias npm nuevas sin justificación explícita.

---

## Si en algún punto encuentras ambigüedad

1. Lee el archivo de backend `work_window_routes.py` que ya leíste en el Paso 0.
2. Consulta `.claude/docs/work-windows/` para contexto adicional.
3. Si aún tienes dudas sobre el comportamiento de la API, escribe un curl de prueba
   y analiza la respuesta antes de asumir el contrato.
4. Nunca inventes un contrato de API — verifica siempre contra el código de backend
   o la documentación disponible.
```