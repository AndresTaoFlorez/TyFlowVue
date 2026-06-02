# Prompt Frontend — Módulo de Casos + Tiempo Real (WebSocket client)

> **Proyecto:** `TyFlowVue` — Vue 3 · Pinia · Axios · Vue Router · Clean Architecture  
> **Objetivo:** Construir el módulo de Casos completo: cola de casos en vivo, evaluación WDD animada, cargas por especialista, creación manual, y sincronización en tiempo real vía WebSocket nativo.

---

## Regla de trabajo obligatoria

Antes de tocar cualquier archivo:
1. Lee el archivo completo.
2. Traza el flujo desde la vista hasta la API y de vuelta.
3. Verifica que no rompiste ningún módulo existente (stores, router, layout).
4. Corre `npm run build` y confirma que compila sin errores.
5. Si hay un error, corrígelo y vuelve al paso 1.

**Nunca declares algo como "listo" sin haber comprobado explícitamente cada punto.**

---

## Paso 0 — Auditoría previa (no toques código aún)

Lee completamente estos archivos antes de escribir una sola línea:

**Infraestructura y dominio ya existentes:**
- `src/infrastructure/http/client.js` — singleton Axios, interceptores de auth
- `src/domain/entities/Conversation.js` — entidad base del caso
- `src/domain/entities/Assignment.js` — vinculación especialista-caso
- `src/domain/entities/WorkWindow.js` — disponibilidad de especialistas
- `src/domain/entities/User.js` — tiene `specialistId`, `applicationAssignments`

**Repositorios existentes:**
- `src/infrastructure/repositories/ConversationRepository.js`
  - Verifica si tiene el método `ingest({ conversations, triggerWdd })`.
  - Verifica si hay `fetchPending()` o equivalente.
- `src/infrastructure/repositories/WorkWindowRepository.js`

**Stores existentes:**
- `src/presentation/stores/useUserStore.js`
  - Verifica qué expone: `users`, `applications`, `specialists`, `currentUser`.
- `src/presentation/stores/useAuthStore.js`
  - Verifica cómo se obtiene el token JWT (para el WebSocket).

**Layout y routing:**
- `src/router/index.js` — estructura de rutas `/app/*`
- `src/presentation/layouts/MainLayout.vue` — cómo se definen `flushRoutes`
- `src/presentation/components/AppSidebar.vue` — cómo se añaden ítems de navegación

**Estilos:**
- `src/styles/tokens.css` — variables CSS del sistema de diseño
- `src/styles/utilities.css` — clases utilitarias

Reporta antes de continuar:
- ¿`ConversationRepository` tiene `ingest()`? ¿Qué devuelve exactamente?
- ¿El token JWT vive en `useAuthStore` o en `localStorage` con clave `tyflow_token`?
- ¿`useUserStore.users` incluye el campo `specialistId`? ¿Tiene `isSpecialist` getter?
- ¿`MainLayout.vue` usa un array `flushRoutes` o algún otro mecanismo para rutas sin padding?
- ¿Existe `VITE_WS_URL` en las variables de entorno o hay que derivarlo de `VITE_API_URL`?

---

## Contexto de dominio

### Entidades ya existentes que debes reutilizar

```
Conversation → el Caso.
  id, folder_id, subject, body, from_address, to_address,
  external_id (≠ null → origen RPA), tags, received_at,
  extracted_at, duplicate_of.

Assignment → vincula Conversation con Specialist.
  id, conversation_id, specialist_id, assignment_reason,
  created_at. Getter .reasonLabel ya existe.

WorkWindow → disponibilidad. is_active = ventana abierta.
  specialist_id, application_id, starts_at, ends_at,
  current_count, affinity_weight.
```

### Contrato WebSocket (viene del backend)

```
ws://BACKEND_HOST/ws/events?token=JWT

Mensajes JSON entrantes:
{
  "type": "case.created",
  "data": {
    "id": "e0c66f",
    "subject": "Error en login",
    "from_address": "user@empresa.com",
    "external_id": "AAMkAGI...",  // null → origen TyFlow
    "folder_id": "a1b2c3",
    "received_at": "2026-06-01T10:00:00Z",
    "extracted_at": "2026-06-01T10:02:00Z",
    "tags": ["urgente"]
  }
}

{
  "type": "assignment.created",
  "data": {
    "assignment_id": "d4e5f6",
    "conversation_id": "e0c66f",
    "specialist_id": "a1b2c3",
    "assignment_reason": "wdd_algorithm",
    "assigned_at": "2026-06-01T10:02:05Z"
  }
}
```

### Endpoints REST que usará este módulo

Verifica cuáles ya existen en `ConversationRepository` y `WorkWindowRepository`.
Los que falten, créalos en el repositorio correspondiente.

| Endpoint | Método | Uso |
|---|---|---|
| `POST /conversations` con `trigger_wdd: true` | POST | Crear caso + asignar vía WDD |
| `POST /conversations` con `trigger_wdd: false` | POST | Crear caso sin asignar |
| `GET /conversations?status=pending` | GET | Cola de casos pendientes |
| `GET /assignments/recent?limit=10` | GET | Asignaciones recientes |
| `GET /assignments?specialist_id=X&is_active=true` | GET | Carga por especialista |
| `GET /specialists/workload?application_id=X` | GET | Vista de cargas completa |
| `PATCH /assignments/:id` | PATCH | Asignación manual |

---

## Estructura a crear

```
src/
├── domain/entities/
│   └── Case.js                              ← wrapper de Conversation
├── infrastructure/
│   ├── realtime/
│   │   └── wsClient.js                      ← singleton WebSocket con reconexión
│   └── repositories/
│       └── CaseRepository.js                ← métodos específicos de casos
├── application/use-cases/cases/
│   ├── FetchPendingCasesUseCase.js
│   ├── CreateCaseUseCase.js
│   ├── AutoAssignCaseUseCase.js
│   ├── FetchRecentAssignmentsUseCase.js
│   └── FetchSpecialistWorkloadsUseCase.js
├── presentation/
│   ├── composables/
│   │   └── useCasesRealtime.js              ← escucha eventos WS, actualiza store
│   ├── stores/
│   │   └── useCasesStore.js
│   ├── views/
│   │   └── CasosView.vue                   ← shell 3 columnas + tabs
│   └── components/
│       ├── CaseQueue.vue                    ← columna izquierda
│       ├── WddEvaluationPanel.vue           ← columna central (stepper)
│       ├── SpecialistsSidebar.vue           ← columna derecha
│       ├── CaseCandidatesTable.vue          ← tabla comparativa dentro del panel
│       ├── CaseCreateForm.vue              ← sub-sección "Crear caso"
│       └── CaseLoadsView.vue               ← sub-sección "Cargas"
```

---

## Paso 1 — Dominio: entidad `Case`

Crear **`src/domain/entities/Case.js`**:

```js
import { Conversation } from './Conversation.js'

export class Case extends Conversation {
  constructor(raw) {
    super(raw)
    this.priority = raw.priority ?? raw.tags?.find(t => /^P[123]$/i.test(t)) ?? 'P3'
    this.status = raw.status ?? 'pending'         // 'pending' | 'assigned' | 'closed'
    this.assignment = raw.assignment ?? null       // Assignment | null
  }

  /** 'rpa' si viene de Outlook, 'tyflow' si fue creado manualmente */
  get origin() {
    return this.externalId != null ? 'rpa' : 'tyflow'
  }

  get originLabel() {
    return this.origin === 'rpa' ? 'RPA' : 'TyFlow'
  }

  get originIcon() {
    return this.origin === 'rpa' ? 'bx-bot' : 'bx-cog'
  }

  /**
   * Tiempo transcurrido desde que llegó el caso.
   * Usa received_at si existe, si no extracted_at.
   * Formato: "5m" / "2h 15m" / null
   */
  get waitingTime() {
    const ref = this.receivedAt ?? this.extractedAt
    if (!ref) return null
    const diff = Date.now() - new Date(ref).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }

  /** P1 | P2 | P3 */
  get priorityLevel() {
    const tag = this.tags?.find(t => /^P[123]$/i.test(t))
    return tag?.toUpperCase() ?? this.priority ?? 'P3'
  }
}
```

### Tokens CSS nuevos

Añadir en **`src/styles/tokens.css`** (al final, en su propia sección):

```css
/* ── Prioridades de casos ─────────────────────────── */
--priority-p1: #EF4444;
--priority-p1-bg: #FEE2E2;
--priority-p2: #F97316;
--priority-p2-bg: #FFEDD5;
--priority-p3: #6B7280;
--priority-p3-bg: #F3F4F6;

/* ── Badges de origen ─────────────────────────────── */
--origin-rpa: #7C3AED;
--origin-rpa-bg: #EDE9FE;
--origin-tyflow: #065F46;
--origin-tyflow-bg: #D1FAE5;
```

---

## Paso 2 — Infraestructura: WebSocket singleton

Crear **`src/infrastructure/realtime/wsClient.js`**:

```js
/**
 * TyFlowWebSocket — cliente WebSocket con reconexión exponencial.
 *
 * Uso:
 *   wsClient.on('case.created', handler)    → devuelve fn de unsubscribe
 *   wsClient.on('assignment.created', handler)
 *   wsClient.connect()   ← llamar al login
 *   wsClient.disconnect() ← llamar al logout
 */

const WS_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8181'
  return apiUrl.replace(/^http/, 'ws') + '/ws/events'
})()

class TyFlowWebSocket {
  constructor() {
    this._socket = null
    this._listeners = new Map()   // eventType → Set<fn>
    this._delay = 1000
    this._maxDelay = 30_000
    this._intentional = false     // true al llamar disconnect()
  }

  /**
   * Conectar con el JWT actual.
   * Se llama desde useAuthStore.login() después de autenticar.
   */
  connect(token) {
    if (this._socket?.readyState === WebSocket.OPEN) return
    this._intentional = false

    const url = token ? `${WS_URL}?token=${token}` : WS_URL
    this._socket = new WebSocket(url)

    this._socket.onopen = () => {
      console.info('[WS] Conectado')
      this._delay = 1000
    }

    this._socket.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data)
        // Notificar listeners por tipo
        this._listeners.get(type)?.forEach(fn => fn(payload))
        // Notificar listeners globales '*'
        this._listeners.get('*')?.forEach(fn => fn({ type, payload }))
      } catch (e) {
        console.error('[WS] Error parseando mensaje:', e)
      }
    }

    this._socket.onclose = ({ code }) => {
      if (this._intentional || code === 4001) return   // no reconectar
      console.warn(`[WS] Desconectado. Reconectando en ${this._delay}ms...`)
      setTimeout(() => this.connect(token), this._delay)
      this._delay = Math.min(this._delay * 2, this._maxDelay)
    }

    this._socket.onerror = err => console.error('[WS] Error:', err)
  }

  /**
   * Suscribirse a un tipo de evento.
   * @returns {Function} — llamar para cancelar la suscripción
   */
  on(eventType, callback) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set())
    }
    this._listeners.get(eventType).add(callback)
    return () => this._listeners.get(eventType)?.delete(callback)
  }

  disconnect() {
    this._intentional = true
    this._socket?.close()
    this._socket = null
  }
}

export const wsClient = new TyFlowWebSocket()
```

### Integrar en `useAuthStore`

En **`src/presentation/stores/useAuthStore.js`**, importar y conectar/desconectar:

```js
import { wsClient } from '@/infrastructure/realtime/wsClient'

// Dentro de la acción login(), después de guardar el token:
const token = /* el token JWT recibido de la API */
wsClient.connect(token)

// Dentro de la acción logout(), antes de limpiar el estado:
wsClient.disconnect()
```

> Si el token vive en `localStorage` con clave `tyflow_token`, leerlo desde ahí al conectar.

---

## Paso 3 — Repositorio: `CaseRepository`

Crear **`src/infrastructure/repositories/CaseRepository.js`**:

Sigue el patrón de los repositorios existentes (usa el singleton Axios de `client.js`).

```js
import { client } from '../http/client.js'
import { Case } from '../../domain/entities/Case.js'
import { Assignment } from '../../domain/entities/Assignment.js'

export class CaseRepository {
  /** Casos pendientes de asignación (sin assignment activo) */
  async fetchPending({ applicationId, supportLevelId, page = 1, pageSize = 50 } = {}) {
    const { data } = await client.get('/conversations', {
      params: {
        status: 'pending',         // ajustar al filtro real del backend
        application_id: applicationId,
        support_level_id: supportLevelId,
        page,
        page_size: pageSize,
      },
    })
    const items = data.items ?? data.data ?? data
    return items.map(raw => new Case(raw))
  }

  /**
   * Crear caso y opcionalmente disparar WDD.
   * @returns {{ conversation: Case, assignmentId: string|null, wddError: string|null }}
   */
  async ingest({ subject, body, fromAddress, folderId, tags = [], triggerWdd = false }) {
    const { data } = await client.post('/conversations', {
      conversations: [{
        folder_id: folderId,
        subject,
        body,
        from_address: fromAddress,
        tags,
      }],
      trigger_wdd: triggerWdd,
    })
    const result = data.results?.[0]
    return {
      conversation: new Case(result.conversation),
      assignmentId: result.assignment_id ?? null,
      wddError: result.wdd_error ?? null,
    }
  }

  /** Últimas N asignaciones para el panel "Asignaciones Recientes" */
  async fetchRecentAssignments(limit = 10) {
    const { data } = await client.get('/assignments/recent', { params: { limit } })
    return data.items ?? data.data ?? data
  }

  /**
   * Carga actual de todos los especialistas en una aplicación.
   * Devuelve array con: specialist_id, full_name, is_available,
   * current_count, window_starts_at, window_ends_at.
   */
  async fetchWorkloads(applicationId) {
    const { data } = await client.get('/specialists/workload', {
      params: { application_id: applicationId },
    })
    return data.items ?? data.data ?? data
  }
}
```

---

## Paso 4 — Use cases

Crear en **`src/application/use-cases/cases/`**:

Sigue el patrón de los use cases existentes: reciben el repositorio como parámetro, devuelven entidades del dominio, no llaman a Axios directamente.

```
FetchPendingCasesUseCase.js  → llama CaseRepository.fetchPending()
CreateCaseUseCase.js         → valida campos, llama CaseRepository.ingest()
AutoAssignCaseUseCase.js     → llama CaseRepository.ingest({ triggerWdd: true })
FetchRecentAssignmentsUseCase.js → CaseRepository.fetchRecentAssignments()
FetchSpecialistWorkloadsUseCase.js → CaseRepository.fetchWorkloads(applicationId)
```

Cada use case expone un método `execute(params)` que lanza un error del dominio si hay problemas, nunca devuelve objetos crudos de la API.

---

## Paso 5 — Store: `useCasesStore`

Crear **`src/presentation/stores/useCasesStore.js`**:

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'
import { FetchPendingCasesUseCase } from '@/application/use-cases/cases/FetchPendingCasesUseCase'
import { FetchRecentAssignmentsUseCase } from '@/application/use-cases/cases/FetchRecentAssignmentsUseCase'
import { FetchSpecialistWorkloadsUseCase } from '@/application/use-cases/cases/FetchSpecialistWorkloadsUseCase'
import { AutoAssignCaseUseCase } from '@/application/use-cases/cases/AutoAssignCaseUseCase'
import { CreateCaseUseCase } from '@/application/use-cases/cases/CreateCaseUseCase'

export const useCasesStore = defineStore('cases', () => {
  // ── Estado ──────────────────────────────────────────────────────────
  const pendingCases = ref([])          // Case[] — cola izquierda
  const selectedCase = ref(null)        // Case | null — activo en panel central
  const evaluationResult = ref(null)    // resultado del último WDD
  const recentAssignments = ref([])     // últimas 10 asignaciones
  const specialistWorkloads = ref([])   // carga por especialista
  const loading = ref(false)
  const assigning = ref(false)
  const error = ref(null)

  // ── Repositorios y use cases (instanciados localmente) ──────────────
  const repo = new CaseRepository()
  const fetchPendingUC = new FetchPendingCasesUseCase(repo)
  const fetchRecentUC = new FetchRecentAssignmentsUseCase(repo)
  const fetchWorkloadsUC = new FetchSpecialistWorkloadsUseCase(repo)
  const autoAssignUC = new AutoAssignCaseUseCase(repo)
  const createCaseUC = new CreateCaseUseCase(repo)

  // ── Acciones ─────────────────────────────────────────────────────────

  async function loadPendingCases(filters = {}) {
    loading.value = true
    error.value = null
    try {
      pendingCases.value = await fetchPendingUC.execute(filters)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function loadRecentAssignments() {
    recentAssignments.value = await fetchRecentUC.execute(10)
  }

  async function loadWorkloads(applicationId) {
    specialistWorkloads.value = await fetchWorkloadsUC.execute(applicationId)
  }

  function selectCase(caseObj) {
    selectedCase.value = caseObj
    evaluationResult.value = null
  }

  async function autoAssign(caseObj) {
    assigning.value = true
    evaluationResult.value = null
    try {
      const result = await autoAssignUC.execute(caseObj)
      evaluationResult.value = result
      // Quitar de pendientes si fue asignado
      if (result.assignmentId) {
        pendingCases.value = pendingCases.value.filter(c => c.id !== caseObj.id)
      }
      return result
    } finally {
      assigning.value = false
    }
  }

  async function createCase(payload) {
    assigning.value = true
    try {
      const result = await createCaseUC.execute(payload)
      if (!result.assignmentId) {
        // Caso creado sin asignar → añadir a la cola
        pendingCases.value.unshift(result.conversation)
      }
      return result
    } finally {
      assigning.value = false
    }
  }

  // ── Mutaciones reactivas para tiempo real (llamadas desde el composable) ──

  function onCaseCreatedRT(rawCase) {
    const { Case } = require('@/domain/entities/Case')  // evitar circular
    const newCase = new Case(rawCase)
    if (!pendingCases.value.find(c => c.id === newCase.id)) {
      pendingCases.value.unshift(newCase)
    }
  }

  function onAssignmentCreatedRT(assignment) {
    // Mover caso de pendientes (si está)
    pendingCases.value = pendingCases.value.filter(
      c => c.id !== assignment.conversation_id
    )
    // Actualizar asignaciones recientes
    recentAssignments.value = [
      assignment,
      ...recentAssignments.value,
    ].slice(0, 10)
    // Si el caso seleccionado fue el asignado → actualizar resultado
    if (selectedCase.value?.id === assignment.conversation_id) {
      evaluationResult.value = assignment
    }
    // Actualizar carga del especialista afectado
    const w = specialistWorkloads.value.find(
      s => s.specialist_id === assignment.specialist_id
    )
    if (w) w.current_count = (w.current_count ?? 0) + 1
  }

  return {
    pendingCases, selectedCase, evaluationResult,
    recentAssignments, specialistWorkloads,
    loading, assigning, error,
    loadPendingCases, loadRecentAssignments, loadWorkloads,
    selectCase, autoAssign, createCase,
    onCaseCreatedRT, onAssignmentCreatedRT,
  }
})
```

---

## Paso 6 — Composable de tiempo real

Crear **`src/presentation/composables/useCasesRealtime.js`**:

```js
import { onMounted, onUnmounted } from 'vue'
import { wsClient } from '@/infrastructure/realtime/wsClient'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

/**
 * Conecta los eventos WebSocket con el store de casos.
 * Úsalo una sola vez, en CasosView.vue.
 */
export function useCasesRealtime() {
  const casesStore = useCasesStore()
  const unsubs = []

  onMounted(() => {
    unsubs.push(wsClient.on('case.created', payload => {
      casesStore.onCaseCreatedRT(payload)
    }))
    unsubs.push(wsClient.on('assignment.created', payload => {
      casesStore.onAssignmentCreatedRT(payload)
    }))
  })

  onUnmounted(() => {
    unsubs.forEach(unsub => unsub())
  })
}
```

---

## Paso 7 — Componentes

Implementar en orden de dependencia. Cada componente sigue el patrón:  
`<script setup>` + `<template>` + `<style scoped>`, sin librerías de UI externas.  
Solo Boxicons, CSS vars del proyecto, SVG puro.

---

### 7.1 `CaseQueue.vue`

**Ubicación:** `src/presentation/components/CaseQueue.vue`  
**Props:** ninguna — lee directamente de `useCasesStore`  
**Emits:** ninguno — usa `casesStore.selectCase(case)` directamente

**Qué renderiza:**
- Header: "Cola de casos" + badge con el count de pendientes
- Lista scrollable de tarjetas `CaseCard` (implementar inline o como componente hijo)
- Estado vacío: ilustración + "Sin casos pendientes"
- Estado loading: skeleton de 3 tarjetas

**Cada tarjeta muestra:**
- Número de caso (primeros 6 chars del ID en mayúsculas, con prefijo `#`)
- Badge de prioridad (P1/P2/P3) — colores de los tokens CSS nuevos
- Asunto truncado a 60 chars
- Badge de origen (RPA morado / TyFlow verde) con el icono Boxicons correspondiente
- Tiempo de espera (`case.waitingTime`)
- Al hacer click → `casesStore.selectCase(case)` + añade clase `.case-card--active`

---

### 7.2 `SpecialistsSidebar.vue`

**Ubicación:** `src/presentation/components/SpecialistsSidebar.vue`  
**Props:** ninguna — lee de `useCasesStore`

**Estructura:**

**Bloque superior — "Especialistas disponibles":**
- Para cada especialista en `casesStore.specialistWorkloads`:
  - Avatar circular con iniciales (2 letras del nombre), color generado desde el nombre con HSL
  - Nombre completo
  - Indicador `●` verde "Disponible" / rojo "No disponible" (basado en `is_available`)
  - Horario de ventana: `HH:MM – HH:MM`
  - **Donut SVG** de progreso: radio `r=18`, strokeWidth 4.
    ```
    circunferencia = 2π × 18 ≈ 113.1
    filled = (current_count / 10) × 113.1
    stroke-dasharray="filled (113.1 - filled)"
    ```
    Color: verde si < 50%, naranja si < 80%, rojo si ≥ 80%.
  - Texto `X / 10 asignaciones`

**Bloque inferior — "Asignaciones recientes":**
- Lista de las últimas 10 de `casesStore.recentAssignments`
- Por ítem: `#ID` + asunto truncado a 30 chars + `→` + nombre del especialista + hora relativa
- Máximo 10 ítems; si hay más, link "Ver historial completo →"

---

### 7.3 `CaseCandidatesTable.vue`

**Ubicación:** `src/presentation/components/CaseCandidatesTable.vue`  
**Props:** `candidates: Array` — lista de candidatos evaluados por el WDD  

Si el backend no devuelve candidatos individuales en la respuesta del ingest, mostrar solo al candidato ganador con su información básica (specialist, carga, motivo de selección).

**Columnas:**

| Columna | Qué muestra |
|---|---|
| Especialista | Avatar (iniciales) + nombre |
| Categoría | ✓ azul / ✗ gris (si atiende la categoría del caso) |
| Disponibilidad | Badge "Disponible" verde / "No disponible" rojo |
| Carga actual | Barra de progreso horizontal (verde < 50%, naranja < 80%, rojo ≥ 80%) + `X/10` |
| Capacidad | Porcentaje `affinity_weight × 100 %` |
| Resultado | Badge "Seleccionado" verde (ganador) / "No seleccionado" gris |

---

### 7.4 `WddEvaluationPanel.vue`

**Ubicación:** `src/presentation/components/WddEvaluationPanel.vue`  
**Props:** ninguna — lee de `useCasesStore` (`selectedCase`, `evaluationResult`, `assigning`)

**Estructura:**

**Header:** número de caso, asunto, badge de prioridad, badge de origen.

**Estado sin caso seleccionado:** ilustración + "Selecciona un caso de la cola para evaluarlo".

**Stepper horizontal (4 pasos):**

```
[1. Filtrar categoría] → [2. Verificar disponibilidad] → [3. Calcular carga] → [4. Seleccionar]
```

Cada paso:
- Icono Boxicons en círculo: `bx-filter` / `bx-time-five` / `bx-bar-chart` / `bx-user-check`
- Título + descripción corta
- Estado: `idle` (gris) → `active` (azul + spinner de 16px) → `done` (verde + `bx-check`)

Animación: cuando `assigning = true`, los pasos se activan secuencialmente con un delay de 700ms entre cada uno (simulación visual — el backend no emite eventos paso a paso aún, eso viene en un sprint futuro). Cuando `evaluationResult` llegue, todos los pasos pasan a `done`.

**Card de resultado (cuando `evaluationResult !== null`):**
- Fondo `var(--success-bg)`, borde `var(--success)`, icono `bx-check-circle` grande
- Nombre del especialista asignado
- Carga actual `X / 10`
- Horario de ventana `HH:MM – HH:MM`
- Badge "Disponible" o "No disponible"
- Si `wddError !== null`: card roja con el mensaje de error

**Botón "Asignar automáticamente":**
- Solo visible si `selectedCase !== null` y no hay `evaluationResult`
- Al hacer click: `casesStore.autoAssign(selectedCase)`
- Durante `assigning`: spinner + "Evaluando..."
- Deshabilitar si `assigning === true`

**`CaseCandidatesTable`** debajo de la card de resultado (si hay candidatos).

---

### 7.5 `CaseCreateForm.vue`

**Ubicación:** `src/presentation/components/CaseCreateForm.vue`

**Campos:**

```
Asunto:       [input text — requerido]
Descripción:  [textarea — opcional]
Aplicación:   [select — usa useUserStore.applications]
Carpeta:      [select — carpetas tipo 'level' de la aplicación seleccionada]
Prioridad:    [P1 | P2 | P3 — radio buttons estilizados con los colores de tokens]
Asignación:   [○ Automática (WDD)   ○ Manual → select especialista]
```

**Comportamiento:**
- "Automática" → `casesStore.autoAssign()` con `triggerWdd: true`
- "Manual" → crea el caso sin WDD y luego llama `PATCH /assignments/:id`
- Validación inline: campo "Asunto" y "Aplicación" son requeridos
- Al enviar exitosamente: resetear el form + mostrar toast "Caso creado"

---

### 7.6 `CaseLoadsView.vue`

**Ubicación:** `src/presentation/components/CaseLoadsView.vue`

Vista tipo board de cargas:
- **Filtros:** por aplicación (select, usa `useUserStore.applications`), por fecha, por nivel de soporte
- **Toggle:** vista columnas / vista tabla

**Vista columnas:** una card por especialista con avatar, nombre, barra de carga, lista de sus últimos 3 casos asignados (número + asunto truncado + badge de prioridad).

**Vista tabla:** columnas `Especialista | Disponibilidad | Carga | Casos activos | Ventana`.

Carga la data con `casesStore.loadWorkloads(applicationId)` al montar y al cambiar el filtro de aplicación.

---

## Paso 8 — Vista shell: `CasosView.vue`

Crear **`src/presentation/views/CasosView.vue`**:

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import { useUserStore } from '@/presentation/stores/useUserStore'
import CaseQueue from '@/presentation/components/CaseQueue.vue'
import WddEvaluationPanel from '@/presentation/components/WddEvaluationPanel.vue'
import SpecialistsSidebar from '@/presentation/components/SpecialistsSidebar.vue'
import CaseCreateForm from '@/presentation/components/CaseCreateForm.vue'
import CaseLoadsView from '@/presentation/components/CaseLoadsView.vue'

const casesStore = useCasesStore()
const userStore = useUserStore()
const activeTab = ref('asignaciones')   // 'asignaciones' | 'crear' | 'cargas'

// Activar tiempo real para esta vista
useCasesRealtime()

onMounted(async () => {
  await casesStore.loadPendingCases()
  await casesStore.loadRecentAssignments()
  if (userStore.applications.length > 0) {
    await casesStore.loadWorkloads(userStore.applications[0].id)
  }
})
</script>

<template>
  <div class="casos-view">
    <!-- Tabs -->
    <nav class="casos-view__tabs">
      <button
        v-for="tab in ['asignaciones', 'crear', 'cargas']"
        :key="tab"
        class="casos-view__tab"
        :class="{ 'casos-view__tab--active': activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab === 'asignaciones' ? 'Asignaciones' : tab === 'crear' ? 'Crear caso' : 'Cargas' }}
      </button>
    </nav>

    <!-- Tab: Asignaciones (3 columnas) -->
    <div v-if="activeTab === 'asignaciones'" class="casos-view__grid">
      <CaseQueue class="casos-view__col casos-view__col--left" />
      <WddEvaluationPanel class="casos-view__col casos-view__col--center" />
      <SpecialistsSidebar class="casos-view__col casos-view__col--right" />
    </div>

    <!-- Tab: Crear caso -->
    <div v-else-if="activeTab === 'crear'" class="casos-view__form-wrap">
      <CaseCreateForm />
    </div>

    <!-- Tab: Cargas -->
    <div v-else class="casos-view__loads-wrap">
      <CaseLoadsView />
    </div>
  </div>
</template>

<style scoped>
.casos-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.casos-view__tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  padding: 0 var(--spacing-lg);
  flex-shrink: 0;
}

.casos-view__tab {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-secondary);
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
}
.casos-view__tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.casos-view__grid {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  gap: 0;
  flex: 1;
  overflow: hidden;
}
.casos-view__col {
  overflow-y: auto;
  border-right: 1px solid var(--border);
}
.casos-view__col--right {
  border-right: none;
}

.casos-view__form-wrap,
.casos-view__loads-wrap {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
}
</style>
```

---

## Paso 9 — Routing y sidebar

### Router

En **`src/router/index.js`**:

```js
import CasosView from '@/presentation/views/CasosView.vue'

// Dentro del children de /app:
{
  path: 'casos',
  name: 'casos',
  component: CasosView,
  meta: { requiresAuth: true, requiresAdmin: true, title: 'Casos' },
}
```

### Layout flush

En **`src/presentation/layouts/MainLayout.vue`**, añadir `'/app/casos'` al array `flushRoutes` (o como se llame el mecanismo que elimina el padding del content). La vista de casos usa su propio padding interno.

### Sidebar

En **`src/presentation/components/AppSidebar.vue`**, añadir ítem de navegación:

```js
{ label: 'Casos', icon: 'bx-task', route: { name: 'casos' } }
```

---

## Paso 10 — Variables de entorno

En **`.env.example`** (o el equivalente del proyecto), documentar:

```env
VITE_API_URL=http://localhost:8181
# VITE_WS_URL se deriva automáticamente de VITE_API_URL (http→ws)
# Si el backend corre en una URL diferente para WS, definir explícitamente:
# VITE_WS_URL=ws://localhost:8181
```

El `wsClient.js` ya deriva la URL automáticamente del `VITE_API_URL`.

---

## Paso 11 — Verificación integral

```bash
npm run build   # Sin errores. Warnings de unused vars de libs externas son OK.
```

### Funcionalidad

- [ ] La ruta `/app/casos` carga sin errores.
- [ ] El ítem "Casos" aparece en el sidebar con icono `bx-task`.
- [ ] La vista tiene 3 tabs: Asignaciones, Crear caso, Cargas.
- [ ] La cola izquierda muestra los casos pendientes al cargar.
- [ ] Al hacer click en una tarjeta de caso → se activa en el panel central.
- [ ] El botón "Asignar automáticamente" activa el stepper con animación secuencial.
- [ ] El stepper completa todos los pasos y muestra la card de resultado.
- [ ] Si WDD falla → card roja con el mensaje de error.
- [ ] El panel derecho muestra especialistas con donut de carga SVG.
- [ ] Las asignaciones recientes se listan en el panel derecho.

### Tiempo real (WebSocket)

- [ ] Al autenticarse, `wsClient.connect(token)` se llama automáticamente.
- [ ] Al desautenticarse, `wsClient.disconnect()` se llama automáticamente.
- [ ] Si el backend publica `case.created`, el caso aparece al inicio de la cola sin recargar.
- [ ] Si el backend publica `assignment.created`, el caso se mueve fuera de la cola y aparece en "Asignaciones recientes".
- [ ] Si el caso asignado era el seleccionado en el panel central, el resultado se actualiza.
- [ ] Si el WebSocket se desconecta, reconecta automáticamente con backoff exponencial.
- [ ] Un token inválido cierra la conexión sin ciclo de reconexión infinito.

### Visual

- [ ] Badges P1/P2/P3 usan los colores de `tokens.css`.
- [ ] Badges RPA (morado) / TyFlow (verde) se muestran correctamente.
- [ ] Los donuts SVG son proporcionales a la carga del especialista.
- [ ] La vista usa `layout__main--flush` (sin padding extra del layout).
- [ ] En `npm run build` no aparecen errores de importaciones circulares.

---

## Notas de arquitectura y convenciones

- **Layer discipline:** La vista y los componentes no importan nada de `@/infrastructure/` ni de `@/domain/` directamente — solo del store. El store es el único que conoce los use cases. Los use cases conocen el repositorio. El repositorio conoce el cliente HTTP.
- **Excepción justificada:** `wsClient` se importa directamente en `useAuthStore` y en `useCasesRealtime` porque es infraestructura de transporte, no de datos.
- **Sin librerías de UI:** Boxicons, CSS vars, SVG puro. Ni Tailwind, ni shadcn, ni PrimeVue.
- **CSS:** BEM + variables de `tokens.css`. `<style scoped>` en todos los componentes.
- **Idioma:** toda la UI en español.
- **Donuts SVG:** radio `r=18`, `strokeWidth=4`, sin librerías. El `stroke-dasharray` se calcula dinámicamente con `computed`.
- **Errores de Redis/WS no deben bloquear la UI:** si el WebSocket no está disponible, la vista funciona igual con polling manual (el store carga datos al montar).

---

*Stack: Vue 3 · Pinia · Axios · WebSocket nativo · CSS vars · Boxicons · Vite · Docker. Junio 2026.*
