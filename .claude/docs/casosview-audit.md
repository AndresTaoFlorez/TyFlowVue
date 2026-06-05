# CasosView — Auditoría profunda

> Fecha: 2026-06-05
> Alcance: CasosView + CaseDetailView + 7 componentes hijos + useCasesStore + useCasesRealtime + Case entity + CaseRepository + SyncEngine + wsClient
> Solo diagnóstico, sin cambios de código.

---

## Tabla resumen

| # | Hallazgo | Categoría | Severidad | Esfuerzo | Archivos clave |
|---|----------|-----------|-----------|----------|----------------|
| **01** | RT handlers destruyen datos de Case (spread camelCase → constructor snake_case) | Bug | Critica | S | **Hecho** |
| **02** | `onCaseCreatedRT` no chequea todos los filtros activos | Bug | Alta | S | **Hecho** |
| **03** | `onCaseUpdatedRT` solo mergea `status`, ignora otros campos del evento | Bug | Alta | S | **Hecho** |
| **04** | `error` ref compartido entre todas las operaciones async | Bug | Alta | M | **Hecho** |
| **05** | Especialistas para asignación manual dependen de workload del app incorrecto | Bug | Alta | M | **Hecho** |
| **06** | Store llama CaseRepository.fetchAll directamente, ignora FetchCasesUseCase | Arquitectura | Media | S | **Hecho** |
| **07** | CaseAssignPanel y CaseCreateModal importan repos de infraestructura | Arquitectura | Alta | M | **Hecho** |
| **08** | SyncEngine para cases tiene `fetchRemote: null` — no hay SWR real | Rendimiento | Media | M | useCasesStore.js:15-20 |
| **09** | CaseDetailView duplica ~80% de la lógica de CaseDetailModal | Calidad | Media | L | **Hecho** |
| **10** | Cascading selects (App→Level→Category) duplicados en 2 componentes | Calidad | Media | M | **Hecho** |
| **11** | statusOptions/statusLabels/fmtDate duplicados en 4+ archivos | Calidad | Media | S | **Hecho** |
| **12** | Cambio de filtro no tiene debounce — rafagas de clicks disparan N fetches | Rendimiento | Media | S | CaseFiltersBar.vue:35-37 |
| **13** | No hay update optimista para cambio de estado | UX | Media | M | useCasesStore.js:176-196 |
| **14** | `waitingTime` es estático — nunca se actualiza tras el render inicial | UX | Media | S | Case.js:98, CaseListTable.vue:67 |
| **15** | `loadCaseById` se llama 2 veces tras asignación exitosa | Rendimiento | Media | S | useCasesStore.js:203 + CaseDetailModal.vue:21-23 |
| **16** | MAX_LOAD hardcodeado a 10 en CaseLoadsView | Calidad | Media | S | CaseLoadsView.vue:11 |
| **17** | Tabla de casos no es navegable por teclado | Accesibilidad | Baja | S | CaseListTable.vue:48 |
| **18** | Tabs sin semántica ARIA (tablist/tab/tabpanel) | Accesibilidad | Baja | S | CasosView.vue:35-49 |
| **19** | CaseCreateModal no cierra con Escape | Accesibilidad | Baja | S | CaseCreateModal.vue:101 |
| **20** | Modales no atrapan foco (focus trap) | Accesibilidad | Baja | M | CaseDetailModal.vue, CaseCreateModal.vue |
| **21** | Cambio de estado no pide confirmación — misclick irreversible | UX | Baja | S | CaseDetailModal.vue:134, CaseDetailView.vue:122 |
| **22** | CaseCreateModal cierra con setTimeout(800) hardcodeado | UX | Baja | S | CaseCreateModal.vue:82 |
| **23** | Errores de workloads silenciados | Calidad | Baja | S | useCasesStore.js:263 |
| **24** | Cache de SyncEngine solo guarda la página actual, borra las anteriores | Rendimiento | Baja | M | useCasesStore.js:77 |

---

## Fichas detalladas

---

### 01 — RT handlers destruyen datos de Case (spread camelCase → constructor snake_case)

**Categoría:** Bug  
**Severidad:** Critica  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L278-343, `Case.js` constructor

**Causa raiz:**

Los handlers de realtime (`onCaseAssignedRT`, `onCaseReassignedRT`, `onCaseUpdatedRT`) reconstruyen un `Case` haciendo spread de una instancia existente:

```js
const updated = new Case({ ...cases.value[idx], status: 'assigned', specialist_id: data.specialist_id })
```

El problema: `cases.value[idx]` es una instancia de `Case`. El spread copia propiedades en **camelCase** (`applicationId`, `specialistId`, `supportLevelId`, etc.). Pero el constructor de `Case` espera propiedades en **snake_case** (`application_id`, `specialist_id`, `support_level_id`).

Resultado: el nuevo `Case` tiene casi todos los campos en `undefined` o en sus defaults:

| Propiedad | Valor tras spread | Lo que el constructor lee | Resultado |
|-----------|-------------------|---------------------------|-----------|
| `applicationId` | `'uuid-real'` | `raw.application_id` → `undefined` | **perdido** |
| `specialistId` | `'uuid-real'` | `raw.specialist_id` → `undefined` (o lo que `data` pase) | **perdido** (excepto si se pasa explícitamente) |
| `supportCategoryId` | `'uuid-real'` | `raw.support_category_id` → `undefined` | **perdido** |
| `subject` | `'Texto real'` | `raw.subject` → `'Texto real'` | OK (misma key) |
| `origin` | `{type:'outlook',...}` | `raw.origin` → `{type:'outlook',...}` | OK |

**Flujo roto:**

1. Backend emite `case.assigned` vía WS
2. `onCaseAssignedRT` encuentra el caso en la lista local
3. Construye `new Case({ ...existingCase, ... })` — destruye `applicationId`, `supportLevelId`, `supportCategoryId`, `createdAt`, `assignedAt`, etc.
4. `casesSync.updateLocal()` persiste la versión corrupta al cache
5. La tabla muestra el caso con datos faltantes (badges sin color, IDs perdidos)
6. Si el usuario abre el detalle, `loadCaseById` lo corrige — pero el daño al cache ya está hecho

**Ocurre en 6 sitios:** L288, L296-301, L311, L315, L333, L341

**Fix propuesto:** Agregar `_toRaw()` a Case (como ya tiene WorkWindow) que convierte de camelCase a snake_case, o cambiar los RT handlers para mergear campos individuales en vez de reconstruir toda la instancia.

---

### 02 — `onCaseCreatedRT` no chequea todos los filtros activos

**Categoría:** Bug  
**Severidad:** Alta  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L267-276

**Causa raiz:**

```js
function onCaseCreatedRT(data) {
  const c = new Case(data)
  if (filters.value.status && c.status !== filters.value.status) return
  if (filters.value.originType && c.originType !== filters.value.originType) return
  // ← No chequea priority, applicationId, specialistId
  if (!cases.value.find(x => x.id === c.id)) {
    cases.value.unshift(c)
    ...
  }
}
```

Solo filtra por `status` y `originType`. Los filtros `priority`, `applicationId` y `specialistId` se ignoran. Si el usuario tiene activo `applicationId = 'App-A'` y llega un caso de `App-B` vía RT, aparece en la lista.

**Evidencia:** `filters` (L27-33) tiene 5 campos, el handler solo chequea 2.

**Fix propuesto:** Agregar chequeos para los 3 filtros faltantes.

---

### 03 — `onCaseUpdatedRT` solo mergea `status`, ignora otros campos del evento

**Categoría:** Bug  
**Severidad:** Alta  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L323-344

**Causa raiz:**

```js
const updated = new Case({ ...cases.value[idx], status: data.status })
```

Solo extrae `status` del payload RT. Si el backend envía cambios de `priority`, `subject`, `specialist_id`, `support_level_id`, etc., se pierden.

Adicionalmente, este handler sufre del bug #01 (spread de Case instance).

**Fix propuesto:** Mergear todos los campos del payload RT, no solo `status`. Usar `_toRaw()` + spread de `data` completo.

---

### 04 — `error` ref compartido entre todas las operaciones async

**Categoría:** Bug  
**Severidad:** Alta  
**Esfuerzo:** M

**Archivos:** `useCasesStore.js` L39

**Causa raiz:**

Un solo `error = ref(null)` sirve para `loadCases`, `loadCaseById`, `createCase`, `updateCase`, `updateCaseStatus`, `assignWdd`, `assignManual`, y `reassign`. Cada operación comienza con `error.value = null`.

Race condition: si `assignWdd` falla pero `loadCaseById` (que corre en paralelo en la misma función, L203) tiene éxito, el error del assign se borra antes de que el usuario lo vea.

Tambien al revés: un error de `loadCases` puede mostrarse en `CaseDetailModal` porque ambos leen `store.error`.

**Flujo roto:**

1. Usuario abre detail modal → `loadCaseById` falla → `error = 'Error cargando caso'`
2. En background, `loadCases` (triggered por RT filter revalidation) → `error = null`
3. Modal muestra contenido vacío sin mensaje de error

**Fix propuesto:** Separar en `listError`, `detailError`, `actionError` — o al menos separar lectura de escritura para que el modal solo lea errores de detalle.

---

### 05 — Especialistas para asignación manual dependen del workload del app incorrecto

**Categoría:** Bug  
**Severidad:** Alta  
**Esfuerzo:** M

**Archivos:** `CaseAssignPanel.vue` L37, `CasosView.vue` L26-28

**Causa raiz:**

`CaseAssignPanel` muestra la lista de especialistas como:
```js
const specialists = computed(() => store.specialistWorkloads)
```

Pero `specialistWorkloads` se carga en `CasosView.onMounted` con `userStore.applications[0].id` — siempre la primera app. Si el caso abierto pertenece a otra aplicación, los especialistas mostrados no son los correctos.

**Flujo roto:**

1. El sistema tiene App-A (primera) y App-B
2. CasosView carga workloads de App-A
3. Usuario abre caso que pertenece a App-B → abre CaseAssignPanel
4. La pestaña "Manual" muestra especialistas de App-A, no de App-B
5. El usuario asigna a un especialista que no está configurado para App-B → backend rechaza o asignación incorrecta

**Fix propuesto:** CaseAssignPanel debería cargar workloads del `applicationId` del caso actual, no del global.

---

### 06 — Store llama CaseRepository.fetchAll directamente, ignora FetchCasesUseCase

**Categoría:** Arquitectura  
**Severidad:** Alta  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L4,72 / `FetchCasesUseCase.js`

**Causa raiz:**

```js
import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'
// ...
const result = await CaseRepository.fetchAll({ ... })
```

El store importa directamente el repositorio de la capa de infraestructura. Existe `FetchCasesUseCase` (importable) pero no se usa. Todas las demás operaciones (create, update, assign, etc.) sí pasan por sus respectivos use cases.

**Por qué importa:** Viola el flujo `Store → UseCase → Repository` de la arquitectura. Si en el futuro se agrega lógica de negocio al fetch (validación, transformación, logging), hay que recordar que el fetch principal no pasa por el use case.

**Fix propuesto:** Cambiar a `fetchCasesUseCase(filters)` (ya existe y es un pass-through, pero establece la convención).

---

### 07 — CaseAssignPanel y CaseCreateModal importan repos de infraestructura directamente

**Categoría:** Arquitectura  
**Severidad:** Alta  
**Esfuerzo:** M

**Archivos:** `CaseAssignPanel.vue` L5-6, `CaseCreateModal.vue` L5-6

**Causa raiz:**

```js
import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'
```

Componentes de presentación acceden directamente a la capa de infraestructura para cargar pivots (App → SupportLevels, Level → Categories). Esto salta dos capas de la arquitectura (Application y Domain).

**Por qué importa:** Los componentes no deberían conocer la existencia de repositorios. Si la fuente de datos cambia (ej. se cachean pivots en un store), hay que tocar componentes en vez de use cases.

**Fix propuesto:** Crear use cases para los pivots (`FetchAppSupportLevelsUseCase`, `FetchLevelCategoriesUseCase`) o centralizar la lógica en el store/composable.

---

### 08 — SyncEngine para cases tiene `fetchRemote: null` — no hay SWR real

**Categoría:** Rendimiento  
**Severidad:** Media  
**Esfuerzo:** M

**Archivos:** `useCasesStore.js` L15-20

**Causa raiz:**

```js
const casesSync = new SyncEngine({
  cacheKey: 'tyflow_cases_v1',
  hydrate: (raw) => new Case(raw),
  fetchRemote: null,  // ← no puede hacer syncInBackground
  getId: (item) => item.id,
})
```

`fetchRemote` es `null`, lo que hace imposible usar `syncInBackground()`. El SyncEngine se usa solo como utilidad de cache (writeToCache, loadFromCache, updateLocal, replaceAll), no como motor SWR.

Resultado: cada cambio de filtro o página hace un full fetch que reemplaza todo el estado. No hay stale-while-revalidate real. La mejora de B1 (no mostrar spinner si hay cache) funciona solo para el initial load desde localStorage.

**Por qué importa:** El patrón existe y ya funciona para applications en useUserStore. Cases podría beneficiarse del mismo patrón pero no es trivial porque los cases son paginados y filtrados.

**Fix propuesto:** Decidir: (a) si se quiere SWR real para cases, hay que manejar la invalidación por filtro/página; (b) si no, simplificar y no usar SyncEngine (usar un cache manual más simple). La opción (b) es más pragmática dado que los cases son paginados.

---

### 09 — CaseDetailView duplica ~80% de la lógica de CaseDetailModal

**Categoría:** Calidad  
**Severidad:** Media  
**Esfuerzo:** L

**Archivos:** `CaseDetailView.vue`, `CaseDetailModal.vue`

**Causa raiz:**

Ambos archivos contienen lógica casi idéntica:
- `statusOptions`, `statusLabels` (arrays/objetos iguales)
- `changeStatus()`, `fmtDate()` (funciones idénticas)
- `specialistName`, `categoryName` (computeds idénticos)
- `showAssign`, `showReassign`, `onAssignDone`, `onReassignDone` (mismo patrón)
- Template de badges, actions, assign panel, detail grid, description — estructura casi igual con distinto CSS prefix

**Por qué importa:** Cualquier cambio funcional (ej. agregar un campo al detalle) requiere editarse en dos lugares.

**Fix propuesto:** Extraer un composable `useCaseDetail(caseRef)` que retorne toda la lógica compartida, y un componente `CaseDetailContent` que contenga el markup compartido. CaseDetailView y CaseDetailModal solo manejan su frame (página completa vs modal).

---

### 10 — Cascading selects (App → Level → Category) duplicados en 2 componentes

**Categoría:** Calidad  
**Severidad:** Media  
**Esfuerzo:** M

**Archivos:** `CaseCreateModal.vue` L31-59, `CaseAssignPanel.vue` L39-67

**Causa raiz:**

La lógica de cascading selects es un copy-paste exacto entre los dos componentes:
- `availableLevels`, `availableCategories` refs
- `loadingLevels`, `loadingCategories` refs
- Watch de `applicationId` → fetch pivots → filter userStore levels
- Watch de `supportLevelId` → fetch pivots → filter userStore categories

**Fix propuesto:** Extraer un composable `useCascadingSelects(applicationIdRef, supportLevelIdRef)` que encapsule todo el patrón. Bonus: permite centralizar el fix del bug #07 en un solo lugar.

---

### 11 — statusOptions/statusLabels/fmtDate duplicados

**Categoría:** Calidad  
**Severidad:** Media  
**Esfuerzo:** S

**Archivos:** `CaseDetailModal.vue` L17-18, `CaseDetailView.vue` L45-46, `CaseStatusTimeline.vue` L19, `CaseLoadsView.vue` L37-40, `Case.js` L1-7

**Causa raiz:**

- `STATUS_LABELS` existe en `Case.js` y se accede via `case.statusLabel`, pero los componentes necesitan el mapa completo para renderizar `<select>` y `<option>` — asi que lo redefinen localmente.
- `fmtDate` existe en 4 componentes con ligeras variaciones de formato.

**Fix propuesto:** Exportar `STATUS_LABELS`, `PRIORITY_LABELS`, `STATUS_OPTIONS` desde Case.js. Crear un util `formatDate()` en una utilidad compartida.

---

### 12 — Cambio de filtro no tiene debounce

**Categoría:** Rendimiento  
**Severidad:** Media  
**Esfuerzo:** S

**Archivos:** `CaseFiltersBar.vue` L35-37

**Causa raiz:**

```js
function setFilter(key, value) {
  store.loadCases({ [key]: value })
}
```

Cada click en un chip o cambio de select dispara inmediatamente `loadCases`. Si el usuario clickea "Asignados" y luego "En progreso" en rápida sucesión, ambas peticiones se lanzan. No hay cancelación de la primera ni debounce.

**Por qué importa:** Peticiones innecesarias al backend. La segunda respuesta puede llegar antes que la primera, causando un flash de datos incorrectos.

**Fix propuesto:** Debounce de ~150ms en `loadCases`, o usar AbortController para cancelar peticiones previas.

---

### 13 — No hay update optimista para cambio de estado

**Categoría:** UX  
**Severidad:** Media  
**Esfuerzo:** M

**Archivos:** `useCasesStore.js` L176-196

**Causa raiz:**

```js
async function updateCaseStatus(id, status) {
  error.value = null
  try {
    const updated = await updateCaseStatusUseCase(id, status)
    // UI solo se actualiza aquí, tras la respuesta del backend
    ...
  }
}
```

No hay feedback visual inmediato. El usuario cambia el select a "Resuelto" y espera ~200-500ms hasta que el backend responda antes de que la UI refleje el cambio.

**Fix propuesto:** Aplicar el nuevo estado al case local inmediatamente, revertir si el backend falla (mismo patrón optimista que usa el calendario).

---

### 14 — `waitingTime` es estático

**Categoría:** UX  
**Severidad:** Media  
**Esfuerzo:** S

**Archivos:** `Case.js` L98-108, `CaseListTable.vue` L67

**Causa raiz:**

`waitingTime` es un getter que usa `Date.now()`. Vue no puede rastrear `Date.now()` como dependencia reactiva. El valor se computa una vez cuando el template se renderiza y nunca cambia hasta el próximo re-render completo.

Un caso abierto hace "5m" seguirá mostrando "5m" indefinidamente a menos que el usuario cambie de pestaña y vuelva.

**Fix propuesto:** Un `ref(Date.now())` actualizado con `setInterval(60000)` en el store o en CaseListTable, que fuerce re-render del getter.

---

### 15 — `loadCaseById` se llama 2 veces tras asignación exitosa

**Categoría:** Rendimiento  
**Severidad:** Media  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L198-216, `CaseDetailModal.vue` L20-23

**Causa raiz:**

Flujo de asignación:
1. `store.assignWdd(payload)` → internamente llama `await loadCaseById(payload.caseId)` (fetch #1)
2. Retorna → CaseAssignPanel emits `done`
3. CaseDetailModal.onAssignDone → `store.loadCaseById(c.value.id)` (fetch #2, idéntico)

Dos requests GET `/cases/:id` seguidos para el mismo caso.

**Fix propuesto:** Eliminar el `loadCaseById` de dentro de `assignWdd`/`assignManual` (ya que el caller lo hace), o eliminar el del callback `onAssignDone`.

---

### 16 — MAX_LOAD hardcodeado a 10 en CaseLoadsView

**Categoría:** Calidad  
**Severidad:** Media  
**Esfuerzo:** S

**Archivos:** `CaseLoadsView.vue` L11

**Causa raiz:**

```js
const MAX_LOAD = 10
```

La barra de carga asume que todo especialista tiene un máximo de 10 casos. Si un especialista tiene `opening_count: 20` en su ventana de trabajo, la barra se satura al 100% con solo 10 casos.

**Fix propuesto:** El endpoint de workloads debería retornar `opening_count` (máximo de la ventana activa) por especialista. Usar ese valor en vez del hardcoded.

---

### 17 — Tabla de casos no es navegable por teclado

**Categoría:** Accesibilidad  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `CaseListTable.vue` L48

**Causa raiz:**

```html
<tr v-for="(c, idx) in store.cases" :key="c.id" class="ct__row" @click="selectCase(idx)">
```

Los `<tr>` son clickables pero no tienen `tabindex="0"`, `role="button"`, ni handler de `@keydown.enter`. Un usuario de teclado no puede navegar ni seleccionar filas.

**Fix propuesto:** Agregar `tabindex="0"` y `@keydown.enter="selectCase(idx)"` a cada fila.

---

### 18 — Tabs sin semántica ARIA

**Categoría:** Accesibilidad  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `CasosView.vue` L35-49

**Causa raiz:**

Los tabs usan `<button>` planos con class condicional. No hay `role="tablist"` en el contenedor, `role="tab"` en los botones, `aria-selected` para el estado activo, ni `role="tabpanel"` en el contenido.

**Fix propuesto:** Agregar los roles ARIA estándar para tabs.

---

### 19 — CaseCreateModal no cierra con Escape

**Categoría:** Accesibilidad  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `CaseCreateModal.vue` L101

**Causa raiz:**

CaseDetailModal tiene `@keydown` en el overlay (L73) que cierra con Escape. CaseCreateModal no tiene este handler.

**Fix propuesto:** Agregar `@keydown.esc="close"` y `tabindex="-1"` al overlay, con focus automático.

---

### 20 — Modales no atrapan foco (focus trap)

**Categoría:** Accesibilidad  
**Severidad:** Baja  
**Esfuerzo:** M

**Archivos:** `CaseDetailModal.vue`, `CaseCreateModal.vue`

**Causa raiz:**

CaseDetailModal recibe focus en mount (L60-61), pero no hay focus trap. El usuario puede tab fuera del modal hacia elementos del background, que están visualmente ocultos por el overlay pero siguen en el tab order.

**Fix propuesto:** Implementar un composable `useFocusTrap(containerRef)` reutilizable, o usar una librería como `@vueuse/core` `useFocusTrap`.

---

### 21 — Cambio de estado no pide confirmación

**Categoría:** UX  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `CaseDetailModal.vue` L134, `CaseDetailView.vue` L122

**Causa raiz:**

```html
<select :value="c.status" @change="changeStatus($event.target.value)">
```

Un misclick en "Cerrado" ejecuta inmediatamente `updateCaseStatus()` sin confirmación. No hay forma de deshacer un cambio de estado involuntario.

**Fix propuesto:** Para estados terminales (`resolved`, `closed`) mostrar un confirm dialog antes de ejecutar.

---

### 22 — CaseCreateModal cierra con setTimeout(800) hardcodeado

**Categoría:** UX  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `CaseCreateModal.vue` L82

**Causa raiz:**

```js
feedback.value = { type: 'success', text: 'Caso creado exitosamente.' }
setTimeout(() => store.showCreateModal = false, 800)
```

El modal muestra "éxito" durante 800ms y luego cierra automáticamente. Durante esos 800ms el usuario no puede cerrar manualmente ni interactuar. Si la red es lenta y la siguiente operación tarda, el modal ya cerró sin que el usuario vea el resultado.

**Fix propuesto:** Cerrar inmediatamente o dejar que el usuario cierre manualmente tras ver el feedback.

---

### 23 — Errores de workloads silenciados

**Categoría:** Calidad  
**Severidad:** Baja  
**Esfuerzo:** S

**Archivos:** `useCasesStore.js` L263

**Causa raiz:**

```js
async function loadWorkloads(applicationId) {
  const cached = _workloadCache.get(applicationId)
  if (cached) specialistWorkloads.value = cached
  try {
    const fresh = await fetchSpecialistWorkloadsUseCase(applicationId)
    specialistWorkloads.value = fresh
    _workloadCache.set(applicationId, fresh)
  } catch { /* silent */ }
}
```

Si el endpoint falla y no hay cache, el usuario ve un estado vacío ("No hay datos de carga") sin saber que hubo un error. Si hay cache, ve datos potencialmente muy stale sin indicación.

**Fix propuesto:** Al menos loguear el error. Idealmente, un `workloadsError` ref que CaseLoadsView pueda mostrar.

---

### 24 — Cache de SyncEngine solo guarda la página actual

**Categoría:** Rendimiento  
**Severidad:** Baja  
**Esfuerzo:** M

**Archivos:** `useCasesStore.js` L77

**Causa raiz:**

```js
casesSync.replaceAll(cases, result.data) // reemplaza todo el cache con la página actual
```

Al navegar a página 2, el cache pierde los datos de página 1. Volver a página 1 requiere un full fetch. Esto es inherente al uso de SyncEngine con datos paginados — el engine no fue diseñado para esto.

**Impacto:** Bajo. La navegación entre páginas siempre requiere fetch, y con la mejora B1 el spinner no aparece si hay datos en el ref (aunque sean de la página anterior — lo cual es un mini-flash de datos incorrectos).

**Fix propuesto:** Aceptar la limitación o migrar a un patrón de cache por (filters+page) key. Probablemente no vale la pena el esfuerzo.

---

## Resumen por categoría

### Prioridad 1 — Fix inmediato
- **#01** (Critica): RT destruye datos de Case. Cada evento WS corrompe el caso en la lista. Fix simple: agregar `_toRaw()` a Case y usarlo en todos los RT handlers.

### Prioridad 2 — Corregir pronto
- **#02, #03**: RT handlers incompletos. Fácil de arreglar junto con #01.
- **#04**: Error compartido. Requiere separar refs.
- **#05**: Workloads del app incorrecto. Requiere que el assign panel cargue workloads del app del caso.
- **#06, #07**: Violaciones de arquitectura. Refactoring simple pero tocando imports.

### Prioridad 3 — Mejoras de calidad
- **#09, #10, #11**: Duplicación. Composables compartidos.
- **#08**: Decisión de diseño sobre SWR.
- **#12-#16**: UX y rendimiento incrementales.

### Prioridad 4 — Polish
- **#17-#24**: Accesibilidad, UX minor, edge cases.
