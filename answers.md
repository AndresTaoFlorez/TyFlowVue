Antes de darle forma, necesito entender mejor el dominio. Algunas preguntas clave:

**Sobre el flujo de creación:**
- El WDD (asignación automática) — ¿ya existe lógica en el backend o es algo nuevo por construir?
-- Ya existe, analiza a nivel produncto en endpoint de la api para eso en "D:\Projects\bd_tyflow\src\app\presentation\routes\assignment_routes.py"
- Cuando se asigna automáticamente, ¿basado en qué criterio? ¿disponibilidad en calendario, carga actual, especialidad?
...

**Sobre los dos orígenes de casos:**
- RPA de Outlook → ¿llega como un webhook/endpoint que ya existe en `bd_tyflow`? ¿O es algo por construir?
-- tienes que mirar las conversations, tickets, workload_overview (vista) y los assignment. Esto te lo deberi dar el backend.
- ¿Qué datos trae un caso del RPA vs un caso creado manualmente en TyFlow? ¿Son los mismos campos?

**Sobre la vista de cargas:**
- La imagen que mencionas — ¿puedes compartirla? Me ayudaría mucho para el diseño.
-- Te la pasare (estas respuesta se las pasare a claude web)


**Sobre la relación con módulos existentes:**
- ¿Un caso está ligado a una `work_window`? ¿O son entidades independientes?
- ¿Un caso puede estar en una `application` y `folder` específicos?

---

Con lo que ya tengo puedo adelantar la estructura general:

**Sub-sección 1 — Crear/Asignar casos:**
Form con campos del caso + selector de specialist (manual) o toggle "Asignar automáticamente (WDD)" + badge visual que indique el origen (`RPA` vs `TyFlow`).

**Sub-sección 2 — Vista de cargas:**
Panel por specialist mostrando sus casos activos, inspirado en un board tipo Jira/Linear — cada columna o card group es un specialist con su carga actual.
