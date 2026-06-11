# SyncEngine

Motor de sincronizacion que mantiene los datos de la aplicacion coordinados entre tres capas: el **cache** del navegador (localStorage), el **estado reactivo** de Vue (Pinia) y el **backend** (REST API).

---

## Parte 1 — Guia conceptual

### El problema que resuelve

Cuando un usuario abre TyFlow, necesita ver datos de inmediato — no esperar a que el backend responda. Al mismo tiempo, si otro usuario modifica algo, esos cambios deben llegar sin pisar lo que el usuario actual esta editando.

SyncEngine coordina esto con tres ideas simples:

1. **Cache-first**: al abrir la app, muestra datos guardados en el navegador al instante.
2. **Sync en background**: mientras el usuario ya trabaja, pide datos frescos al backend y los mezcla.
3. **Proteccion optimista**: si el usuario acaba de hacer un cambio local, ese cambio no se pisa durante la mezcla.

### Analogia: la pizarra compartida

Imagina una pizarra donde varios colegas escriben notas.

- Cada persona tiene una **foto de la pizarra** en su telefono (= cache).
- Al llegar a la oficina, miras tu foto para recordar donde estabas (= `loadFromCache`).
- Luego caminas a la pizarra real y comparas (= `syncInBackground`).
- Si alguien escribio algo nuevo, actualizas tu foto.
- Pero si TU acabas de escribir algo hace segundos, no dejas que la foto vieja de otro lo borre — tu nota reciente tiene prioridad (= proteccion LWW).

### Ciclo de vida tipico

```
1. INICIO DE LA APP
   ┌──────────────┐
   │ localStorage │──► Pinia state ──► UI lista al instante
   └──────────────┘

2. SYNC EN BACKGROUND (segundos despues)
   Backend ──► merge con state local ──► actualiza UI + cache

3. USUARIO HACE UN CAMBIO
   UI ──► state + cache (optimista) ──► Backend (confirma)
   El cambio local queda "protegido" por 30s para que el proximo sync no lo pise.
```

### Ejemplo paso a paso

Supongamos que el store de usuarios usa SyncEngine:

```js
// 1. Crear el engine
const usersSync = new SyncEngine({
  cacheKey:    'tyflow_users_v3',           // clave en localStorage
  hydrate:     (raw) => new User(raw),      // convierte objetos planos en entidades
  fetchRemote: () => fetchUsersUseCase(),   // como pedir datos al backend
  getId:       (u) => u.id,                 // como identificar cada registro
  syncTtlMs:   60_000,                      // no re-sincronizar antes de 1 minuto
})

// 2. Inicializar el state desde cache
const users = ref(usersSync.loadFromCache())
// La UI ya puede mostrar datos (aunque sean de la sesion anterior)

// 3. Sincronizar con el backend
await usersSync.syncInBackground(users)
// Ahora los datos estan frescos. Si habia cambios locales recientes, se preservaron.

// 4. El usuario activa/desactiva un usuario
const updated = await toggleUserStatusUseCase(userId, true)
usersSync.updateLocal(users, userId, new User(updated))
// El cambio se refleja al instante en la UI y en cache.
// Queda marcado con _localUpdatedAt para que el proximo sync no lo pise.
```

### Que pasa si el sync falla?

Nada visible. El engine captura el error silenciosamente y la UI sigue funcionando con los datos del cache. El proximo intento de sync reintentara.

### Que pasa si dos tabs estan abiertos?

Cada tab tiene su propia instancia de SyncEngine. Ambas leen del mismo localStorage, pero las escrituras no se sincronizan entre tabs en tiempo real — eso lo cubren los eventos WebSocket, no el SyncEngine.

---

## Parte 2 — Referencia tecnica

### Constructor

```js
new SyncEngine({ cacheKey, hydrate, fetchRemote, getId, recentWindowMs, syncTtlMs })
```

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `cacheKey` | `string \| null` | — | Clave de localStorage. Si es `null`, el engine opera sin persistencia (session-only). |
| `hydrate` | `(raw: Object) => Entity` | — | Funcion que convierte un objeto plano del cache/API en una instancia de entidad. |
| `fetchRemote` | `() => Promise<Entity[]>` | — | Funcion que obtiene datos frescos del backend. Puede ser `null` si se asigna dinamicamente. |
| `getId` | `(item: Entity) => string` | — | Extrae el identificador unico de un item. Soporta claves compuestas (ej: `` `${a}\|${b}` ``). |
| `recentWindowMs` | `number` | `30000` | Ventana de proteccion LWW en milisegundos. Cambios locales dentro de esta ventana ganan sobre el backend. |
| `syncTtlMs` | `number` | `300000` | Tiempo minimo entre syncs automaticos. Previene requests redundantes. |

### Estado interno

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `_syncPromise` | `Promise \| null` | Si hay un sync en vuelo, todos los callers esperan este mismo promise (deduplicacion). |
| `_lastSyncAt` | `number \| null` | Timestamp del ultimo sync exitoso. Se usa para evaluar el TTL. |

---

### Metodos publicos

#### Cache

| Metodo | Retorna | Descripcion |
|--------|---------|-------------|
| `loadFromCache()` | `Entity[]` | Lee localStorage, parsea el JSON y rehidrata cada objeto con `hydrate()`. Retorna `[]` si no hay cache o `cacheKey` es null. |
| `writeToCache(items)` | `void` | Serializa el array con `JSON.stringify` y lo guarda en localStorage. Las entidades **deben** implementar `toJSON()` que retorne snake_case, o el cache se corrompe al rehidratar. |
| `clearCache()` | `void` | Elimina la entrada de localStorage. |

#### Sincronizacion

| Metodo | Retorna | Descripcion |
|--------|---------|-------------|
| `syncInBackground(stateRef, { force? })` | `Promise<void>` | Fetch + merge + update state. Respeta TTL y deduplica requests concurrentes. Con `force: true` ignora el TTL. |
| `forceSync(stateRef)` | `Promise<void>` | Atajo para `syncInBackground` con `force: true` y TTL reseteado. Usar despues de mutaciones que necesitan datos confirmados del backend. |
| `merge(local, remote)` | `Entity[]` | Aplica la reconciliacion LWW. Ver seccion CRDT mas abajo. |

#### Mutaciones locales

| Metodo | Retorna | Descripcion |
|--------|---------|-------------|
| `updateLocal(stateRef, id, updated)` | `Entity` | Reemplaza un item por ID en el state. Lo marca con `_localUpdatedAt` para proteccion CRDT. Si el ID no existe, lo agrega al final. |
| `insertLocal(stateRef, item)` | `Entity` | Inserta un item al inicio del array. Lo marca con `_localUpdatedAt`. |
| `removeLocal(stateRef, id)` | `boolean` | Elimina un item por ID. Retorna `true` si existia. |
| `replaceAll(stateRef, items)` | `void` | Reemplaza todo el state sin marcadores CRDT. Usar cuando se reciben datos completos y confirmados. |

---

### Algoritmo CRDT: Last-Write-Wins (LWW)

El merge ocurre en `merge(local, remote)` y sigue estas reglas:

```
PARA CADA item en remote:
  buscar contraparte local por getId()

  SI local existe Y tiene _localUpdatedAt:
    edad = ahora - _localUpdatedAt

    SI edad < recentWindowMs (30s default):
      → LOCAL GANA (cambio reciente, el backend aun no lo refleja)
    SINO:
      → REMOTO GANA (el cambio local ya es viejo)

  SINO:
    → REMOTO GANA (no hubo cambio local)

Items que SOLO existen en local se DESCARTAN.
  (el backend es la fuente canonica de existencia)
```

#### Diagrama de decision

```
                    remoteItem
                        │
            ┌───────────┴───────────┐
            │ existe localItem?     │
            └───┬───────────────┬───┘
               SI              NO
                │               │
     ┌──────────┴──────────┐    │
     │ _localUpdatedAt     │    │
     │ < 30s ?             │    │
     └──┬──────────────┬───┘    │
       SI             NO        │
        │              │        │
   LOCAL GANA    REMOTO GANA  REMOTO GANA
```

#### Por que no es un CRDT academico completo

| Caracteristica | CRDT formal | SyncEngine |
|---------------|-------------|------------|
| Ordenamiento causal | Vector clocks | Timestamp local simple |
| Granularidad de merge | Campo por campo | Entidad completa (todo-o-nada) |
| Tombstones para deletes | Si | No — los items solo-locales se descartan |
| Convergencia garantizada | Si | Eventual (con ventana de 30s de gracia) |
| Multi-peer | Si | Solo cliente ↔ backend (2 nodos) |

Es una estrategia de **proteccion optimista** practica: evita que el backend pise un cambio que el usuario acaba de hacer, durante los segundos que tarda la confirmacion.

---

### Contrato con las entidades

Para que el ciclo `writeToCache` → `loadFromCache` funcione correctamente, cada entidad que pase por SyncEngine **debe** cumplir:

1. **`toJSON()`** — Debe retornar un objeto con claves en **snake_case** que coincidan con los parametros del constructor. Sin esto, `JSON.stringify` serializa propiedades camelCase que el constructor no reconoce, produciendo datos rotos al rehidratar.

2. **`withLocalUpdate()`** (opcional) — Si existe, `_markLocal()` la usa para crear una copia con `_localUpdatedAt`. Si no existe, se hace una copia shallow automatica.

3. **Constructor basado en snake_case** — El constructor debe aceptar un objeto con claves snake_case (como las retorna la API y `toJSON()`).

Ejemplo correcto:

```js
class User {
  constructor({ id, first_name, is_active = true }) {
    this.id = id
    this.firstName = first_name
    this.isActive = is_active
  }

  toJSON() { return this._toRaw() }

  _toRaw() {
    return {
      id: this.id,
      first_name: this.firstName,
      is_active: this.isActive,
    }
  }

  withLocalUpdate() {
    const copy = new User(this._toRaw())
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
```

---

### Instancias activas en TyFlow

| Store | Variable | cacheKey | Entity | syncTtlMs | Notas |
|-------|----------|----------|--------|-----------|-------|
| `useUserStore` | `usersSync` | `tyflow_users_v3` | `User` | 60s | Usuarios cambian frecuentemente |
| `useUserStore` | `appSync` | `tyflow_applications_v3` | `Application` | 5min | Aplicaciones cambian poco |
| `useCalendarStore` | `_sync` | `tyflow_work_windows` | `WorkWindow` | 5min | Fetch por rango, no usa `fetchRemote` global |
| `useCasesStore` | `casesSync` | `tyflow_cases_v2` | `Case` | 5min | `fetchRemote` se asigna dinamicamente por filtro |
| `useCasesStore` | `workloadSync` | `null` | plain object | — | Session-only, sin persistencia |
| `useCasesStore` | `allWorkloadsSync` | `null` | plain object | — | Session-only, ID compuesto |
| `useCasesStore` | `cargasCasesSync` | `null` | `Case` | — | Session-only |
| `useConversationStore` | (dinamico) | `tyflow_conversations_v2_{folderId}` | `Conversation` | 5min | Se recrea por folder |

---

### Patrones comunes

#### Sync transparente al cargar datos

```js
async function loadUsers({ force = false } = {}) {
  loading.value = true
  try {
    await usersSync.syncInBackground(users, { force })
  } finally {
    loading.value = false
  }
}
```

El SyncEngine decide internamente si necesita ir al backend o si el cache es suficiente.

#### Mutacion optimista con proteccion

```js
async function toggleStatus(userId) {
  const updated = await toggleUserStatusUseCase(userId, currentStatus)
  usersSync.updateLocal(users, userId, new User(updated))
  // El updateLocal marca _localUpdatedAt → protegido por 30s
}
```

#### Mutacion sin proteccion CRDT (para forzar refresh)

```js
async function updateUser(userId, data) {
  const updated = await updateUserUseCase(userId, data)
  // Reemplazar directo SIN _localUpdatedAt:
  // queremos que el proximo sync sobrescriba con datos completos del backend
  const fresh = new User(updated)
  const idx = users.value.findIndex(u => u.id === userId)
  users.value = [...users.value.slice(0, idx), fresh, ...users.value.slice(idx + 1)]
  usersSync.writeToCache(users.value)
  // Luego forzar sync para obtener campos computados que el PATCH no retorna
  usersSync.forceSync(users)
}
```

#### Engine sin persistencia (session-only)

```js
const workloadSync = new SyncEngine({
  cacheKey: null,          // ← sin localStorage
  hydrate: (raw) => raw,   // objetos planos, sin entidad
  fetchRemote: null,
  getId: (w) => w.specialist_id,
})
```

Util para datos transitorios que no necesitan sobrevivir un refresh.

## Supersesión de peticiones stale (backend LWW)

El backend descarta mutaciones viejas cuando ya recibió una más nueva para los
mismos recursos. El lado cliente vive en `syncSeq.js` (mismo módulo sync) y es
**opt-in**: peticiones sin marcar se comportan como siempre; los GET nunca se
cortan. Detalle completo: API_CONTRACT.md del backend, §21 (headers) y §15
(per-item en work windows).

### 1. Headers a nivel request (POST/PUT/PATCH/DELETE)

```js
import { syncGuardHeaders } from '@/infrastructure/sync/syncSeq'

await client.delete('/work-windows', {
  data: { ids },
  headers: syncGuardHeaders(ids.map(id => `work_window:${id}`)),
})
```

- `X-Sync-Seq`: contador monotónico estrictamente creciente (anclado a
  `Date.now()` para sobrevivir recargas).
- `X-Sync-Keys`: recursos que toca la petición (`tipo:id,tipo:id`).

Si la petición llega DESPUÉS que una más nueva para esos recursos, el backend
responde `409` + header `X-Superseded: true` sin tocar la DB. El interceptor de
`client.js` lo convierte en `ApiError` con `isSuperseded === true`. Los call
sites lo tratan como **no-op silencioso**: no pintar, no mostrar error, no
reintentar — el estado final llega con la respuesta de la petición ganadora.

### 2. Per-item en PATCH /work-windows

Cada item del batch lleva `op_seq` (mismo contador; lo añade
`WorkWindowRepository._buildPatchItem`). La respuesta separa tres arrays:

- `updated` — aplicados.
- `failed` — rechazados por validación.
- `superseded` — `{id, op_seq, superseded_by}`: descartados porque ya se envió
  un `op_seq` más nuevo para esa misma window. **Ignorarlos por completo**; no
  emiten eventos WebSocket `work_window.updated` (solo la ganadora emite).

### Qué proteger (y qué no)

Solo operaciones de estado **absoluto** (mover/redimensionar con horas finales,
delete) son LWW-safe. Operaciones **relativas** (toggle = flip) NO: descartar
una cambia el resultado final. Por eso `toggleWindows` no lleva guard.
