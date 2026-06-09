;(function(){
// ============================================================
// TyFlow Calendar — datos de dominio + helpers (Vue)
// Modelo real: especialistas, aplicaciones y "ventanas de
// trabajo" (specialist + app + día/hora, activa/inactiva).
// ============================================================

// ---- Aplicaciones (paleta curada y armónica) ----
const APPS = [
  { id: 'app-web',   name: 'Soporte Web', short: 'Web', color: '#4F8DF7' },
  { id: 'app-wa',    name: 'WhatsApp',    short: 'WA',  color: '#1FA888' },
  { id: 'app-out',   name: 'Outlook',     short: 'OUT', color: '#9B6DF3' },
  { id: 'app-judit', name: 'Judit',       short: 'JUD', color: '#21B3C6' },
  { id: 'app-call',  name: 'Llamadas',    short: 'TEL', color: '#E0A23B' },
  { id: 'app-crm',   name: 'CRM',         short: 'CRM', color: '#E0675F' },
];

// ---- Especialistas ----
const SPECIALISTS = [
  { id: 'sp-cc', fullName: 'Carla Castro' },
  { id: 'sp-pe', fullName: 'Pablo Emiliano' },
  { id: 'sp-sr', fullName: 'Santiago Rendón' },
  { id: 'sp-dm', fullName: 'Diana Marín' },
  { id: 'sp-mv', fullName: 'Mateo Vargas' },
  { id: 'sp-lo', fullName: 'Lucía Ortega' },
];

// Semana Lun 8 jun → Dom 14 jun 2026 (ISO, índice 0 = lunes)
const WEEK_DATES = [
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11',
  '2026-06-12', '2026-06-13', '2026-06-14',
];

// ---- Ventanas de trabajo ----
let _wid = 0;
const W = (day, sp, app, start, end, active = true) => ({
  id: 'w' + (++_wid), day, specialistId: sp, appId: app, start, end, active,
});

const WINDOWS = [
  // Lunes: el "muro" — varias ventanas de día completo → lane "todo el día"
  W(0, 'sp-cc', 'app-web', 8, 20),
  W(0, 'sp-pe', 'app-web', 8, 20),
  W(0, 'sp-sr', 'app-web', 8, 20),
  W(0, 'sp-dm', 'app-web', 8, 20),
  W(0, 'sp-lo', 'app-wa', 9, 13),
  W(0, 'sp-mv', 'app-out', 14, 18, false),

  // Martes: otra pila larga + un par cronometradas
  W(1, 'sp-cc', 'app-judit', 8.5, 21),
  W(1, 'sp-pe', 'app-judit', 8.5, 21),
  W(1, 'sp-mv', 'app-judit', 8.5, 21),
  W(1, 'sp-lo', 'app-crm', 15, 19),

  // Miércoles: ejemplos cronometrados limpios
  W(2, 'sp-sr', 'app-web', 10.5, 16.5),
  W(2, 'sp-pe', 'app-call', 10, 16.5),
  W(2, 'sp-dm', 'app-call', 11, 15),

  // Jueves: solapamiento (3 columnas) + mezcla
  W(3, 'sp-cc', 'app-judit', 8.5, 12.5),
  W(3, 'sp-lo', 'app-judit', 9, 12),
  W(3, 'sp-mv', 'app-judit', 9.5, 11.5),
  W(3, 'sp-dm', 'app-crm', 13, 17),
  W(3, 'sp-sr', 'app-wa', 14, 18.5, false),

  // Viernes
  W(4, 'sp-sr', 'app-out', 10, 14),
  W(4, 'sp-pe', 'app-wa', 15, 19, false),
  W(4, 'sp-cc', 'app-web', 9, 12.5),

  // Sábado (fin de semana ligero)
  W(5, 'sp-lo', 'app-wa', 10, 13),
];

// ---- Helpers ----
function appById(id) { return APPS.find(a => a.id === id); }
function specById(id) { return SPECIALISTS.find(s => s.id === id); }

function initialsOf(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function fmtHour(h, compact) {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr < 12 ? 'AM' : 'PM';
  let hh = hr % 12; if (hh === 0) hh = 12;
  if (compact) return `${hh}${ampm === 'AM' ? 'a' : 'p'}`;
  return min === 0 ? `${hh} ${ampm}` : `${hh}:${String(min).padStart(2, '0')} ${ampm}`;
}
function fmtRange(start, end) { return `${fmtHour(start)} – ${fmtHour(end)}`; }
function durationHrs(w) { return w.end - w.start; }

const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ALLDAY_THRESHOLD = 9;  // ventanas >= 9h suben al lane "todo el día"
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Asignación de columnas (greedy) para ventanas cronometradas de un día.
// Devuelve [{ w, col, cols }] usando clústeres de solapamiento transitivo.
function layoutColumns(timed) {
  const sorted = [...timed].sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let cluster = [], clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    const cols = [], placed = [];
    for (const w of cluster) {
      let ci = cols.findIndex(end => end <= w.start + 1e-6);
      if (ci === -1) { ci = cols.length; cols.push(w.end); } else cols[ci] = w.end;
      placed.push({ w, col: ci });
    }
    const total = cols.length;
    placed.forEach(p => out.push({ w: p.w, col: p.col, cols: total }));
    cluster = []; clusterEnd = -Infinity;
  };
  for (const w of sorted) {
    if (w.start >= clusterEnd - 1e-6 && cluster.length) flush();
    cluster.push(w);
    clusterEnd = Math.max(clusterEnd, w.end);
  }
  flush();
  return out;
}

function splitDay(windows) {
  const allDay = [], timed = [];
  for (const w of windows) (durationHrs(w) >= ALLDAY_THRESHOLD ? allDay : timed).push(w);
  return { allDay, timed };
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push({
      day: d.getDate(), inMonth: d.getMonth() === month, dow: (d.getDay() + 6) % 7,
      date: d,
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  }
  return cells;
}

window.TY = {
  APPS, SPECIALISTS, WINDOWS, WEEK_DATES, HOURS,
  appById, specById, initialsOf, fmtHour, fmtRange, durationHrs,
  DAY_LABELS, DAY_FULL, MONTHS, ALLDAY_THRESHOLD,
  layoutColumns, splitDay, buildMonthGrid,
};
})();
