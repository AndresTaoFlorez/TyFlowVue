---
name: calendario
description: Cargar contexto del modulo Ventanas de Trabajo (Calendario) para continuar desarrollo entre sesiones
user_invocable: true
---

# Skill: Calendario (Ventanas de Trabajo)

Antes de trabajar en este modulo, carga TODO el contexto necesario.

## Pasos obligatorios

1. Lee los 4 archivos de contexto del modulo:
   - `.claude/docs/work-windows/README.md` — Estado general y checklist
   - `.claude/docs/work-windows/api-endpoints.md` — Endpoints del backend
   - `.claude/docs/work-windows/data-model.md` — Modelo de datos
   - `.claude/docs/work-windows/reference-ui.md` — Referencia visual del componente original

2. Lee los archivos ya implementados del modulo (si existen):
   - Busca en `src/infrastructure/repositories/` archivos con "WorkWindow"
   - Busca en `src/application/use-cases/` carpeta "work-windows"
   - Busca en `src/presentation/views/` CalendarioView o similar
   - Busca en `src/presentation/components/` archivos con "WorkWindow" o "Calendar"

3. Lee el estado actual del backend (puede haber cambiado):
   - `D:\Projects\bd_tyflow\src\app\presentation\routes\work_window_routes.py`
   - `D:\Projects\bd_tyflow\src\app\presentation\dtos\work_window_dtos.py`

4. Reporta al usuario:
   - Que archivos de contexto leiste
   - Que ya esta implementado vs que falta
   - Pregunta en que quiere enfocarse esta sesion

## Notas clave
- La ruta es `/app/calendario`, sidebar dice "Calendario", titulo dice "Programador de ventanas de trabajo"
- El backend usa IDs hex de 6 chars para specialist_id y application_id
- start_time/end_time son strings con timezone: "08:00:00-05"
- La referencia visual es CoordinatorPage de fd_mailreceiver pero nuestro backend es diferente
- Seguir Clean Architecture del proyecto: Repository → UseCase → Store → View
- Componentes bien separados para facil debugging (como ApplicationsView)
