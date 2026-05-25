# Modelo de Datos - Work Windows

## WorkWindowResponse (backend)

```
id                        string    ID hex (6 chars)
specialist_id             string    ID hex del specialist
application_id            string    ID hex de la aplicacion
start_time                string    Hora inicio con TZ ("08:00:00-05")
end_time                  string    Hora fin con TZ ("17:00:00-05")
opening_count             int       Carga al iniciar sesion
current_count             int       Contador de carga actual (vivo)
inherits_on_reopen        bool      Hereda conteo al reabrir?
is_active                 bool      Ventana activa?
created_at                string?   Timestamp de creacion
opened_at                 string?   Timestamp de apertura de sesion
closed_at                 string?   Timestamp de cierre de sesion
closing_count             int?      Carga al cerrar sesion
inherited_from_window_id  string?   ID de ventana de la que heredo
```

## Relaciones

- specialist_id -> Specialist (via UserResponse.specialist_id)
- application_id -> Application (via application.id)

## Concepto de sesion

Una ventana define el HORARIO (start/end), pero la SESION es el estado abierto/cerrado:
- `opened_at != null && closed_at == null` => sesion abierta (activa)
- `closed_at != null` => sesion cerrada
- `opening_count` = carga snapshot al abrir
- `current_count` = carga en tiempo real
- `closing_count` = carga snapshot al cerrar

## Herencia de conteo

Cuando `inherits_on_reopen = true`, al abrir una nueva sesion se puede pasar
`inherited_from_window_id` para copiar el conteo de otra ventana previa.
Util para cambios de turno.
