# Conversations API — Guia completa para frontend

Esta guia cubre todo lo necesario para integrar la seccion de conversaciones desde el frontend (TyFlowVue).

---

## Conceptos clave

### IDs cortos (Short IDs)

Todas las entidades en TyFlow usan **IDs de 6 caracteres hexadecimales** generados por el servidor. Nunca UUIDs.

```
"e0c66f"    <-- conversation.id
"a1b2c3"    <-- folder.id
"8f5c4c"    <-- specialist.id
```

La unica excepcion es `user.id` que es un UUID porque viene de Supabase Auth.

### Jerarquia de carpetas

Las conversaciones viven dentro de **folders** (carpetas). La jerarquia es:

```
Application (ej. "Outlook Soporte")
  └─ main_box (unica por aplicacion)
       └─ level (uno por support_level: "basic", "advanced", etc.)
            └─ specialist (uno por especialista asignado)
```

Cuando llega una conversacion nueva, se ingesta en un folder tipo `level`. El WDD (algoritmo de asignacion) la asigna a un especialista. El `folder_id` de la conversacion apunta al folder `level` donde fue depositada.

### Flujo de ingesta + asignacion (WDD)

```
RPA Outlook ──POST /conversations──> Backend
    │
    ├─ 1. Crea cada conversacion en la DB (id auto-generado)
    │
    ├─ 2. Si trigger_wdd=true, por cada conversacion:
    │      a. Busca el folder -> obtiene application_id + support_level_id
    │      b. Busca especialistas elegibles (con work_window abierta)
    │      c. Calcula pesos inversamente proporcionales a la carga actual
    │      d. Selecciona uno por weighted random (Gumbel-max)
    │      e. Crea el assignment + registra decision + actualiza workload
    │
    └─ 3. Retorna resultados por cada conversacion (assignment_id o wdd_error)
```

---

## Endpoints

Todos requieren header `Authorization: Bearer <access_token>`.

Base path: `/conversations`

### GET `/conversations` — Listar conversaciones

Retorna una lista paginada con filtros opcionales.

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|---|---|---|---|
| `folder_id` | `string` | — | Filtrar por folder. Soporta negacion: `!abc123` excluye ese folder |
| `application_id` | `string` | — | Filtrar por aplicacion (via join con folder). Soporta negacion |
| `support_level_id` | `string` | — | Filtrar por nivel de soporte (via join con folder). Soporta negacion |
| `page` | `int` | `1` | Numero de pagina (1-based) |
| `page_size` | `int` | `100` | Items por pagina (max 500) |

**Response:** `PaginatedResponse<ConversationResponse>`

```json
{
  "data": [
    {
      "id": "e0c66f",
      "folder_id": "a1b2c3",
      "subject": "Error en login corporativo",
      "body": "Buenos dias, tengo un problema...",
      "from_address": "usuario@empresa.com",
      "to_address": "soporte@empresa.com",
      "extracted_at": "2026-05-27T03:28:43+00:00",
      "external_id": "AAMkAGI2...",
      "tags": ["urgente", "login"],
      "received_at": "2026-05-27T03:25:00+00:00",
      "duplicate_of": null
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 100
}
```

**Ejemplos de uso:**

```
GET /conversations?folder_id=a1b2c3&page=1&page_size=20
GET /conversations?application_id=e3d341
GET /conversations?support_level_id=f9a1b2&page=2
GET /conversations?application_id=!e3d341          # excluir una aplicacion
```

---

### GET `/conversations/{conversation_id}` — Obtener una conversacion

**Path parameter:** `conversation_id` (string, short hex ID)

**Response:** `ConversationResponse`

```json
{
  "id": "e0c66f",
  "folder_id": "a1b2c3",
  "subject": "Error en login corporativo",
  "body": "Buenos dias, tengo un problema...",
  "from_address": "usuario@empresa.com",
  "to_address": "soporte@empresa.com",
  "extracted_at": "2026-05-27T03:28:43+00:00",
  "external_id": "AAMkAGI2...",
  "tags": ["urgente", "login"],
  "received_at": "2026-05-27T03:25:00+00:00",
  "duplicate_of": null
}
```

**Errores:**
- `404` — Conversacion no encontrada

---

### POST `/conversations` — Ingresar conversaciones (batch)

Crea una o mas conversaciones. Opcionalmente dispara el algoritmo WDD para asignarlas automaticamente.

**Requiere rol admin** (RLS bloquea escritura para roles no-admin).

**Request body:** `IngestConversationsRequest`

```json
{
  "conversations": [
    {
      "folder_id": "a1b2c3",
      "subject": "Error en login corporativo",
      "body": "Buenos dias, tengo un problema con el acceso...",
      "from_address": "usuario@empresa.com",
      "to_address": "soporte@empresa.com",
      "external_id": "AAMkAGI2TH...",
      "tags": ["urgente", "login"],
      "received_at": "2026-05-27T03:25:00+00:00"
    }
  ],
  "trigger_wdd": true
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `conversations` | `array` | Si | Lista de conversaciones (min 1, max 500) |
| `conversations[].folder_id` | `string` | Si | ID del folder destino (debe ser tipo `level`) |
| `conversations[].subject` | `string` | No | Asunto del email. Default: `""` |
| `conversations[].body` | `string` | No | Cuerpo del email. Default: `""` |
| `conversations[].from_address` | `string` | No | Remitente. Default: `""` |
| `conversations[].to_address` | `string` | No | Destinatario. Default: `""` |
| `conversations[].external_id` | `string` | No | ID externo unico (ej. Outlook thread ID). Debe ser unico globalmente |
| `conversations[].tags` | `string[]` | No | Etiquetas libres |
| `conversations[].received_at` | `string` | No | Timestamp ISO 8601 de cuando se recibio el email |
| `trigger_wdd` | `boolean` | No | Si `true`, dispara asignacion automatica WDD. Default: `false` |

**Response:** `IngestConversationsResponse`

```json
{
  "created": 1,
  "assigned": 1,
  "failed_assignments": 0,
  "results": [
    {
      "conversation": {
        "id": "e0c66f",
        "folder_id": "a1b2c3",
        "subject": "Error en login corporativo",
        "body": "Buenos dias, tengo un problema...",
        "from_address": "usuario@empresa.com",
        "to_address": "soporte@empresa.com",
        "extracted_at": "2026-05-27T03:28:43+00:00",
        "external_id": "AAMkAGI2TH...",
        "tags": ["urgente", "login"],
        "received_at": "2026-05-27T03:25:00+00:00",
        "duplicate_of": null
      },
      "assignment_id": "d4e5f6",
      "wdd_error": null
    }
  ]
}
```

| Campo | Tipo | Descripcion |
|---|---|---|
| `created` | `int` | Total de conversaciones creadas |
| `assigned` | `int` | Total asignadas exitosamente via WDD |
| `failed_assignments` | `int` | Total donde WDD fallo (la conversacion se creo igual) |
| `results[].conversation` | `object` | La conversacion creada |
| `results[].assignment_id` | `string?` | ID de la asignacion (null si WDD no se disparo o fallo) |
| `results[].wdd_error` | `string?` | Mensaje de error de WDD (null si fue exitoso) |

**Posibles errores WDD (en `wdd_error`, no falla el request):**

- `"Folder 'abc123' has no support_level_id (type=main_box). WDD skipped."` — El folder no tiene nivel de soporte
- `"No eligible specialists for application 'xxx' and support level 'yyy'."` — No hay especialistas con work window abierta
- `"RPC call to 'fn_wdd_assign_conversation' failed: ..."` — Error en el stored procedure

---

## Modelo de datos completo

### ConversationResponse

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | `string` | ID corto (6 hex chars). Ej: `"e0c66f"` |
| `folder_id` | `string` | ID del folder donde vive la conversacion |
| `subject` | `string` | Asunto del email |
| `body` | `string` | Cuerpo del email |
| `from_address` | `string` | Email del remitente |
| `to_address` | `string` | Email del destinatario |
| `extracted_at` | `string?` | Timestamp ISO 8601. Cuando fue extraida del buzon (auto-generado) |
| `external_id` | `string?` | ID externo unico (Outlook thread ID, etc.) |
| `tags` | `string[]?` | Array de etiquetas libres. `null` si no tiene |
| `received_at` | `string?` | Timestamp ISO 8601. Cuando se recibio el email originalmente |
| `duplicate_of` | `string?` | ID de la conversacion original si es duplicada |

### Relaciones con otras entidades

```
Conversation
  ├── folder_id ──> Folder
  │                   ├── application_id ──> Application
  │                   ├── support_level_id ──> SupportLevel
  │                   └── specialist_id ──> Specialist (si tipo=specialist)
  │
  ├── duplicate_of ──> Conversation (self-ref, opcional)
  │
  └── assignments ──> Assignment[] (via assignment.conversation_id)
                        ├── specialist_id ──> Specialist
                        ├── ticket_id ──> Ticket (opcional)
                        ├── work_window_id ──> WorkWindow (opcional)
                        └── assignment_reason: "wdd_algorithm" | "new_case" |
                            "reassignment_same_level" | "escalation" | "support_escalation"
```

---

## Filtros con negacion

Todos los filtros de texto en el endpoint `GET /conversations` soportan el prefijo `!` para negar:

| Ejemplo | Significado |
|---|---|
| `?folder_id=a1b2c3` | Solo conversaciones en ese folder |
| `?folder_id=!a1b2c3` | Excluir conversaciones de ese folder |
| `?application_id=e3d341` | Solo de esa aplicacion |
| `?application_id=!e3d341` | Excluir esa aplicacion |

---

## Constraints y validaciones

1. **`external_id` es unico globalmente** — si intentas ingresar una conversacion con un `external_id` que ya existe, obtendras un error de duplicado.
2. **`folder_id` debe existir** — FK con `ON DELETE RESTRICT`, no puedes borrar un folder que tiene conversaciones.
3. **Batch maximo: 500 conversaciones** por request de ingesta.
4. **Escritura solo para admins** — RLS bloquea INSERT/UPDATE/DELETE para usuarios no-admin. Lectura es publica para cualquier usuario autenticado.
5. **`extracted_at` es auto-generado** — se llena con `now()` al momento de la insercion. No se puede setear desde el request.
6. **`id` es auto-generado** — nunca enviar en el request. El servidor genera el short hex ID.

---

## Codigos de error HTTP

| Codigo | Cuando |
|---|---|
| `401` | Token ausente, invalido, o expirado |
| `403` | Usuario no-admin intenta escribir (RLS) o cuenta desactivada |
| `404` | Conversacion no encontrada (GET /{id}) |
| `409` | Duplicado (`external_id` ya existe) |
| `422` | Validacion fallida (campos requeridos faltantes, page_size > 500, etc.) |
| `500` | Error de base de datos inesperado |

---

## Ejemplo de integracion tipica (frontend)

### Listar conversaciones de una aplicacion

```typescript
const response = await fetch('/conversations?application_id=e3d341&page=1&page_size=20', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
const { data, total, page, page_size } = await response.json()
```

### Ver detalle de una conversacion

```typescript
const response = await fetch(`/conversations/${conversationId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
const conversation = await response.json()
```

### Ingresar conversaciones con asignacion automatica

```typescript
const response = await fetch('/conversations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversations: [
      {
        folder_id: 'a1b2c3',
        subject: 'Problema con acceso VPN',
        from_address: 'usuario@empresa.com',
        to_address: 'soporte@empresa.com',
        tags: ['vpn', 'acceso']
      }
    ],
    trigger_wdd: true
  })
})
const result = await response.json()
// result.results[0].assignment_id -> ID de la asignacion creada
// result.results[0].wdd_error -> null si fue exitoso
```
