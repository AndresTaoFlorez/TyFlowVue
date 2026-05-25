# API Endpoints - Work Windows

Base: `VITE_API_URL` (mismo que el resto de la app)

## Endpoints

### GET /work-windows
Lista ventanas de trabajo (paginado).

**Query params:**
- `specialist_id` (string, opcional) — filtrar por especialista
- `application_id` (string, opcional) — filtrar por aplicacion
- `page` (int, default=1)
- `page_size` (int, default=100, max=500)

**Response:** PaginatedResponse
```json
{
  "page": 1,
  "page_size": 100,
  "total": 5,
  "total_pages": 1,
  "count": 5,
  "data": [WorkWindowResponse]
}
```

### GET /work-windows/{work_window_id}
Obtiene una ventana por ID.

**Response:** WorkWindowResponse

### POST /work-windows
Crea una ventana de trabajo.

**Body:**
```json
{
  "specialist_id": "171b0a",
  "application_id": "e3d341",
  "start_time": "08:00:00-05",
  "end_time": "17:00:00-05",
  "inherits_on_reopen": false
}
```

**Response:** WorkWindowResponse

### POST /work-windows/{work_window_id}/open
Abre una sesion de ventana.

**Body:**
```json
{
  "inherited_from_window_id": null,
  "note": null
}
```

**Response:** void (204)

### POST /work-windows/{work_window_id}/close
Cierra una sesion de ventana.

**Body:** ninguno
**Response:** void (204)

## Notas importantes

- Los tiempos (`start_time`, `end_time`) son strings con timezone: `"08:00:00-05"` (Colombia UTC-5)
- `specialist_id` es el hex ID del specialist (6 chars), NO el UUID del user
- `application_id` es el hex ID de la aplicacion (6 chars)
- La respuesta de lista es paginada (misma estructura que GET /users)
- No hay endpoint de UPDATE/PATCH ni DELETE
