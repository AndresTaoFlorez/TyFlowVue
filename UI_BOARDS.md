# Manual de construcción de menús/páginas — Contrato de Boards del Shell

Cómo armar cualquier página (menú) de la app de forma estándar y escalable.
El shell (topbar + sidebar) es un **chasis fijo y tonto**: no conoce ninguna
vista, no tiene `v-if` por ruta y nunca se oculta. Cada página se arma
declarando sus piezas.

```
Menú/Página = board principal   (el contenido de la vista, router-view)
            + board de sidebar  (opcional: opciones contextuales bajo el brand)
            + board de topbar   (opcional: título por defecto, o controles propios)
```

## Anatomía del shell

```
┌──────────────┬──────────────────────────────────────────────┐
│ Brand ▾      │  Topbar:  [#topbar-board]   [#topbar-actions] │
│ (nav global) ├──────────────────────────────────────────────┤
│              │                                              │
│ [#sidebar-   │              router-view                     │
│   board]     │           (board principal)                  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Navegación global**: vive en el dropdown del brand (estilo Notion), en
  `AppSidebar`. No se toca al crear páginas.
- **`#sidebar-board`** (`AppSidebar`): espacio libre bajo el brand. Outlet del
  contenido contextual que publica la vista activa.
- **`#topbar-board`** (`AppTopbar`): espacio central de la topbar. Si nadie
  publica, muestra el título por defecto (`route.meta.title`).
- **`#topbar-actions`** (`AppTopbar`, derecha): acciones puntuales (botones);
  outlet legacy vía `<Teleport to="#topbar-actions" defer>` (UsersView, ProfileView).

## Piezas del contrato

| Pieza | Ubicación | Rol |
|---|---|---|
| `TopbarBoard.vue` | `src/presentation/components/layout/` | La vista lo monta; su slot se teletransporta a `#topbar-board` |
| `SidebarBoard.vue` | `src/presentation/components/layout/` | Igual, hacia `#sidebar-board` |
| `useLayoutBoards.js` | `src/presentation/composables/` | Registro reactivo de presencia (contadores). El shell consulta `hasTopbarContent` para ocultar/mostrar el título por defecto |
| `route.meta` | `src/router/index.js` | Tratamiento del `main` y comportamiento del shell, declarado por ruta |

Ambos Board aceptan `disabled` (Boolean): el contenido se renderiza **en sitio**
(dentro de la vista) y NO cuenta como publicado. Útil para móvil.

## Receta: crear una página nueva

1. **La vista** en `src/presentation/views/MiView.vue` (import estático en el
   router — regla de CLAUDE.md para vistas protegidas).

2. **La ruta** con su meta:

```js
{
  path: 'mi-pagina',
  name: 'mi-pagina',
  component: MiView,
  meta: {
    title: 'Mi Página',   // título por defecto en topbar (si no publicas board)
    mainMode: 'flush',    // opcional: 'flush' | 'bare' (ver abajo)
    dense: true,          // opcional: auto-colapsa el sidebar en viewports angostos
  },
}
```

   `mainMode`:
   - *(sin meta)* — `padding: 1.5rem` normal del main.
   - `'flush'` — padding mínimo (vistas densas: tablas, tableros).
   - `'bare'` — padding 0; la vista gestiona su lienzo a sangre completa
     (calendario). Fondo `--cal-col`.

3. **Entrada en la navegación global**: agregar el `RouterLink` al dropdown del
   brand en `AppSidebar.vue` (sección `.navmenu`), con su preferencia de menú
   en `MENU_ROUTE_MAP` (router) si es desactivable desde Settings.

4. **Boards (opcionales)** — dentro del template de la vista:

```vue
<script setup>
import TopbarBoard from '@/presentation/components/layout/TopbarBoard.vue'
import SidebarBoard from '@/presentation/components/layout/SidebarBoard.vue'
</script>

<template>
  <section class="content">
    <!-- Opciones contextuales en el sidebar -->
    <SidebarBoard>
      <nav class="mi__nav"> ... </nav>
    </SidebarBoard>

    <!-- Controles propios en la topbar (reemplazan el título) -->
    <TopbarBoard :disabled="isMobile">
      <div class="mi__toolbar"> ... </div>
    </TopbarBoard>

    <!-- Board principal -->
    ...
  </section>
</template>
```

   Claves:
   - El contenido vive **junto a la vista**: comparte su `<script setup>`, su
     estado y sus stores directamente. Sin prop-drilling, sin registro central.
   - Los estilos `scoped` de la vista SÍ aplican al contenido teletransportado.
   - Si la vista no publica nada, los boards quedan en su default (topbar →
     título; sidebar → solo brand).

## Reglas de estilo por board

- **Sidebar board**: usar tokens theme-aware del rail: `--nav-bg`,
  `--nav-text`, `--nav-text-strong`, `--nav-hover`, `--nav-border`.
  NUNCA `--text-*` / `--surface` (rompen el fondo unificado del rail).
  Referencia de lenguaje visual: `.cside` (CalSidebar) y `.sv__nav` (SettingsView):
  secciones con `border-top: 1px solid var(--nav-border)`, títulos uppercase
  pequeños, items con `border-radius: 8px` y hover `--nav-hover`.
- **Topbar board**: el outlet es un flex row con `flex: 1`; el contenido debe
  ser de una fila (~36px de alto; la topbar mide `--topbar-height: 68px`) y
  fondo transparente — la topbar ya pone `--app-bg` y su padding.
- **Board principal**: tokens normales (`--surface`, `--text`, `--border`...).

## Gotchas

- Los outlets (`#topbar-board`, `#sidebar-board`) deben **existir siempre** en
  el DOM: en `AppSidebar` el outlet se oculta con `v-show` al colapsar (no
  `v-if`), porque un Teleport con target desmontado revienta.
- Los `<Teleport>` de los Boards usan `defer`: pueden montarse en el mismo
  render que el shell sin error de target.
- `disabled` es reactivo: el calendario usa `:disabled="isMobile"` para que el
  toolbar viva en la topbar en escritorio y como card en la vista en móvil.
- La presencia usa **contadores** (no booleanos): tolera el cruce
  montar-nuevo/desmontar-viejo entre rutas.
- En móvil el sidebar es un drawer: lo que publiques en `SidebarBoard` aparece
  dentro del drawer (hamburguesa). **Eso entierra la navegación contextual**:
  en pantallas chicas la topbar debe asumirla. Patrón: publicar en el
  `TopbarBoard` un switcher compacto de iconos (botones ~38×32 en un segment
  con borde) que se muestra solo con `@media (max-width: 768px)` (display:none
  en escritorio, donde el sidebar ya cubre esa navegación). Referencias:
  `.cv__topnav` (CasesView — Lista/Especialistas/Columnas) y `.sv__topnav`
  (SettingsView — secciones). No dejar la topbar móvil solo con el título:
  es el único espacio de navegación siempre visible.
- Dropdowns dentro del topbar board: `position: absolute` funciona (la topbar
  tiene `z-index: 10` y crea stacking context sobre el main).

## Consumidores de referencia

| Página | Sidebar board | Topbar board |
|---|---|---|
| `CalendarioView` | `CalSidebar` (Crear, mini-cal, filtros) | Toolbar completo (`:disabled="isMobile"`), `mainMode: 'bare'` |
| `SettingsView` | Nav de secciones (`.sv__nav`) | — (título por defecto) |
| `UsersView` / `ProfileView` | — | — (título + `#topbar-actions`) |
| `DashboardView` | — | — (solo título) |
