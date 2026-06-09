;(function(){
// ============================================================
// TyFlow Casos — vistas (Lista / Especialistas / Cargas)
// ============================================================
const T = window.TYC;
const C = window.TYC_C;
const {
  ORIGINS, STATUSES, PRIORITIES, APPS, SPECIALISTS, CASES,
  appById, specById, originOf, statusOf, priorityOf,
  casesOf, activeCasesOf, loadOf, LOAD_COLOR, LOAD_LABEL, fmtRange,
} = T;

const STATUS_FILTERS = [
  ['all', 'Todos'], ['abierto', 'Abiertos'], ['asignado', 'Asignados'],
  ['progreso', 'En progreso'], ['resuelto', 'Resueltos'], ['cerrado', 'Cerrados'],
];

// ============================================================
// LISTA VIEW — tabla con orden, multi-selección, SLA, drawer
// ============================================================
const ListaView = {
  name: 'ListaView',
  components: { ...C },
  props: { thresholds: Object, slaHours: Number },
  emits: ['toast', 'reassign-bulk'],
  data() {
    return {
      cases: CASES,
      statusF: 'all', originF: 'all', priorityF: 'all', appF: 'all',
      search: '',
      sortKey: 'wait', sortDir: 'asc',
      selected: new Set(), selVersion: 0,
      peek: null,
      ORIGINS, PRIORITIES, APPS, STATUS_FILTERS,
    };
  },
  computed: {
    countByStatus() {
      const m = { all: this.cases.length };
      for (const c of this.cases) m[c.statusId] = (m[c.statusId] || 0) + 1;
      return m;
    },
    filtered() {
      let r = this.cases.filter(c => {
        if (this.statusF !== 'all' && c.statusId !== this.statusF) return false;
        if (this.originF !== 'all' && c.originId !== this.originF) return false;
        if (this.priorityF !== 'all' && c.priorityId !== this.priorityF) return false;
        if (this.appF !== 'all' && c.appId !== this.appF) return false;
        if (this.search) {
          const q = this.search.toLowerCase();
          const spec = specById(c.specialistId);
          if (!(c.id.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q) ||
                (spec && spec.fullName.toLowerCase().includes(q)))) return false;
        }
        return true;
      });
      const dir = this.sortDir === 'asc' ? 1 : -1;
      const key = this.sortKey;
      r = [...r].sort((a, b) => {
        let av, bv;
        if (key === 'id') { av = a.seq; bv = b.seq; }
        else if (key === 'subject') { av = a.subject.toLowerCase(); bv = b.subject.toLowerCase(); }
        else if (key === 'origin') { av = a.originId; bv = b.originId; }
        else if (key === 'priority') { av = PRIORITIES[a.priorityId].rank; bv = PRIORITIES[b.priorityId].rank; }
        else if (key === 'status') { av = a.statusId; bv = b.statusId; }
        else if (key === 'spec') { av = (specById(a.specialistId)||{fullName:'zzz'}).fullName; bv = (specById(b.specialistId)||{fullName:'zzz'}).fullName; }
        else { av = -a.waitH; bv = -b.waitH; } // wait: más antiguo primero por defecto
        return av < bv ? -dir : av > bv ? dir : 0;
      });
      return r;
    },
    selCount() { this.selVersion; return this.selected.size; },
    allVisibleSelected() {
      this.selVersion;
      return this.filtered.length > 0 && this.filtered.every(c => this.selected.has(c.id));
    },
  },
  methods: {
    specById, statusOf, priorityOf, originOf, appById,
    sort(key) {
      if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      else { this.sortKey = key; this.sortDir = key === 'priority' || key === 'wait' ? 'asc' : 'asc'; }
    },
    sortIcon(key) {
      if (this.sortKey !== key) return 'bx-chevrons-down';
      return this.sortDir === 'asc' ? 'bx-chevron-up' : 'bx-chevron-down';
    },
    waitClass(c) {
      if (c.statusId === 'cerrado' || c.statusId === 'resuelto') return '';
      if (c.waitH >= this.slaHours) return 'cell-wait--late';
      if (c.waitH >= this.slaHours * 0.66) return 'cell-wait--warn';
      return '';
    },
    rowClass(c) {
      return [
        'crow',
        this.selected.has(c.id) && 'crow--sel',
        c.priorityId === 'urgente' && 'crow--urgent',
        c.priorityId === 'alta' && 'crow--alta',
      ];
    },
    toggleSel(c, ev) {
      if (ev) ev.stopPropagation();
      if (this.selected.has(c.id)) this.selected.delete(c.id);
      else this.selected.add(c.id);
      this.selVersion++;
    },
    toggleAll() {
      if (this.allVisibleSelected) this.filtered.forEach(c => this.selected.delete(c.id));
      else this.filtered.forEach(c => this.selected.add(c.id));
      this.selVersion++;
    },
    clearSel() { this.selected.clear(); this.selVersion++; },
    bulkClose() {
      const ids = [...this.selected];
      this.cases.forEach(c => { if (this.selected.has(c.id)) c.statusId = 'cerrado'; });
      this.$emit('toast', `${ids.length} caso(s) cerrados.`);
      this.clearSel();
    },
    bulkReassign() { this.$emit('reassign-bulk', [...this.selected]); },
    applyBulkSpec(specId) {
      this.cases.forEach(c => { if (this.selected.has(c.id)) { c.specialistId = specId; if (c.statusId === 'abierto') c.statusId = 'asignado'; } });
    },
    openPeek(c) { this.peek = c; },
  },
  template: `
  <div style="display:flex;flex-direction:column;min-height:0;flex:1;position:relative">
    <!-- filter bar -->
    <div class="filterbar">
      <button v-for="[id,label] in STATUS_FILTERS" :key="id"
        :class="['chip', statusF===id && 'chip--active']" @click="statusF=id">
        {{ label }}<span class="chip__n">{{ countByStatus[id]||0 }}</span>
      </button>
      <div class="fb-divider"></div>
      <select class="tb-select" v-model="originF">
        <option value="all">Origen: Todos</option>
        <option v-for="o in Object.values(ORIGINS)" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>
      <select class="tb-select" v-model="priorityF">
        <option value="all">Prioridad: Todas</option>
        <option v-for="p in Object.values(PRIORITIES)" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <select class="tb-select" v-model="appF">
        <option value="all">Aplicación: Todas</option>
        <option v-for="a in APPS" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <div class="search"><i class="bx bx-search"></i><input v-model="search" placeholder="Buscar por ID, asunto o especialista…" /></div>
      <div class="fb-spacer"></div>
      <div class="count-pill">{{ filtered.length }} casos</div>
    </div>

    <!-- table -->
    <div class="lista-wrap">
      <table class="ctable">
        <thead>
          <tr>
            <th class="th-check">
              <div :class="['ck', allVisibleSelected && 'ck--on']" @click="toggleAll">
                <i v-if="allVisibleSelected" class="bx bx-check"></i>
              </div>
            </th>
            <th class="sortable" @click="sort('id')">ID <i :class="['bx', sortIcon('id'), 'sort-i', sortKey==='id' && 'on']"></i></th>
            <th class="sortable" @click="sort('subject')">Asunto <i :class="['bx', sortIcon('subject'), 'sort-i', sortKey==='subject' && 'on']"></i></th>
            <th class="sortable" @click="sort('origin')">Origen <i :class="['bx', sortIcon('origin'), 'sort-i', sortKey==='origin' && 'on']"></i></th>
            <th class="sortable" @click="sort('priority')">Prioridad <i :class="['bx', sortIcon('priority'), 'sort-i', sortKey==='priority' && 'on']"></i></th>
            <th class="sortable" @click="sort('status')">Estado <i :class="['bx', sortIcon('status'), 'sort-i', sortKey==='status' && 'on']"></i></th>
            <th class="sortable" @click="sort('spec')">Especialista <i :class="['bx', sortIcon('spec'), 'sort-i', sortKey==='spec' && 'on']"></i></th>
            <th class="sortable" @click="sort('wait')">Espera <i :class="['bx', sortIcon('wait'), 'sort-i', sortKey==='wait' && 'on']"></i></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filtered" :key="c.id" :class="rowClass(c)" @click="openPeek(c)">
            <td class="td-check">
              <div :class="['ck', selected.has(c.id) && 'ck--on']" @click="toggleSel(c, $event)">
                <i v-if="selected.has(c.id)" class="bx bx-check"></i>
              </div>
            </td>
            <td class="cell-id">{{ c.id }}</td>
            <td><div class="cell-subject">{{ c.subject }}</div></td>
            <td><origin-badge :id="c.originId" /></td>
            <td><priority-badge :id="c.priorityId" /></td>
            <td><status-badge :id="c.statusId" /></td>
            <td>
              <div v-if="specById(c.specialistId)" class="cell-spec">
                <avatar :spec="specById(c.specialistId)" :size="26" />
                <span class="cell-spec__name">{{ specById(c.specialistId).fullName }}</span>
              </div>
              <span v-else class="cell-spec--none">Sin asignar</span>
            </td>
            <td><span :class="['cell-wait', waitClass(c)]">{{ c.createdLabel }}</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="filtered.length === 0" class="empty-state">
        <i class="bx bx-search-alt"></i>
        <div class="empty-state__t">No hay casos que coincidan</div>
        <div style="font-size:0.8rem">Ajusta los filtros o la búsqueda.</div>
      </div>
    </div>

    <!-- bulk action bar -->
    <div v-if="selCount > 0" class="bulkbar">
      <div class="bulkbar__n"><span>{{ selCount }}</span> seleccionado(s)</div>
      <div class="bulkbar__sep"></div>
      <button class="bulk-btn" @click="bulkReassign"><i class="bx bx-transfer-alt"></i>Reasignar</button>
      <button class="bulk-btn bulk-btn--danger" @click="bulkClose"><i class="bx bx-x-circle"></i>Cerrar casos</button>
      <button class="bulkbar__x" @click="clearSel" title="Limpiar selección">&times;</button>
    </div>

    <!-- quick-peek drawer -->
    <teleport to="body">
      <div v-if="peek">
        <div class="drawer-backdrop" @click="peek=null"></div>
        <div class="drawer" :style="{ '--app': appById(peek.appId).color }">
          <div class="drawer__top"></div>
          <div class="drawer__head">
            <div>
              <div class="drawer__id">{{ peek.id }}</div>
              <div class="drawer__title">{{ peek.subject }}</div>
              <div class="drawer__badges">
                <origin-badge :id="peek.originId" />
                <priority-badge :id="peek.priorityId" />
                <status-badge :id="peek.statusId" />
              </div>
            </div>
            <button class="drawer__x" @click="peek=null">&times;</button>
          </div>
          <div class="drawer__body">
            <div>
              <div class="field__label">Descripción</div>
              <div class="field__desc">{{ peek.description }}</div>
            </div>
            <div class="drawer__grid">
              <div>
                <div class="field__label">Especialista</div>
                <div class="field__val" v-if="specById(peek.specialistId)">
                  <avatar :spec="specById(peek.specialistId)" :size="24" />
                  {{ specById(peek.specialistId).fullName }}
                </div>
                <div class="field__val" v-else style="color:var(--faint)">Sin asignar</div>
              </div>
              <div>
                <div class="field__label">Aplicación</div>
                <div class="field__val">{{ appById(peek.appId).name }}</div>
              </div>
              <div>
                <div class="field__label">Creado</div>
                <div class="field__val">02 jun 2026</div>
              </div>
              <div>
                <div class="field__label">Espera</div>
                <div class="field__val"><span :class="['cell-wait', waitClass(peek)]" style="font-size:0.88rem">{{ peek.createdLabel }}</span></div>
              </div>
            </div>
          </div>
          <div class="drawer__foot">
            <button class="mbtn" @click="$emit('reassign-bulk', [peek.id]); peek=null"><i class="bx bx-transfer-alt"></i>Reasignar</button>
            <button class="mbtn mbtn--primary" @click="$emit('toast','Caso abierto en detalle.')"><i class="bx bx-link-external"></i>Abrir caso</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
  `,
};

// ============================================================
// ESPECIALISTAS VIEW — roster de capacidad (NUEVO)
// ============================================================
const EspecialistasView = {
  name: 'EspecialistasView',
  components: { ...C },
  props: { thresholds: Object },
  emits: ['toast', 'go-cargas', 'reassign-bulk'],
  data() {
    return { sortBy: 'load', turnoOnly: false, SPECIALISTS };
  },
  computed: {
    enriched() {
      return SPECIALISTS.map(s => {
        const all = casesOf(s.id);
        const load = loadOf(s, this.thresholds);
        const byStatus = { asignado: 0, progreso: 0, resuelto: 0, cerrado: 0, abierto: 0 };
        all.forEach(c => byStatus[c.statusId]++);
        return { s, load, byStatus, total: all.length };
      });
    },
    rows() {
      let r = this.enriched;
      if (this.turnoOnly) r = r.filter(x => x.s.turno);
      const by = this.sortBy;
      r = [...r].sort((a, b) => {
        if (by === 'load') return b.load.ratio - a.load.ratio;
        if (by === 'active') return b.load.active - a.load.active;
        return a.s.fullName.localeCompare(b.s.fullName);
      });
      return r;
    },
    kpis() {
      const conTurno = SPECIALISTS.filter(s => s.turno).length;
      const totalActive = SPECIALISTS.reduce((n, s) => n + activeCasesOf(s.id).length, 0);
      const totalCap = SPECIALISTS.reduce((n, s) => n + s.capacity, 0);
      const saturated = this.enriched.filter(x => x.load.level === 'high').length;
      const unassigned = CASES.filter(c => !c.specialistId).length;
      return { conTurno, total: SPECIALISTS.length, totalActive, totalCap, saturated, unassigned,
        util: Math.round(totalActive / totalCap * 100) };
    },
  },
  methods: {
    appById, fmtRange,
    loadColor(l) { return LOAD_COLOR[l.level]; },
    loadLabel(l) { return LOAD_LABEL[l.level]; },
    loadPct(l) { return Math.min(100, Math.round(l.ratio * 100)); },
  },
  template: `
  <div class="esp-wrap">
    <!-- filter row -->
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.1rem;flex-wrap:wrap">
      <span class="tb-label" style="font-size:0.66rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:0.06em">Ordenar</span>
      <div class="seg">
        <button :class="['seg__btn', sortBy==='load' && 'seg__btn--active']" @click="sortBy='load'">Carga</button>
        <button :class="['seg__btn', sortBy==='active' && 'seg__btn--active']" @click="sortBy='active'">Casos activos</button>
        <button :class="['seg__btn', sortBy==='name' && 'seg__btn--active']" @click="sortBy='name'">Nombre</button>
      </div>
      <button :class="['chip', turnoOnly && 'chip--active']" @click="turnoOnly=!turnoOnly">
        <i class="bx bx-time-five" style="font-size:0.8rem;vertical-align:-1px"></i> Solo con turno
      </button>
    </div>

    <!-- KPI summary -->
    <div class="esp-summary">
      <div class="kpi">
        <div class="kpi__label"><i class="bx bx-group"></i>Especialistas</div>
        <div class="kpi__val">{{ kpis.conTurno }}<span style="font-size:1rem;color:var(--faint);font-weight:600"> / {{ kpis.total }}</span></div>
        <div class="kpi__sub">con turno vigente hoy</div>
      </div>
      <div class="kpi">
        <div class="kpi__label"><i class="bx bx-folder-open"></i>Casos activos</div>
        <div class="kpi__val">{{ kpis.totalActive }}</div>
        <div class="kpi__sub">de {{ kpis.totalCap }} de capacidad</div>
      </div>
      <div class="kpi">
        <div class="kpi__label"><i class="bx bx-tachometer"></i>Utilización</div>
        <div class="kpi__val" :style="{ color: kpis.util >= 80 ? 'var(--load-high)' : kpis.util >= 50 ? 'var(--load-mid)' : 'var(--load-low)' }">{{ kpis.util }}%</div>
        <div class="kpi__sub">carga media del equipo</div>
      </div>
      <div class="kpi">
        <div class="kpi__label"><i class="bx bx-error-circle"></i>Saturados</div>
        <div class="kpi__val" :style="{ color: kpis.saturated ? 'var(--load-high)' : 'var(--text)' }">{{ kpis.saturated }}</div>
        <div class="kpi__sub">por encima del umbral</div>
      </div>
    </div>

    <!-- cards -->
    <div class="esp-grid">
      <div v-for="x in rows" :key="x.s.id" class="espcard">
        <div class="espcard__head">
          <avatar :spec="x.s" :size="46" />
          <div style="min-width:0;flex:1">
            <div class="espcard__name">{{ x.s.fullName }}</div>
            <div class="espcard__meta">
              <span class="role-tag">{{ x.s.role }}</span>
              <span :class="['turno-pill', x.s.turno ? 'turno-pill--on' : 'turno-pill--off']">
                <i :class="['bx', x.s.turno ? 'bxs-circle' : 'bx-block']"></i>{{ x.s.turno ? 'Con turno' : 'Sin turno' }}
              </span>
            </div>
          </div>
          <span class="load-label" :style="{ background: 'color-mix(in srgb,'+loadColor(x.load)+' 16%, transparent)', color: loadColor(x.load) }">{{ loadLabel(x.load) }}</span>
        </div>

        <div>
          <div class="espcard__loadrow">
            <div class="loadnum" :style="{ color: loadColor(x.load) }">{{ x.load.active }}<small> / {{ x.load.capacity }} casos</small></div>
            <div style="font-size:0.72rem;color:var(--muted);font-weight:600">{{ loadPct(x.load) }}% carga</div>
          </div>
          <div class="loadbar" style="margin-top:0.5rem"><div class="loadbar__fill" :style="{ width: loadPct(x.load)+'%', background: loadColor(x.load) }"></div></div>
        </div>

        <div class="espcard__breakdown">
          <div class="bd"><div class="bd__n" style="color:var(--status-assigned)">{{ x.byStatus.asignado }}</div><div class="bd__l">Asignados</div></div>
          <div class="bd"><div class="bd__n" style="color:var(--status-in-progress)">{{ x.byStatus.progreso }}</div><div class="bd__l">En curso</div></div>
          <div class="bd"><div class="bd__n" style="color:var(--status-resolved)">{{ x.byStatus.resuelto }}</div><div class="bd__l">Resueltos</div></div>
          <div class="bd"><div class="bd__n" style="color:var(--status-closed)">{{ x.byStatus.cerrado }}</div><div class="bd__l">Cerrados</div></div>
        </div>

        <div>
          <div class="espcard__sec-label" style="margin-bottom:0.4rem">Turnos de hoy</div>
          <div class="win-list">
            <div v-for="(w,i) in x.s.windows" :key="i" class="win" :style="{ '--app': appById(w.appId).color }">
              <div class="win__bar"></div>
              <span class="win__app">{{ appById(w.appId).name }}</span>
              <span class="win__time">{{ fmtRange(w.start, w.end) }}</span>
            </div>
            <div v-if="!x.s.windows.length" class="win win--empty">Sin ventanas vigentes hoy</div>
          </div>
        </div>

        <div class="espcard__foot">
          <button class="mbtn" @click="$emit('go-cargas', x.s.id)"><i class="bx bx-bar-chart-alt-2"></i>Ver cargas</button>
          <button class="mbtn" @click="$emit('reassign-bulk', [])"><i class="bx bx-transfer-alt"></i>Asignar</button>
        </div>
      </div>
    </div>
  </div>
  `,
};

// ============================================================
// CARGAS VIEW — 3 paneles (especialistas → casos → detalle)
// ============================================================
const STATUS_TABS = [
  ['all', 'Todos'], ['asignado', 'Asignado'], ['progreso', 'En progreso'],
  ['abierto', 'Abierto'], ['resuelto', 'Resuelto'],
];
const GROUP_ORDER = ['asignado', 'progreso', 'abierto', 'resuelto', 'cerrado'];

const CargasView = {
  name: 'CargasView',
  components: { ...C },
  props: { thresholds: Object, focusSpec: String },
  emits: ['toast', 'reassign-bulk'],
  data() {
    return {
      activeSpec: this.focusSpec || SPECIALISTS[0].id,
      activeCase: null,
      caseTab: 'all', originF: 'all', appF: 'all',
      cases: CASES, SPECIALISTS, APPS, STATUS_TABS, STATUSES,
    };
  },
  watch: {
    focusSpec(v) { if (v) { this.activeSpec = v; this.activeCase = null; } },
    activeSpec() { this.activeCase = null; },
  },
  computed: {
    specRows() {
      return SPECIALISTS.map(s => ({ s, load: loadOf(s, this.thresholds), active: activeCasesOf(s.id).length }));
    },
    conTurno() { return SPECIALISTS.filter(s => s.turno).length; },
    specCases() {
      return this.cases.filter(c => c.specialistId === this.activeSpec).filter(c => {
        if (this.caseTab !== 'all' && c.statusId !== this.caseTab) return false;
        if (this.originF !== 'all' && c.originId !== this.originF) return false;
        if (this.appF !== 'all' && c.appId !== this.appF) return false;
        return true;
      });
    },
    grouped() {
      const g = {};
      for (const c of this.specCases) (g[c.statusId] = g[c.statusId] || []).push(c);
      return GROUP_ORDER.filter(k => g[k] && g[k].length).map(k => ({ status: STATUSES[k], cases: g[k] }));
    },
    counts() {
      const all = this.cases.filter(c => c.specialistId === this.activeSpec);
      return {
        total: all.length,
        active: all.filter(c => c.statusId !== 'cerrado' && c.statusId !== 'resuelto').length,
        abiertos: all.filter(c => c.statusId === 'abierto').length,
        cerrados: all.filter(c => c.statusId === 'cerrado').length,
      };
    },
    detailCase() { return this.activeCase ? this.cases.find(c => c.id === this.activeCase) : null; },
    activeSpecObj() { return specById(this.activeSpec); },
  },
  methods: {
    specById, appById, statusOf, originOf, priorityOf, fmtRange,
    loadColor(l) { return LOAD_COLOR[l.level]; },
    loadPct(l) { return Math.min(100, Math.round(l.ratio * 100)); },
    selectCase(c) { this.activeCase = c.id; },
    navCase(dir) {
      const list = this.specCases;
      const i = list.findIndex(c => c.id === this.activeCase);
      const ni = Math.max(0, Math.min(list.length - 1, i + dir));
      if (list[ni]) this.activeCase = list[ni].id;
    },
    changeStatus(ev) {
      const c = this.detailCase; if (!c) return;
      c.statusId = ev.target.value;
      this.$emit('toast', 'Estado actualizado.');
    },
  },
  template: `
  <div class="cargas">
    <!-- pane: specialists -->
    <div class="pane pane--specs">
      <div class="pane__head">
        <div class="pane__title">Especialistas</div>
        <i class="bx bx-revision" style="color:var(--muted);cursor:pointer" title="Actualizar"></i>
      </div>
      <div class="speclist__stats">
        <span><b>{{ conTurno }}</b> con turno</span>
        <span><b>{{ specRows.reduce((n,x)=>n+x.active,0) }}</b> casos activos</span>
      </div>
      <div class="pane__note"><i class="bx bx-info-circle"></i>Especialistas con ventanas vigentes.</div>
      <div class="pane__scroll">
        <div v-for="x in specRows" :key="x.s.id"
          :class="['specrow', activeSpec===x.s.id && 'specrow--active']" @click="activeSpec=x.s.id">
          <avatar :spec="x.s" :size="36" />
          <div style="min-width:0;flex:1">
            <div class="specrow__name">{{ x.s.fullName }}</div>
            <div class="specrow__meta">
              <span :style="{ color: x.s.turno ? 'var(--primary)' : 'var(--faint)' }">
                <i :class="['bx', x.s.turno ? 'bxs-circle' : 'bx-block']" style="font-size:0.5rem;vertical-align:1px"></i>
                {{ x.s.turno ? 'Con turno' : 'Sin turno' }}
              </span>
            </div>
          </div>
          <div class="specrow__load">
            <div class="specrow__loadn" :style="{ color: loadColor(x.load) }">{{ x.active }}</div>
            <div class="specrow__loadbar"><div :style="{ width: loadPct(x.load)+'%', background: loadColor(x.load) }"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- pane: cases -->
    <div class="pane pane--cases">
      <div class="pane__head">
        <div>
          <div class="pane__title">{{ activeSpecObj.fullName }}</div>
        </div>
      </div>
      <div style="padding:0.55rem 1rem;display:flex;gap:0.3rem;flex-wrap:wrap;border-bottom:1px solid var(--border-soft)">
        <button v-for="[id,l] in STATUS_TABS" :key="id" :class="['chip', caseTab===id && 'chip--active']" style="padding:0.25rem 0.6rem;font-size:0.72rem" @click="caseTab=id">{{ l }}</button>
      </div>
      <div class="speclist__stats" style="gap:0.85rem">
        <span><b>{{ counts.total }}</b> total</span>
        <span><b>{{ counts.active }}</b> activos</span>
        <span><b>{{ counts.abiertos }}</b> abiertos</span>
        <span><b>{{ counts.cerrados }}</b> cerrados</span>
      </div>
      <div class="pane__scroll">
        <template v-for="grp in grouped" :key="grp.status.id">
          <div class="case-group">
            <span class="case-group__label" :style="{ color: grp.status.color }">{{ grp.status.name }}</span>
            <span class="case-group__n">{{ grp.cases.length }}</span>
          </div>
          <div v-for="c in grp.cases" :key="c.id"
            :class="['caseitem', activeCase===c.id && 'caseitem--active']"
            :style="{ '--app': appById(c.appId).color }" @click="selectCase(c)">
            <div class="caseitem__top">
              <span class="caseitem__id">{{ c.id }}</span>
              <span class="caseitem__app">{{ appById(c.appId).name }}</span>
              <span class="caseitem__date">06 jun 2026</span>
            </div>
            <div class="caseitem__subject">{{ c.subject }}</div>
          </div>
        </template>
        <div v-if="!grouped.length" class="empty-state" style="padding:3rem 1rem">
          <i class="bx bx-folder"></i><div class="empty-state__t">Sin casos</div>
        </div>
      </div>
    </div>

    <!-- pane: detail -->
    <div class="pane pane--detail">
      <div class="pane__scroll">
        <div v-if="detailCase" class="detail" :style="{ '--app': appById(detailCase.appId).color }">
          <div class="detail__top">
            <button class="detail__nav" @click="navCase(-1)"><i class="bx bx-chevron-left"></i></button>
            <button class="detail__nav" @click="navCase(1)"><i class="bx bx-chevron-right"></i></button>
            <span class="detail__id">{{ detailCase.id }}</span>
            <status-badge :id="detailCase.statusId" />
            <priority-badge :id="detailCase.priorityId" />
            <div class="detail__spacer"></div>
            <button class="btn-ghost" @click="$emit('reassign-bulk',[detailCase.id])"><i class="bx bx-transfer-alt"></i>Reasignar</button>
            <select class="estado-select" @change="changeStatus" :value="detailCase.statusId">
              <option v-for="s in Object.values(STATUSES)" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="detail-card">
            <div class="detail__subject">{{ detailCase.subject }}</div>
            <div class="detail__sec-label" style="margin-top:0">Descripción</div>
            <div class="field__desc">{{ detailCase.description }}</div>
            <div class="detail__grid" style="margin-top:1.4rem">
              <div><div class="field__label">Aplicación</div><div class="field__val">{{ appById(detailCase.appId).name }}</div></div>
              <div><div class="field__label">Origen</div><div class="field__val"><origin-badge :id="detailCase.originId" /></div></div>
              <div><div class="field__label">Creado</div><div class="field__val">02 jun 2026</div></div>
              <div><div class="field__label">Asignado</div><div class="field__val">06 jun 2026</div></div>
              <div><div class="field__label">Espera</div><div class="field__val">{{ detailCase.createdLabel }}</div></div>
              <div><div class="field__label">Especialista</div><div class="field__val"><avatar :spec="activeSpecObj" :size="22" />{{ activeSpecObj.fullName }}</div></div>
            </div>
            <hr class="detail__hr" />
            <div class="detail__grid">
              <div><div class="field__label">Casos asignados (total)</div><div class="kpi__val" style="font-size:1.4rem">{{ counts.total }}</div></div>
              <div><div class="field__label">Activos ahora</div><div class="kpi__val" style="font-size:1.4rem">{{ counts.active }}</div></div>
            </div>
            <div class="detail__sec-label">Cargas del especialista</div>
            <div v-for="(w,i) in activeSpecObj.windows" :key="i" class="win-row" :style="{ '--app': appById(w.appId).color }">
              <div class="win-row__bar"></div>
              <span class="win-row__name">{{ appById(w.appId).name }}</span>
              <span class="win-row__time"><i class="bx bx-time-five"></i>{{ fmtRange(w.start, w.end) }}</span>
            </div>
            <div v-if="!activeSpecObj.windows.length" class="win-row win--empty" style="justify-content:center;color:var(--faint)">Sin ventanas vigentes hoy</div>
          </div>
        </div>
        <div v-else class="detail-empty" style="height:100%">
          <i class="bx bx-message-square-detail"></i>
          <div class="empty-state__t">Selecciona un caso</div>
          <div style="font-size:0.8rem">Elige un caso de la lista para ver su detalle y la carga del especialista.</div>
        </div>
      </div>
    </div>
  </div>
  `,
};

window.TYC_V = { ListaView, EspecialistasView, CargasView };
})();
