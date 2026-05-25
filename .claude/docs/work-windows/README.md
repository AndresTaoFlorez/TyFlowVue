# Modulo: Ventanas de Trabajo (Calendario)

Ruta: `/app/calendario` | Sidebar: "Calendario"
Titulo en vista: **Programador de ventanas de trabajo**

## Resumen

Vista de calendario semanal + tabla para gestionar ventanas de trabajo de especialistas.
Cada ventana define un horario (start_time/end_time) en que un especialista atiende una aplicacion.
Se pueden abrir/cerrar sesiones, heredar conteos, y visualizar la carga.

## Permisos de acceso

- **Admin:** ve TODAS las ventanas de trabajo de todos los especialistas
- **Usuario normal (specialist):** solo ve SUS propias ventanas de trabajo
- La ruta es accesible para todos los usuarios autenticados (no es requiresAdmin)
- El backend ya aplica RLS, el frontend solo necesita mostrar lo que el API devuelve

## Estado del modulo

- [ ] Infraestructura (Repository, Use Cases)
- [ ] Componentes UI
- [ ] Vista principal (CalendarioView)
- [ ] Ruta + Sidebar
- [ ] Crear ventana (modal)
- [ ] Vista semanal (calendario)
- [ ] Vista de tabla/gestion
- [ ] Abrir/Cerrar sesion
- [ ] Filtros por especialista/aplicacion

## Referencia

- Backend API: ver `api-endpoints.md`
- Modelo de datos: ver `data-model.md`
- Componente de referencia: ver `reference-ui.md`
