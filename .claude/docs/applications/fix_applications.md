```markdown
# Refactor Módulo Applications — TyFlowVue

## Contexto del proyecto
Vue 3 + Vite + Pinia + Vue Router. Clean Architecture de 4 capas:
`View → Store → UseCase → Repository → HTTP Client`

Stack: Vue 3 Composition API (`<script setup>`), Pinia, Vue Router, Axios.
Sin librerías de componentes externas. CSS con variables de `tokens.css`.
UI en español. Todos los componentes siguen el patrón `<script setup>` +
`<template>` + `<style scoped>`.

## Regla de trabajo obligatoria
**Nunca declares algo como "listo" hasta haber**:
1. Leído el archivo modificado completo después de escribirlo.
2. Trazado el flujo completo desde la vista hasta la API y de vuelta.
3. Verificado que no rompiste ningún otro módulo que use los mismos stores o componentes.
4. Corrido `npm run build` y confirmado que compila sin errores.
5. Si encuentras un error al verificar, corrígelo y vuelve a verificar desde el paso 1.
No asumas que algo funciona si no lo has comprobado explícitamente.

---

## Paso 0 — Lectura y auditoría previa (no toques código aún)

Lee completamente estos archivos antes de escribir una sola línea:

**Vistas y componentes actuales:**
- `src/presentation/views/ApplicationsView.vue`
- `src/presentation/views/ApplicationDetailView.vue`
- `src/presentation/components/ApplicationCard.vue`
- `src/presentation/components/ApplicationDetail.vue` ← componente huérfano
- `src/presentation/components/FolderTree.vue`
- `src/presentation/components/FolderTreeNode.vue`
- `src/presentation/components/CreateFolderModal.vue`
- `src/presentation/components/CreateApplicationModal.vue`

**Capa de aplicación:**
- `src/application/use-cases/applications/*.js` (todos)
- `src/application/use-cases/folders/*.js` (todos)

**Infraestructura:**
- `src/infrastructure/repositories/ApplicationRepository.js`
- `src/infrastructure/repositories/FolderRepository.js`
- `src/infrastructure/repositories/SpecialistRepository.js`

**Dominio:**
- `src/domain/entities/Folder.js`
- `src/domain/entities/User.js`

**Store y router:**
- `src/presentation/stores/useUserStore.js`
- `src/router/index.js`

**Estilos base:**
- `src/styles/tokens.css`
- `src/styles/utilities.css`

Reporta lo que encontraste antes de continuar:
- ¿Qué endpoints existen para applications y folders en el backend?
- ¿Existe `GET /applications/:id`?
- ¿El endpoint de folders acepta `specialist_id` heredado del padre?
- ¿Qué campos son obligatorios vs opcionales en POST /folders?
- ¿Qué hace exactamente `ApplicationDetail.vue` vs `ApplicationDetailView.vue`?

---

## Paso 1 — Crear la entidad de dominio `Application`

Actualmente `ApplicationRepository` devuelve el objeto raw de la API sin mapear.
Todos los demás aggregates tienen entidad propia. Crea:

**`src/domain/entities/Application.js`**
```js
export class Application {
  constructor({ id, name, theme = null, created_at = null }) {
    this.id = id
    this.name = name
    this.theme = theme || { color: null }
    this.createdAt = created_at
  }

  get color() {
    return this.theme?.color || null
  }
}
```

Actualiza `ApplicationRepository.js` para mapear todas las respuestas
a instancias de `Application`. Elimina el import de `User` que existe en ese
repositorio — un repositorio de Application no debe conocer la entidad User.

Para `fetchSpecialists`, mueve esa responsabilidad a `UserRepository`:
```js
// UserRepository.js — añadir método
async fetchByApplication(applicationId) {
  const { data } = await client.get('/users', {
    params: { is_specialist: true, application_ids: applicationId }
  })
  const items = Array.isArray(data) ? data : data.data ?? []
  return items.map(item => new User(item))
}
```

Crea el use case correspondiente:
`src/application/use-cases/applications/FetchApplicationSpecialistsUseCase.js`
que use `UserRepository.fetchByApplication`.

---

## Paso 2 — Crear `useApplicationStore`

Actualmente no existe un store dedicado. Toda la data se recarga en cada
visita porque vive en el estado local de las vistas.

Crea **`src/presentation/stores/useApplicationStore.js`**:

```js
// Estado que debe manejar:
{
  applications: [],           // Application[] — cargadas una vez, cache
  foldersMap: {},             // { [appId]: Folder[] } — cache por app
  specialistsMap: {},         // { [appId]: User[] } — cache por app
  selectedAppId: null,        // app actualmente activa en el panel izq.
  selectedFolderId: null,     // folder actualmente activo
  expandedAppIds: Set,        // qué apps tienen el árbol expandido
  loading: false,
  loadingFolders: false,
  error: null,
}
```

**Acciones del store:**
- `loadApplications()` — carga la lista una sola vez, no recarga si ya existe.
  Fuerza recarga solo si se llama con `{ force: true }`.
- `loadFolders(appId)` — carga folders de una app específica, cachea en `foldersMap`.
  Si ya están en cache, no hace request.
- `loadSpecialists(appId)` — igual, cachea en `specialistsMap`.
- `selectApp(appId)` — setea `selectedAppId`, carga folders y specialists si no están
  en cache.
- `selectFolder(folderId)` — setea `selectedFolderId`.
- `toggleExpandApp(appId)` — add/remove de `expandedAppIds`.
- `createApplication(name)` — crea y añade al array local.
- `updateApplication(id, payload)` — actualiza en el array local (incluido color).
- `deleteApplication(id)` — elimina del array local y limpia su cache.
- `createFolder(appId, data)` — crea y añade al `foldersMap[appId]`.
- `updateFolder(appId, folderId, data)` — actualiza en `foldersMap[appId]`.
- `deleteFolder(appId, folderId)` — elimina de `foldersMap[appId]`.
- `assignSpecialist(appId, user)` — añade a `specialistsMap[appId]`.
- `removeSpecialist(appId, userId)` — elimina de `specialistsMap[appId]`.
- `invalidateApp(appId)` — limpia el cache de folders y specialists de esa app.

**Regla importante**: todas las acciones que llaman a la API deben hacerlo a través
de use cases, nunca directamente al repositorio desde el store.

---

## Paso 3 — Nuevo layout de la ruta `/app/applications`

### 3.1 Eliminar la ruta `/app/applications/:id`

Del router, elimina la ruta `application-detail`. Todo ocurre en `/app/applications`.

### 3.2 Rediseñar `ApplicationsView.vue`

El nuevo layout es un **split panel de dos columnas**:

```
┌─────────────────────┬────────────────────────────────────────┐
│  Panel izquierdo    │  Panel derecho (reservado)             │
│  (árbol + gestión)  │                                        │
│                     │   Ícono placeholder                    │
│  [contenido abajo]  │   "Selecciona una carpeta para ver     │
│                     │    las conversaciones"                  │
│                     │                                        │
│                     │   (Este panel se llenará cuando se     │
│                     │    implemente el módulo de correos)    │
└─────────────────────┴────────────────────────────────────────┘
```

- Panel izquierdo: `width: 320px`, fijo, con scroll vertical propio.
- Panel derecho: `flex: 1`, placeholder por ahora.
- En mobile (< 768px): solo se muestra el panel izquierdo a pantalla completa.
- El split debe ser responsivo pero NO arrastrable (YAGNI).

### 3.3 Contenido del panel izquierdo

```
┌─────────────────────────────────┐
│ [🔍 Buscar aplicación...]       │
│ [+ Nueva Aplicación]            │
├─────────────────────────────────┤
│ 📦 App 1                    [⋯] │
│   📁 Nivel Tier 1               │
│     👤 Juan García          [⋯] │
│       📂 Subcarpeta A       [⋯] │
│       📂 Subcarpeta B       [⋯] │
│       [+ Nueva subcarpeta]      │
│     👤 María López          [⋯] │
│   📁 Nivel Tier 2               │
│   [+ Nueva carpeta]             │
│                                 │
│ 📦 App 2                    [⋯] │
│ 📦 App 3                    [⋯] │
└─────────────────────────────────┘
```

- Cada app puede expandirse/colapsarse con click.
- El árbol de folders se carga lazy: solo cuando se expande la app.
- El nodo activo (`selectedFolderId`) se resalta visualmente.
- `[⋯]` es un menú contextual (tres puntos) con acciones según el tipo de nodo.
- `[+ Nueva carpeta/subcarpeta]` aparece inline como último elemento del nivel.

### 3.4 Menús contextuales por tipo de nodo

**App** `[⋯]`:
- Renombrar
- Cambiar color
- Gestionar especialistas
- Eliminar

**Folder `main_box`** `[⋯]`:
- Renombrar
- Nueva subcarpeta (level)
- Eliminar

**Folder `level`** `[⋯]`:
- Renombrar
- Nuevo specialist en este nivel
- Eliminar

**Folder `specialist`** `[⋯]`:
- Renombrar
- Nueva subcarpeta (hereda specialist)
- Eliminar

**Subfolder de specialist** `[⋯]`:
- Renombrar
- Eliminar

Implementa el menú contextual como un componente pequeño reutilizable:
`src/presentation/components/ContextMenu.vue`

---

## Paso 4 — Rediseñar `FolderTreeNode.vue`

El componente actual mezcla demasiadas responsabilidades. Rediseñalo para:

- Recibir `node`, `depth`, `selectedFolderId`, `specialists`, `supportLevels`.
- Emitir solo: `select(node)`, `action(type, node)`.
  Donde `type` es: `rename | add-child | delete`.
- No manejar estado de edición inline dentro del nodo. El rename se maneja
  con un modal simple desde el padre.
- Mostrar el ícono correcto según `node.type`:
  - `main_box` → `bx-inbox` color `#2AC78F`
  - `level` → `bx-layer` color `#607dea` + nombre del SupportLevel asociado
  - `specialist` → `bx-user` color `#f59e0b` + nombre del especialista asociado
  - subfolder de specialist → `bx-folder` color `#94a3b8`
- Mostrar el nodo activo con fondo resaltado.
- El botón `[+ Nueva subcarpeta]` al final de los hijos debe emitir
  `action('add-child', node)`.

---

## Paso 5 — Regla de herencia de `specialist_id` en subfolders

### 5.1 Lógica de contexto al crear folder

Cuando el usuario hace click en `[+ Nueva subcarpeta]` desde un nodo `specialist`,
el sistema debe saber automáticamente:
- `type` = `specialist`
- `parent_folder_id` = id del nodo padre
- `specialist_id` = `specialistId` del nodo padre (heredado)
- El usuario **solo escribe el nombre**

Cuando se hace desde un nodo `main_box`:
- `type` = `level`
- El usuario selecciona qué `SupportLevel` asociar
- El usuario escribe el nombre

Cuando se hace desde un nodo `level`:
- `type` = `specialist`
- El usuario selecciona qué especialista de los disponibles en esa app
- El usuario escribe el nombre

### 5.2 Refactor de `CreateFolderModal.vue`

El modal actual muestra todos los campos siempre. Refactorizalo para recibir
un prop `context` que pre-configura el modo:

```js
// Contextos posibles:
{ mode: 'new-app-folder' }                           // main_box bajo una app
{ mode: 'new-level', parentId: 'xxx' }              // level bajo main_box
{ mode: 'new-specialist', parentId: 'xxx',           // specialist bajo level
  availableSpecialists: [...] }
{ mode: 'new-subfolder', parentId: 'xxx',            // subfolder bajo specialist
  specialistId: 'yyy' }                              // specialist_id heredado
```

En modo `new-subfolder` el modal es mínimo: solo un input de nombre y botón crear.
En otros modos muestra los campos relevantes para ese contexto.

### 5.3 `CreateFolderUseCase` — validar herencia

```js
export async function createFolderUseCase({ mode, applicationId, ...data }) {
  // Validaciones según modo
  if (mode === 'new-subfolder' && !data.specialistId) {
    throw new DomainError('Una subcarpeta de especialista requiere specialist_id')
  }
  if (mode === 'new-level' && !data.supportLevelId) {
    throw new DomainError('Un nivel requiere un SupportLevel asociado')
  }
  // ... etc
  return FolderRepository.create({ application_id: applicationId, ...data })
}
```

---

## Paso 6 — Eliminar código muerto y unificar

### 6.1 Eliminar `ApplicationDetailView.vue`

Esta vista queda obsoleta con el nuevo diseño. Antes de eliminarla:
1. Revisa si algún componente o use case que usa importa desde ella.
2. Extrae cualquier lógica que no esté cubierta por el nuevo diseño.
3. Elimínala del router y del disco.

### 6.2 Eliminar `ApplicationDetail.vue`

Mismo proceso. Es un componente huérfano que duplica lógica de la vista eliminada.

### 6.3 Eliminar `ApplicationCard.vue` si ya no se usa

Con el nuevo diseño de árbol ya no hay grid de cards. Si el componente
ya no se referencia en ningún lugar, elimínalo.

### 6.4 Unificar gestión de especialistas

Actualmente la asignación de especialistas está en `ApplicationDetailView` y en
`ApplicationDetail.vue` (duplicada). En el nuevo diseño, la gestión de especialistas
de una app se hace desde el menú contextual `[⋯]` de la app, que abre un modal:

`src/presentation/components/ManageSpecialistsModal.vue`

Este modal es el único lugar donde se asignan/remueven especialistas de una app.

---

## Paso 7 — Enriquecer use cases de Applications

Ningún use case actual tiene validación. Añade:

**`CreateApplicationUseCase`:**
- Validar que `name` no esté vacío ni sea solo espacios.
- Validar longitud máxima razonable (ej. 100 chars).

**`UpdateApplicationUseCase`:**
- Si el payload incluye `theme.color`, validar que sea un color hex válido.

**`DeleteApplicationUseCase`:**
- No hay validación posible en frontend antes del delete. Dejar el error
  del backend propagarse como `DomainError` descriptivo.

**`CreateFolderUseCase`:**
- Ver Paso 5.3

**`UpdateFolderUseCase`:**
- Validar que `name` no esté vacío si se está renombrando.

---

## Paso 8 — Panel derecho: placeholder de Conversations

Crea **`src/presentation/components/ConversationsPlaceholder.vue`**:

```
┌────────────────────────────────────────┐
│                                        │
│           [ícono bx-envelope-open]     │
│                                        │
│    Selecciona una carpeta              │
│    para ver sus conversaciones         │
│                                        │
│    Próximamente: los correos           │
│    extraídos de cada carpeta           │
│    aparecerán aquí                     │
│                                        │
└────────────────────────────────────────┘
```

- Estilo sutil, sin llamar demasiado la atención.
- Usar las variables de color de `tokens.css`.
- Este componente **nunca debe tener lógica** — es puramente presentacional.
- Debe recibir opcionalmente un prop `selectedFolder` para en el futuro
  poder mostrar el nombre de la carpeta seleccionada en el placeholder.
- La prop es opcional hoy — cuando se implemente Conversations, el padre
  reemplazará este componente por el real sin tocar nada más.

---

## Paso 9 — Verificación final integral

Ejecuta esta checklist en orden. No marques nada sin haberlo probado:

### Build
```bash
npm run build
# Sin errores. Warnings de librerías externas son aceptables.
# Warnings del código propio deben corregirse.
```

### Arquitectura
- [ ] Existe `src/domain/entities/Application.js` y `ApplicationRepository` la usa.
- [ ] `ApplicationRepository` no importa `User`.
- [ ] `UserRepository` tiene `fetchByApplication(appId)`.
- [ ] Existe `useApplicationStore` con cache por app.
- [ ] `ApplicationsView` no importa nada de `@/domain/` ni `@/infrastructure/`.
- [ ] La ruta `/app/applications/:id` ya no existe en el router.
- [ ] `ApplicationDetailView.vue` eliminado del disco.
- [ ] `ApplicationDetail.vue` eliminado del disco.

### Cache y rendimiento
- [ ] Al entrar a `/app/applications` por primera vez → 1 request a `/applications`.
- [ ] Al expandir App 1 → request a `/folders?application_id=xxx` y `/users?...`.
- [ ] Al colapsar y volver a expandir App 1 → **no hay nuevo request** (usa cache).
- [ ] Al navegar a otra ruta y volver → **no hay requests** si el cache existe.
- [ ] Al crear una nueva app → aparece en el árbol sin recargar todo.
- [ ] Al eliminar una app → desaparece del árbol sin recargar todo.

### Árbol de folders
- [ ] Las apps se expanden/colapsan correctamente.
- [ ] El nodo seleccionado se resalta visualmente.
- [ ] Crear folder `main_box` bajo una app → aparece en el árbol.
- [ ] Crear folder `level` bajo `main_box` → muestra nombre del SupportLevel.
- [ ] Crear folder `specialist` bajo `level` → muestra nombre del especialista.
- [ ] Crear subfolder bajo `specialist` → `specialist_id` se hereda automáticamente.
- [ ] El modal de crear subfolder de specialist solo pide nombre.
- [ ] Renombrar cualquier nodo → se actualiza en el árbol sin recargar.
- [ ] Eliminar un folder con confirmación → desaparece del árbol.

### Gestión de especialistas
- [ ] Menú contextual `[⋯]` de una app tiene opción "Gestionar especialistas".
- [ ] Modal de especialistas muestra los asignados a esa app.
- [ ] Asignar un especialista → aparece en la lista sin recargar.
- [ ] Remover un especialista → desaparece de la lista sin recargar.

### Panel derecho
- [ ] El placeholder de Conversations es visible al cargar la vista.
- [ ] El placeholder recibe `selectedFolder` sin errores.
- [ ] En mobile (< 768px) el panel derecho no es visible.

### UX general
- [ ] Buscar en el panel izquierdo filtra las apps correctamente.
- [ ] Cambiar el color de una app → se actualiza visualmente en el árbol inmediatamente.
- [ ] Crear nueva app → aparece en el árbol y queda seleccionada/expandida.
- [ ] Menús contextuales se cierran al hacer click fuera de ellos.
- [ ] Todos los errores de API muestran toast descriptivo.
- [ ] No hay `console.error` sin capturar en ningún flujo normal.

---

## Notas finales

- No introduzcas dependencias npm nuevas sin justificación explícita.
- Mantén los textos en español.
- Si al leer el backend en el Paso 0 descubres que algún endpoint no existe
  (por ejemplo `GET /applications/:id`), adáptate a lo que existe y documenta
  el workaround con un comentario `// TODO: reemplazar cuando exista GET /applications/:id`.
- Si algo del diseño propuesto aquí contradice una restricción real del backend
  que descubres en el Paso 0, reporta el conflicto antes de implementar y
  propone la alternativa más cercana posible.
```