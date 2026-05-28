# Refactor Layout de Applications — Estilo Outlook

## Contexto del proyecto

Vue 3 + Vite + Pinia + Vue Router. Clean Architecture de 4 capas:
`View -> Store -> UseCase -> Repository -> HTTP Client`

Stack: Vue 3 Composition API (`<script setup>`), Pinia, Vue Router, Axios.
Sin librerias de componentes externas. CSS con variables de `tokens.css`.
UI en espanol. Todos los componentes siguen el patron `<script setup>` +
`<template>` + `<style scoped>`.

## Regla de trabajo obligatoria

**Nunca declares algo como "listo" hasta haber**:
1. Leido el archivo modificado completo despues de escribirlo.
2. Trazado el flujo completo desde la vista hasta la API y de vuelta.
3. Verificado que no rompiste ningun otro modulo que use los mismos stores o componentes.
4. Corrido `npm run build` y confirmado que compila sin errores.
5. Si encuentras un error al verificar, corrigelo y vuelve a verificar desde el paso 1.
No asumas que algo funciona si no lo has comprobado explicitamente.

---

## Paso 0 — Lectura obligatoria (no toques codigo aun)

Lee completamente estos archivos antes de escribir una sola linea:

**Layout y estilos globales:**
- `src/presentation/layouts/MainLayout.vue`
- `src/styles/tokens.css`
- `src/styles/utilities.css`

**Vista y componentes de Applications:**
- `src/presentation/views/ApplicationsView.vue`
- `src/presentation/components/ConversationPanel.vue`
- `src/presentation/components/FolderTree.vue`
- `src/presentation/components/FolderTreeNode.vue`
- `src/presentation/components/ContextMenu.vue`
- `src/presentation/components/CreateApplicationModal.vue`
- `src/presentation/components/CreateFolderModal.vue`
- `src/presentation/components/ManageSpecialistsModal.vue`
- `src/presentation/components/AppSidebar.vue`
- `src/presentation/components/AppTopbar.vue`

**Store:**
- `src/presentation/stores/useApplicationStore.js`

Reporta antes de continuar:
- Calculo exacto de espacio horizontal consumido a 1366px, 1024px y 768px.
- Donde se acumula padding innecesario (efecto "doble margen").
- Que breakpoints existen y cuales faltan.

---

## Problema 1 — Spacing inflado ("aspecto junior")

### Diagnostico actual (valores exactos del codigo)

El layout actual acumula spacing innecesario en multiples capas:

```
Sidebar (260px)
  + layout__main padding (2rem = 32px cada lado)
    + app-split__left (320px fijo)
      + panel-header padding (1rem 1rem 0.5rem)
      + panel-search margin (0.5rem 1rem) + padding (0.5rem 0.75rem)
      + app-node__header padding (0.6rem 1rem)
      + app-node__tree padding-left (0.5rem)
        + tn__row padding (3px 6px 3px 2px)
        + tn__children margin-left (9px) + padding-left (12px) = 21px por nivel
```

A 1366px: sidebar(260) + padding-izq(32) + left-panel(320) + padding-der(32) = 644px usados.
Quedan 722px para el ConversationPanel — pero con paddings internos reales solo ~680px utiles.
A 1024px: solo quedan ~380px para conversaciones — inutilizable.

### Que hacer

**A. Reducir `layout__main` padding cuando estamos en `/app/applications`:**

La vista de Applications necesita ocupar todo el espacio disponible, no tener
32px de aire alrededor. Dos opciones (elige la que rompa menos):

- **Opcion preferida**: Hacer que `ApplicationsView` use margin negativo para
  compensar el padding del padre, o agregar una clase `layout__main--flush` que
  el layout aplique cuando la ruta actual lo requiera (applications, calendario, etc.).
  Valor objetivo: `padding: 0.5rem` maximo en estas vistas, `2rem` en las demas.

- **Alternativa**: Que `ApplicationsView` se renderice como un panel `position: absolute; inset: 0`
  que ignore el padding del padre. No recomendada porque rompe el scroll.

**B. Compactar el panel izquierdo (arbol de apps):**

Valores actuales vs objetivos:

| Elemento | Actual | Objetivo | Razon |
|----------|--------|----------|-------|
| `.panel-header` padding | `1rem 1rem 0.5rem` | `0.5rem 0.75rem 0.35rem` | Outlook usa ~8px en headers de panel |
| `.panel-search` margin | `0.5rem 1rem` | `0.25rem 0.5rem` | Reducir aire entre header y search |
| `.panel-search` padding | `0.5rem 0.75rem` | `0.35rem 0.5rem` | Input mas ajustado |
| `.app-node__header` padding | `0.6rem 1rem` | `0.35rem 0.5rem` | Nodos de app mas compactos |
| `.app-node__tree` padding-left | `0.5rem` | `0.75rem` | **Aumentar** para diferenciar folders del nodo app |
| `.btn-icon` (nueva app) | `32px` | `26px` | Boton mas sutil |

**C. Compactar el arbol de folders (FolderTreeNode):**

| Elemento | Actual | Objetivo |
|----------|--------|----------|
| `.tn__row` padding | `3px 6px 3px 2px` | `2px 4px` (simetrico) |
| `.tn__row` min-height | `28px` | `24px` |
| `.tn__row` gap | `4px` | `3px` |
| `.tn__children` margin-left + padding-left | `9px + 12px = 21px` | `7px + 10px = 17px` |
| `.tn__name` font-size | `12px` | `12px` (mantener) |
| `.tn__chevron` size | `16px` | `14px` |
| `.tn__icon` font-size | `14px` | `13px` |
| `.tn__dots` size | `20px` | `18px` |

**D. Compactar ConversationPanel:**

| Elemento | Actual | Objetivo |
|----------|--------|----------|
| `.toolbar` padding | `0.65rem 1rem` | `0.4rem 0.75rem` |
| `.search-bar` margin | `0.5rem 0.75rem` | `0.3rem 0.5rem` |
| `.search-bar` padding | `0.4rem 0.65rem` | `0.3rem 0.5rem` |
| `.mail-item__body` padding | `0.6rem 1rem 0.6rem 0.75rem` | `0.4rem 0.5rem` (simetrico) |
| `.reading` padding | `1.25rem` | `0.75rem` |
| `.placeholder` padding | `2rem` | `1.25rem` |
| `.placeholder__icon` font-size | `3rem` | `2rem` |

**E. Compactar modales:**

| Elemento | Actual | Objetivo |
|----------|--------|----------|
| `.modal-content` padding | `1.75rem` | `1.25rem` |
| `.modal-header` margin-bottom | `1rem` | `0.65rem` |
| `.modal-actions` margin-top | `1.25rem` | `0.75rem` |

---

## Problema 2 — Indentacion del arbol (main_box confusa)

### Diagnostico

La `main_box` se renderiza con solo `0.5rem` (8px) de padding-left respecto
al nodo de la aplicacion padre (`app-node__header`). Visualmente se confunden.

El nodo de app tiene: chevron + color-dot + nombre + dots.
La main_box tiene: chevron + icon + nombre + dots.
Ambos se ven casi al mismo nivel horizontal.

### Que hacer

**A. Aumentar la indentacion del primer nivel:**

`.app-node__tree` debe tener mas padding-left. Cambiar de `0.5rem` a `1.25rem` (20px).
Esto empuja todo el arbol de folders hacia la derecha, diferenciandolo del nodo app.

**B. Diferenciar visualmente el nodo app del nodo main_box:**

El nodo de la aplicacion (`app-node__header`) debe verse como un **header de seccion**,
no como un nodo mas del arbol. Debe tener:

- Fondo sutil cuando esta expandido: `background: rgba(42, 199, 143, 0.04)`.
- Borde inferior cuando expandido para separarlo del arbol.
- El color-dot mas grande: `12px` en vez de `10px`.
- Font-weight: `700` (actualmente `600`).
- Font-size: `0.85rem` (actualmente `0.9rem` — reducir para compacidad).

La main_box en cambio debe verse como un nodo de arbol normal, no como header.

**C. El tree-guide del arbol debe arrancar alineado al centro del chevron del app-node:**

Actualmente el guide vertical del arbol (`tn__children::before`) arranca desde
el borde izquierdo de `tn__children`. Debe arrancar alineado al centro del chevron
de la app, para que la jerarquia visual sea clara:

```
v App 1                    <-- chevron aqui
  |
  |-- [inbox] Bandeja 1    <-- linea vertical alineada al chevron
  |     |
  |     |-- [layer] Tier 1
  |     |     |
  |     |     |-- [user] Juan
```

---

## Problema 3 — Panel derecho no se puede cerrar ni alternar vista

### Diagnostico

- El ConversationPanel ocupa `flex: 1` siempre. No se puede ocultar.
- En mobile (< 768px) simplemente desaparece (`display: none`), sin alternativa.
- No hay toolbar para cambiar entre layouts.
- Cuando se navega de "reading" a "list", el panel sigue ocupando el mismo espacio.

### Que hacer — Toolbar de vistas + layouts alternables

**A. Crear un toolbar en ApplicationsView** (no dentro de ConversationPanel):

Ubicacion: entre el header de la pagina y el split-panel. Altura: ~32px.
Estilo: barra fina, fondo `var(--bg-main)`, borde inferior `1px solid var(--border-light)`.

Contenido del toolbar:
```
[icon: bx-dock-right]  [icon: bx-dock-bottom]  [icon: bx-list-ul]    |  Carpeta: "Bandeja Principal"
    Vista Split H         Vista Split V           Solo Arbol           |  Breadcrumb contextual
```

Los tres iconos son toggle buttons. El activo tiene fondo `rgba(42, 199, 143, 0.1)`
y color `var(--primary-500)`.

**B. Implementar tres layouts:**

1. **`split-h`** (horizontal, default): Panel izquierdo a la izquierda, ConversationPanel
   a la derecha. Es el layout actual. Pero con un boton (X) en la esquina superior
   derecha del ConversationPanel que cambia a layout `tree-only`.

2. **`split-v`** (vertical): Panel izquierdo arriba (height: 40%, max-height: 300px),
   ConversationPanel abajo (flex: 1). El arbol queda como lista compacta arriba
   y las conversaciones abajo. Util en pantallas anchas pero bajas.

3. **`tree-only`**: Solo el panel izquierdo, ocupa 100% del ancho. El ConversationPanel
   no se renderiza. Cuando el usuario selecciona una carpeta, puede volver a
   `split-h` haciendo click en un boton "Ver conversaciones" o haciendo doble-click
   en la carpeta.

**C. Guardar la preferencia del usuario:**

Guardar el layout seleccionado en `localStorage` como `tyflow_app_layout`.
Valor por defecto: `'split-h'`. Restaurar al montar la vista.

**D. Logica del estado del layout:**

Agregar al `useApplicationStore`:
```js
// Nuevo estado
viewLayout: 'split-h',  // 'split-h' | 'split-v' | 'tree-only'

// Nueva accion
setViewLayout(layout) {
  this.viewLayout = layout
  localStorage.setItem('tyflow_app_layout', layout)
}
```

Inicializar en el store:
```js
viewLayout: localStorage.getItem('tyflow_app_layout') || 'split-h'
```

---

## Problema 4 — Responsive roto en multiples breakpoints

### Diagnostico

- A 1024px, el ConversationPanel queda con ~380px — demasiado estrecho para emails.
- A 768px, ConversationPanel desaparece sin alternativa.
- No hay breakpoint intermedio (900px, 850px).
- Los modales no se ajustan por debajo de 768px (siguen con max-width grandes).
- El arbol no reduce indentacion en pantallas estrechas.

### Que hacer

**A. Nuevos breakpoints en ApplicationsView:**

```css
/* >= 1200px: layout actual, split-h funciona bien */

/* 900px - 1199px: reducir panel izquierdo */
@media (max-width: 1199px) {
  .app-split__left { width: 260px; min-width: 220px; }
}

/* 768px - 899px: forzar tree-only en split-h, o cambiar a split-v */
@media (max-width: 899px) {
  .app-split__left { width: 240px; min-width: 200px; }
  /* El panel derecho queda muy estrecho, forzar layout cambio */
}

/* < 768px: stack vertical completo */
@media (max-width: 767px) {
  .app-split { flex-direction: column; }
  .app-split__left {
    width: 100%;
    max-height: none; /* en tree-only ocupa todo */
  }
  .app-split__right {
    /* NO usar display:none. En su lugar: */
    /* En tree-only: no renderizar */
    /* En split-v: flex: 1, debajo del arbol */
    /* En split-h: comportarse como split-v automaticamente */
  }
}
```

**B. El layout debe ser adaptativo, no solo responsive:**

En mobile, `split-h` debe comportarse automaticamente como `split-v`
(arbol arriba, conversaciones abajo). No desaparecer.

En tablet (768-1024px), `split-h` debe reducir el panel izquierdo a 240px
y el panel derecho ocupa el resto.

Solo en `tree-only` el panel derecho no se renderiza (en ninguna resolucion).

**C. Responsive del arbol:**

En pantallas < 900px, reducir la indentacion del arbol:

```css
@media (max-width: 899px) {
  .tn__children {
    margin-left: 5px;
    padding-left: 8px;
  }
  .tn__row { min-height: 22px; }
  .tn__name { font-size: 11px; }
}
```

---

## Problema 5 — Click derecho debe funcionar nativamente

### Diagnostico actual

El context menu funciona con `@contextmenu` en FolderTreeNode y con click en
el boton de dots en ApplicationsView. Ambos abren `ContextMenu.vue`.

Funciona, pero hay problemas:
- El menu no se cierra con Escape si no se le da focus.
- Los items no tienen hover keyboard (no se puede navegar con flechas).
- En mobile, el click derecho no existe — solo los dots funcionan.

### Que hacer

**A. Mejorar ContextMenu.vue:**

- Agregar `@keydown.escape` para cerrar.
- Hacer que el menu se enfoque automaticamente al abrirse (`nextTick -> menuRef.focus()`).
- Agregar atributo `tabindex="-1"` al contenedor para que reciba focus.
- Agregar `role="menu"` y `role="menuitem"` para accesibilidad.

**B. Agregar separadores visuales en el menu contextual:**

Actualmente los items estan sin separacion. Agregar una linea divisoria antes
del item "Eliminar" (el item con `danger: true`):

```css
.ctx-menu__item--danger {
  border-top: 1px solid var(--border-light);
  margin-top: 0.15rem;
  padding-top: 0.55rem;
}
```

**C. Animacion de entrada:**

Agregar una animacion sutil de fade-in + scale al abrir:

```css
.ctx-menu {
  animation: ctx-appear 0.1s ease-out;
}

@keyframes ctx-appear {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

---

## Problema 6 — Panel izquierdo: ancho fijo vs proporcional

### Diagnostico

El panel izquierdo tiene `width: 320px` fijo. En un viewport de 1366px con
sidebar de 260px, eso es razonable. Pero a 1024px es demasiado.

### Que hacer

Cambiar de ancho fijo a un sistema proporcional con limites:

```css
.app-split__left {
  width: 280px;        /* default mas compacto */
  min-width: 220px;
  max-width: 340px;
  flex-shrink: 0;
}
```

En el futuro se puede hacer resizable con un drag-handle, pero **no ahora** (YAGNI).

---

## Problema 7 — La sidebar y la vista compiten por espacio

### Diagnostico

Cuando la sidebar esta abierta (260px) y el panel izquierdo del arbol (320px),
juntos consumen 580px + 64px de paddings = 644px. A 1024px queda inutilizable.

### Que hacer

**A. En la ruta `/app/applications`, auto-colapsar la sidebar si viewport < 1200px:**

En `MainLayout.vue`, watch la ruta y el viewport:
```js
// Si estamos en /app/applications y viewport < 1200px, colapsar sidebar
watch([() => route.path, viewportWidth], ([path, width]) => {
  if (path.startsWith('/app/applications') && width < 1200 && !sidebarCollapsed.value) {
    sidebarCollapsed.value = true
  }
})
```

Esto no es un hack — Outlook hace exactamente lo mismo. Cuando abres el panel de
carpetas y el viewport es estrecho, Outlook auto-colapsa la barra lateral a iconos.

**B. Alternativa mas simple (si el watch es demasiado invasivo):**

Que `ApplicationsView` emita un evento `layout-needs-space` que `MainLayout` escuche
via `provide/inject` para sugerir colapsar. O simplemente que `ApplicationsView`
tenga un padding especial que tenga en cuenta que la sidebar puede estar abierta.

---

## Paso final — Verificacion integral

Ejecuta esta checklist en orden. No marques nada sin haberlo probado:

### Build
```bash
npm run build
# Sin errores. Warnings de librerias externas son aceptables.
# Warnings del codigo propio deben corregirse.
```

### Spacing
- [ ] A 1920px: todo se ve proporcionado, sin aire excesivo.
- [ ] A 1366px: el panel izquierdo es compacto, el preview tiene espacio suficiente.
- [ ] A 1024px: el arbol y las conversaciones son usables (no estan aplastados).
- [ ] A 768px: el layout cambia a vertical o tree-only, las conversaciones son accesibles.
- [ ] A 480px: el arbol funciona, los nodos son tocables, los modales caben.
- [ ] Ningun elemento tiene padding > 1rem en la vista de Applications.
- [ ] El arbol de folders se ve mas compacto que antes, con nodos de 24px de alto.

### Indentacion del arbol
- [ ] La main_box se ve claramente indentada respecto al nodo de la aplicacion.
- [ ] Los niveles 1, 2, 3 se distinguen visualmente.
- [ ] Las guias del arbol (lineas verticales y horizontales) se alinean correctamente.
- [ ] El nodo de aplicacion se ve como un header, no como un nodo del arbol.

### Toolbar de vistas
- [ ] El toolbar aparece en la parte superior de ApplicationsView.
- [ ] Los tres botones de layout (split-h, split-v, tree-only) funcionan.
- [ ] El layout seleccionado se persiste en localStorage.
- [ ] Al recargar la pagina, el layout se restaura.
- [ ] En mobile, split-h se comporta como split-v automaticamente.

### ConversationPanel
- [ ] En split-h: el panel derecho tiene un boton para cerrarse (cambiar a tree-only).
- [ ] En split-v: el panel esta debajo del arbol.
- [ ] En tree-only: el panel no se renderiza.
- [ ] Al cerrar el panel y reabrirlo, no recarga datos (usa cache del store).
- [ ] El panel no tiene paddings exagerados.

### Context menu
- [ ] Click derecho en un nodo del arbol abre el context menu.
- [ ] El menu se cierra con Escape.
- [ ] El item "Eliminar" tiene un separador visual encima.
- [ ] El menu tiene animacion de fade-in sutil.
- [ ] Los dots (tres puntos) aparecen en hover y funcionan.

### Sidebar
- [ ] A >= 1200px: sidebar y vista coexisten sin problemas.
- [ ] A < 1200px en /app/applications: sidebar se auto-colapsa a 72px.
- [ ] El usuario puede re-expandir la sidebar manualmente.
- [ ] En mobile: sidebar se abre como overlay, no empuja el contenido.

### Responsivo general
- [ ] No hay scroll horizontal en ninguna resolucion.
- [ ] Los modales son usables en todas las resoluciones.
- [ ] Los textos no se cortan de forma ilegible.
- [ ] Los botones tienen area de toque minima de ~32px en mobile.

---

## Notas finales

- No introduzcas dependencias npm nuevas.
- Mantener los textos en espanol.
- No crear archivos nuevos innecesarios — la mayoria de cambios son CSS en archivos existentes.
- Los unicos archivos nuevos posibles son: ninguno. Todo se resuelve editando los existentes.
- Si un cambio CSS en un componente afecta otra vista (ej. UsersView), usa selectores
  scoped o clases condicionales para aislar el impacto.
- El objetivo es que la app se sienta como una herramienta de trabajo profesional
  (Outlook, Gmail, Linear), no como una landing page con mucho aire.
