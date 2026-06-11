import { reactive, computed } from 'vue'

// Contrato de "boards" del shell (topbar + sidebar).
//
// El shell (AppTopbar / AppSidebar) es un chasis fijo con dos outlets:
//   #topbar-board  → espacio contextual de la barra superior
//   #sidebar-board → espacio contextual bajo el brand del sidebar
//
// Las vistas publican contenido montando <TopbarBoard> / <SidebarBoard>
// (Teleport hacia el outlet). El shell no conoce ninguna vista: solo consulta
// aquí si hay contenido publicado para decidir sus defaults (p.ej. mostrar el
// título de la ruta cuando nadie ocupa el board de la topbar).
//
// Se usan contadores (no booleanos) para tolerar transiciones entre rutas en
// las que el board saliente aún no se desmonta cuando el entrante ya se montó.
const counts = reactive({ topbar: 0, sidebar: 0 })

export function useLayoutBoards() {
  return {
    register: (board) => { counts[board]++ },
    unregister: (board) => { counts[board]-- },
    hasTopbarContent: computed(() => counts.topbar > 0),
    hasSidebarContent: computed(() => counts.sidebar > 0),
  }
}
