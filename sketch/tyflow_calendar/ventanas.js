;(function () {
// ============================================================
// TyFlow — Panel de ventanas de trabajo (rediseño)
// Demo interactiva. Estructura espejo del SFC para portar fácil.
// ============================================================
const { createApp, ref, computed, reactive } = Vue;

// ---- Datos mock (reflejan las capturas) ----
const SPECIALISTS = [
  { specialistId: 'cesar', fullName: 'Cesar Camilo Ramirez Macanche' },
  { specialistId: 'santiago', fullName: 'Santiago Reyes Gonzalez' },
  { specialistId: 'diego', fullName: 'Diego Manta' },
  { specialistId: 'pablo', fullName: 'Pablo Emilio Garcia' },
];
const APPLICATIONS = [
  { id: 'jxxi', name: 'Justicia XXI Web', color: '#3B82F6' },
  { id: 'cierres', name: 'Cierres Judiciales', color: '#F59E0B' },
  { id: 'firma', name: 'Firma electronica', color: '#06B6D4' },
  { id: 'demanda', name: 'Demanda en linea', color: '#10B981' },
  { id: 'tutela', name: 'Tutela en linea', color: '#22C55E' },
  { id: 'samai', name: 'SAMAI', color: '#8B5CF6' },
];

let _id = 0;
const W = (specialistId, applicationId, startH, endH, isActive, opening, current, inheritLabel) => ({
  id: 'w' + (++_id),
  specialistId, applicationId,
  startHour: startH, endHour: endH,
  timeRange: fmtRange(startH, endH),
  isActive,
  openingCount: opening, currentCount: current, closingCount: null,
  inheritLabel: inheritLabel || '',
});

function fmtH(h) {
  const hr = Math.floor(h), m = Math.round((h - hr) * 60);
  return `${String(hr).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtRange(a, b) { return `${fmtH(a)} – ${fmtH(b)}`; }

// 8 ventanas / 4 especialistas — Diego x3, Santiago x2, Cesar x1, Pablo x2
const WINDOWS = [
  W('cesar', 'jxxi', 14, 17, true, 5, 3, '← Cesar Camilo Ramirez Macanche · 9 7:00 – 13:00'),
  W('santiago', 'jxxi', 14, 17, true, 4, 2, '← Santiago Reyes Gonzalez · 8 21:00 – 0:00'),
  W('santiago', 'cierres', 9, 13, true, 2, 1, ''),
  W('diego', 'firma', 14, 17, true, 3, 2, '← Diego Manta · 9 7:00 – 13:00'),
  W('diego', 'demanda', 14, 17, true, 6, 4, '← Diego Manta · 9 7:00 – 13:00'),
  W('diego', 'tutela', 14, 17, false, 2, 1, '← Diego Manta · 9 7:00 – 13:00'),
  W('pablo', 'jxxi', 10, 16, true, 7, 5, ''),
  W('pablo', 'samai', 16, 21, true, 3, 2, ''),
];

const DAY_START = 7, DAY_END = 21; // franja visible de cobertura

const specOf = (id) => SPECIALISTS.find(s => s.specialistId === id) || { fullName: id };
const appOf = (id) => APPLICATIONS.find(a => a.id === id) || { name: id, color: '#8b8fea' };
const initialsOf = (name) => name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

const App = {
  setup() {
    const theme = ref('light');
    const grouped = ref(true);          // agrupado por especialista (ON) vs plano (OFF)
    const sortBy = ref('load');         // load | name
    const view = reactive({ mode: 'list', specialistId: null }); // list | detail
    const windows = reactive(WINDOWS.map(w => ({ ...w })));
    const singleWin = ref(null);        // ventana abierta en modal
    const toast = ref('');
    let toastT = null;

    function showToast(msg) { toast.value = msg; clearTimeout(toastT); toastT = setTimeout(() => toast.value = '', 2000); }
    function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme.value; }

    // agrupar ventanas por especialista
    const specGroups = computed(() => {
      const map = new Map();
      for (const w of windows) {
        if (!map.has(w.specialistId)) map.set(w.specialistId, []);
        map.get(w.specialistId).push(w);
      }
      let groups = [...map.entries()].map(([sid, ws]) => {
        const opening = ws.reduce((n, w) => n + (w.openingCount || 0), 0);
        const current = ws.reduce((n, w) => n + (w.currentCount || 0), 0);
        const activeN = ws.filter(w => w.isActive).length;
        const apps = [...new Set(ws.map(w => w.applicationId))];
        const times = [...new Set(ws.map(w => w.timeRange))];
        const allActive = activeN === ws.length;
        const allInactive = activeN === 0;
        // agrupar ventanas del especialista por horario (timeRange)
        const schedMap = new Map();
        for (const w of ws) {
          if (!schedMap.has(w.timeRange)) schedMap.set(w.timeRange, { timeRange: w.timeRange, startHour: w.startHour, windows: [] });
          schedMap.get(w.timeRange).windows.push(w);
        }
        const schedules = [...schedMap.values()].sort((a, b) => a.startHour - b.startHour);
        return {
          specialistId: sid, spec: specOf(sid), windows: ws,
          opening, current, apps, times, activeN, schedules,
          status: allActive ? 'active' : allInactive ? 'inactive' : 'mixed',
        };
      });
      if (sortBy.value === 'load') groups.sort((a, b) => b.current - a.current || b.windows.length - a.windows.length);
      else groups.sort((a, b) => a.spec.fullName.localeCompare(b.spec.fullName));
      return groups;
    });

    const detailGroup = computed(() => specGroups.value.find(g => g.specialistId === view.specialistId) || null);

    // cobertura: segmentos para la barra temporal
    function coverageSegs(ws) {
      const span = DAY_END - DAY_START;
      return ws.map(w => {
        const a = appOf(w.applicationId);
        const left = Math.max(0, (w.startHour - DAY_START) / span) * 100;
        const width = Math.min(100, (w.endHour - w.startHour) / span * 100);
        return { id: w.id, left, width, color: a.color, active: w.isActive };
      });
    }

    function openDetail(g) {
      if (g.windows.length === 1) { singleWin.value = g.windows[0]; return; }
      view.specialistId = g.specialistId; view.mode = 'detail';
    }
    function backToList() { view.mode = 'list'; view.specialistId = null; }

    function toggleWindow(w) { w.isActive = !w.isActive; showToast(w.isActive ? 'Ventana habilitada.' : 'Ventana inhabilitada.'); }
    function deleteWindow(w) {
      const i = windows.findIndex(x => x.id === w.id);
      if (i >= 0) windows.splice(i, 1);
      showToast('Ventana eliminada.');
      if (detailGroup.value && detailGroup.value.windows.length === 0) backToList();
    }
    function disableAll(g) { g.windows.forEach(w => w.isActive = false); showToast(`${g.windows.length} ventanas de ${g.spec.fullName.split(' ')[0]} inhabilitadas.`); }
    function deleteSpec(g) {
      const ids = new Set(g.windows.map(w => w.id));
      for (let i = windows.length - 1; i >= 0; i--) if (ids.has(windows[i].id)) windows.splice(i, 1);
      showToast(`Ventanas de ${g.spec.fullName.split(' ')[0]} eliminadas.`);
      if (view.mode === 'detail') backToList();
    }

    const totalWindows = computed(() => windows.length);

    return {
      theme, grouped, sortBy, view, windows, singleWin, toast,
      specGroups, detailGroup, totalWindows,
      appOf, specOf, initialsOf, coverageSegs,
      openDetail, backToList, toggleWindow, deleteWindow, disableAll, deleteSpec,
      toggleTheme, showToast,
      fmtH, DAY_START, DAY_END,
    };
  },
};

// Vue global build compiles the in-DOM markup of #app as the template.
createApp(App).mount('#app');
})();
