;(function(){
// ============================================================
// TyFlow Casos — datos de dominio + helpers (Vue)
// Modelo: especialistas con turnos (ventanas), aplicaciones,
// orígenes (TyFlow / Outlook / Judit) y casos con estado,
// prioridad, especialista asignado y antigüedad (espera).
// ============================================================

// ---- Orígenes (canal de entrada del caso) ----
const ORIGINS = {
  tyflow:  { id: 'tyflow',  name: 'TyFlow',  icon: 'bx-edit',         color: 'var(--origin-tyflow)',  bg: 'var(--origin-tyflow-bg)' },
  outlook: { id: 'outlook', name: 'Outlook', icon: 'bx-envelope',     color: 'var(--origin-outlook)', bg: 'var(--origin-outlook-bg)' },
  judit:   { id: 'judit',   name: 'Judit',   icon: 'bxs-id-card',     color: 'var(--origin-judit)',   bg: 'var(--origin-judit-bg)' },
};

// ---- Estados de caso ----
const STATUSES = {
  abierto:     { id: 'abierto',     name: 'Abierto',     color: 'var(--status-open)',        bg: 'var(--status-open-bg)' },
  asignado:    { id: 'asignado',    name: 'Asignado',    color: 'var(--status-assigned)',    bg: 'var(--status-assigned-bg)' },
  progreso:    { id: 'progreso',    name: 'En progreso', color: 'var(--status-in-progress)', bg: 'var(--status-in-progress-bg)' },
  resuelto:    { id: 'resuelto',    name: 'Resuelto',    color: 'var(--status-resolved)',    bg: 'var(--status-resolved-bg)' },
  cerrado:     { id: 'cerrado',     name: 'Cerrado',     color: 'var(--status-closed)',      bg: 'var(--status-closed-bg)' },
};

// ---- Prioridades ----
const PRIORITIES = {
  urgente: { id: 'urgente', name: 'Urgente', rank: 0, color: 'var(--priority-urgent)', bg: 'var(--priority-urgent-bg)' },
  alta:    { id: 'alta',    name: 'Alta',    rank: 1, color: 'var(--priority-high)',   bg: 'var(--priority-high-bg)' },
  normal:  { id: 'normal',  name: 'Normal',  rank: 2, color: 'var(--priority-normal)', bg: 'var(--priority-normal-bg)' },
  baja:    { id: 'baja',    name: 'Baja',    rank: 3, color: 'var(--priority-low)',    bg: 'var(--priority-low-bg)' },
};

// ---- Aplicaciones (sistemas judiciales sobre los que se trabaja) ----
const APPS = [
  { id: 'app-jxxi',  name: 'Justicia XXI Web', short: 'JXXI', color: '#4F8DF7' },
  { id: 'app-cierres', name: 'Cierres Judiciales', short: 'CJ', color: '#9B6DF3' },
  { id: 'app-tyba',  name: 'Tyba',             short: 'TYB',  color: '#1FA888' },
  { id: 'app-samai', name: 'SAMAI',            short: 'SAM',  color: '#21B3C6' },
  { id: 'app-cdl',   name: 'Consulta de Procesos', short: 'CP', color: '#E0A23B' },
];

// ---- Especialistas (con turno, capacidad y ventanas de trabajo) ----
// windows: turnos vigentes hoy → app + rango horario + casos activos en ese turno
const SPECIALISTS = [
  {
    id: 'sp-pg', fullName: 'Pablo Emilio Garcia', initials: 'PG', color: '#4F8DF7',
    turno: true, capacity: 12, role: 'Senior', email: 'pablo.garcia@tyflow.co',
    apps: ['app-jxxi', 'app-cierres'],
    windows: [
      { appId: 'app-cierres', start: 10.5, end: 16.5 },
      { appId: 'app-jxxi',    start: 14.5, end: 21 },
    ],
  },
  {
    id: 'sp-dm', fullName: 'Diego Manta', initials: 'DM', color: '#1FA888',
    turno: true, capacity: 10, role: 'Senior', email: 'diego.manta@tyflow.co',
    apps: ['app-jxxi', 'app-tyba'],
    windows: [
      { appId: 'app-jxxi', start: 8, end: 14 },
      { appId: 'app-tyba', start: 14, end: 18 },
    ],
  },
  {
    id: 'sp-sr', fullName: 'Santiago Reyes Gonzalez', initials: 'SR', color: '#9B6DF3',
    turno: true, capacity: 10, role: 'Pleno', email: 'santiago.reyes@tyflow.co',
    apps: ['app-jxxi', 'app-samai'],
    windows: [
      { appId: 'app-samai', start: 9, end: 13 },
      { appId: 'app-jxxi',  start: 13, end: 19 },
    ],
  },
  {
    id: 'sp-cr', fullName: 'Cesar Camilo Ramirez Macanche', initials: 'CR', color: '#E0A23B',
    turno: true, capacity: 9, role: 'Pleno', email: 'cesar.ramirez@tyflow.co',
    apps: ['app-jxxi', 'app-cdl'],
    windows: [
      { appId: 'app-jxxi', start: 8.5, end: 15.5 },
    ],
  },
  {
    id: 'sp-at', fullName: 'Andres Tao', initials: 'AT', color: '#21B3C6',
    turno: false, capacity: 8, role: 'Junior', email: 'andres.tao@tyflow.co',
    apps: ['app-tyba'],
    windows: [],
  },
  {
    id: 'sp-jp', fullName: 'Juan Camilo Perez Ramirez', initials: 'JP', color: '#E0675F',
    turno: true, capacity: 11, role: 'Pleno', email: 'juan.perez@tyflow.co',
    apps: ['app-jxxi', 'app-cierres', 'app-samai'],
    windows: [
      { appId: 'app-cierres', start: 7.5, end: 13 },
      { appId: 'app-jxxi',    start: 13, end: 20 },
    ],
  },
];

// ---- Asuntos realistas (mezcla TyFlow / Outlook / Judit) ----
const SUBJECTS = {
  tyflow: [
    'Nuevo caso', 'Caso de prueba 2', 'Caso de Prueba',
    'Consolidacion de expedientes duplicados', 'Revision interna de expediente archivado',
    'Caso devuelto por error en clasificacion', 'Caso complejo - requiere analisis juridico',
    'Preparacion de informe mensual', 'Solicitud de cierre de expediente',
    'Auditoria de casos cerrados mayo 2026', 'Solicitud de radicacion',
    'Solicitud de desarchivo expediente', 'Reasignacion pendiente por vacaciones',
    'Revision de auto inadmisorio', 'Verificacion de notificacion personal',
    'Actualizacion de datos del proceso', 'Control de terminos procesales',
  ],
  outlook: [
    'FW: Correccion de datos en sistema', 'RE: Requerimiento urgente - expediente 3847',
    'Solicitud de cierre de expediente', 'Consulta sobre estado de demanda',
    'Consulta sobre requisitos de radicacion', 'FW: Notificacion judicial pendiente',
    'RE: Documentos faltantes en radicacion', 'Solicitud de copia de providencia',
    'FW: Traslado de demanda', 'RE: Aclaracion sobre auto de mandamiento',
  ],
  judit: [
    'INC-2026-09203 Error de firma electronica', 'INC-2026-09102 Permiso denegado en Justicia XXI',
    'INC-2026-10023 Certificado no generado', 'INC-2026-09812 Pantalla en blanco al ingresar',
    'INC-2026-09901 Error 500 en consulta publica', 'INC-2026-10145 Timeout al cargar expediente',
    'INC-2026-09744 Documento no se adjunta', 'INC-2026-10210 Sesion expira al firmar',
  ],
};

const DESCRIPTIONS = [
  'Caso estandar, seguir procedimiento normal.',
  'Requiere validacion con el area juridica antes de continuar.',
  'El usuario reporta intermitencia al guardar. Reproducir y documentar.',
  'Expediente con documentos duplicados; consolidar y depurar.',
  'Pendiente de respuesta del despacho. Hacer seguimiento.',
  'Escalado desde soporte nivel 1. Prioridad segun terminos.',
  'Verificar firma electronica y reintentar el cierre.',
  'Caso devuelto: clasificacion incorrecta en el ingreso.',
];

// ============================================================
// Generador determinista de casos (seeded) — ~112 casos
// ============================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260608);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const hex = (n) => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(rng() * 16)]).join('');

// distribución de estados / prioridades (pesos realistas)
const STATUS_POOL = [
  ...Array(40).fill('asignado'),
  ...Array(16).fill('progreso'),
  ...Array(10).fill('abierto'),
  ...Array(14).fill('resuelto'),
  ...Array(20).fill('cerrado'),
];
const PRIORITY_POOL = [
  ...Array(8).fill('urgente'),
  ...Array(18).fill('alta'),
  ...Array(60).fill('normal'),
  ...Array(14).fill('baja'),
];
const ORIGIN_POOL = [
  ...Array(58).fill('tyflow'),
  ...Array(30).fill('outlook'),
  ...Array(12).fill('judit'),
];

// "creado" relativo (en horas desde ahora) → para calcular espera/antigüedad
function waitLabel(hours) {
  if (hours < 1) return 'hace min';
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

const CASES = [];
const N = 112;
for (let i = 0; i < N; i++) {
  const originId = ORIGIN_POOL[Math.floor(rng() * ORIGIN_POOL.length)];
  const statusId = (i < 3) ? 'asignado' : STATUS_POOL[Math.floor(rng() * STATUS_POOL.length)];
  const priorityId = PRIORITY_POOL[Math.floor(rng() * PRIORITY_POOL.length)];
  const subject = pick(SUBJECTS[originId]);
  const isClosed = statusId === 'cerrado' || statusId === 'resuelto';
  const assignedTo = statusId === 'abierto' ? null : pick(SPECIALISTS).id;
  const app = pick(APPS).id;

  // antigüedad: los primeros más recientes, luego ~6 días
  let waitH;
  if (i === 0) waitH = 40;
  else if (i < 3) waitH = 50;
  else waitH = 6 * 24 + 9 + (rng() * 6 - 3);

  CASES.push({
    id: '#' + hex(6),
    seq: i,
    subject,
    originId,
    statusId,
    priorityId,
    appId: app,
    specialistId: isClosed ? assignedTo : assignedTo,
    waitH,
    createdLabel: waitLabel(waitH),
    description: pick(DESCRIPTIONS),
    createdISO: '2026-06-02',
    assignedISO: '2026-06-06',
  });
}

// ---- Helpers ----
function appById(id) { return APPS.find(a => a.id === id); }
function specById(id) { return SPECIALISTS.find(s => s.id === id); }
function originOf(c) { return ORIGINS[c.originId]; }
function statusOf(c) { return STATUSES[c.statusId]; }
function priorityOf(c) { return PRIORITIES[c.priorityId]; }

function casesOf(specId) { return CASES.filter(c => c.specialistId === specId); }
function activeCasesOf(specId) {
  return CASES.filter(c => c.specialistId === specId && c.statusId !== 'cerrado' && c.statusId !== 'resuelto');
}

// carga = casos activos / capacidad
function loadOf(spec, thresholds) {
  const active = activeCasesOf(spec.id).length;
  const ratio = spec.capacity ? active / spec.capacity : 0;
  const t = thresholds || { mid: 0.5, high: 0.8 };
  let level = 'low';
  if (ratio >= t.high) level = 'high';
  else if (ratio >= t.mid) level = 'mid';
  return { active, capacity: spec.capacity, ratio, level };
}

const LOAD_COLOR = { low: 'var(--load-low)', mid: 'var(--load-mid)', high: 'var(--load-high)' };
const LOAD_LABEL = { low: 'Disponible', mid: 'Media', high: 'Saturado' };

function fmtHour(h) {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr < 12 ? 'a. m.' : 'p. m.';
  let hh = hr % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(min).padStart(2, '0')} ${ampm}`;
}
function fmtRange(s, e) { return `${fmtHour(s)}–${fmtHour(e)}`; }

window.TYC = {
  ORIGINS, STATUSES, PRIORITIES, APPS, SPECIALISTS, CASES,
  appById, specById, originOf, statusOf, priorityOf,
  casesOf, activeCasesOf, loadOf, LOAD_COLOR, LOAD_LABEL,
  fmtHour, fmtRange, waitLabel,
};
})();
