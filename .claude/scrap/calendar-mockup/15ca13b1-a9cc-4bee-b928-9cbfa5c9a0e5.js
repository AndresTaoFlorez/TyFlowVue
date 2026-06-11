;(function(){
// ============================================================
// TyFlow Calendar — App raíz, modales y montaje (Vue 3)
// ============================================================
const T = window.TY;
const {
  APPS, SPECIALISTS, WINDOWS, DAY_FULL, MONTHS, HOLIDAYS,
  appById, specById, fmtHour, fmtRange, initialsOf, specialistLoad,
  WeekView, DayView, MonthView, AgendaView, CalSidebar,
} = T;

const HOURH = { compact: 32, comfortable: 48, spacious: 68 };
const BASE_MONDAY = new Date(2026, 5, 8);
const NOW_HOUR = 14;
const MON_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hourToStr = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
const strToHour = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h + (m / 60); };

// ---- Modal de detalle (ventana individual o grupo de idénticas) ----
const DetailModal = {
  name: 'DetailModal',
  props: ['w'],
  emits: ['close', 'toggle', 'delete', 'edit', 'edit-one'],
  computed: {
    app() { return appById(this.w.appId); },
    members() { return this.w.members || [this.w]; },
    count() { return this.members.length; },
    grouped() { return this.count > 1; },
    leadSpec() { return specById(this.members[0].specialistId); },
  },
  data() { return { DAY_FULL }; },
  methods: { fmtRange, initialsOf, specOf(m) { return specById(m.specialistId); } },
  template: `
    <div class="modal-backdrop" @click="$emit('close')">
      <div class="modal" :style="{ '--app': app.color }" @click.stop>
        <div class="modal__top"></div>
        <div class="modal__head">
          <div>
            <div class="modal__title">{{ grouped ? count + ' especialistas' : leadSpec.fullName }}</div>
            <div class="modal__sub">{{ grouped ? 'Turno compartido · ' + app.name : 'Ventana de trabajo' }}</div>
          </div>
          <button class="modal__x" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal__body">
          <div class="mrow"><i class="bx bx-grid-alt"></i><span class="mrow__label">Aplicación</span><span class="mrow__val">{{ app.name }}</span></div>
          <div class="mrow"><i class="bx bx-time-five"></i><span class="mrow__label">Horario</span><span class="mrow__val">{{ fmtRange(w.start, w.end) }}</span></div>
          <div class="mrow"><i class="bx bx-calendar"></i><span class="mrow__label">Día</span><span class="mrow__val">{{ DAY_FULL[w.day] }}</span></div>
          <div class="mrow"><i class="bx bx-pulse"></i><span class="mrow__label">Estado</span>
            <span :class="['pill-status', w.active ? 'pill-status--active' : 'pill-status--inactive']">
              <i :class="['bx', w.active ? 'bxs-circle' : 'bx-block']" style="font-size:0.6rem"></i>{{ w.active ? 'Activa' : 'Inactiva' }}
            </span>
          </div>

          <div v-if="grouped" class="mmembers">
            <div class="mmembers__head">
              <span>Especialistas en este turno</span><span class="mmembers__count">{{ count }}</span>
            </div>
            <div class="mmembers__list">
              <div v-for="m in members" :key="m.id" class="mmember">
                <span class="mmember__av" :style="{ background: specOf(m).color }">{{ initialsOf(specOf(m).fullName) }}</span>
                <span class="mmember__name">{{ specOf(m).fullName }}</span>
                <button class="mmember__edit" title="Editar solo a esta persona" @click="$emit('edit-one', m)"><i class="bx bx-pencil"></i></button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="mbtn" @click="$emit('toggle', w)">{{ w.active ? 'Inhabilitar' : 'Habilitar' }}{{ grouped ? ' (' + count + ')' : '' }}</button>
          <button v-if="!grouped" class="mbtn" @click="$emit('edit')">Editar</button>
          <button class="mbtn mbtn--danger" @click="$emit('delete', w)">Eliminar{{ grouped ? ' (' + count + ')' : '' }}</button>
        </div>
      </div>
    </div>
  `,
};

// ---- Modal crear / editar ----
const CreateModal = {
  name: 'CreateModal',
  props: ['init'],
  emits: ['close', 'submit'],
  data() {
    return {
      specialistId: this.init.specialistId || SPECIALISTS[0].id,
      appId: this.init.appId || APPS[0].id,
      day: this.init.day ?? 0,
      start: this.init.start ?? 9,
      end: this.init.end ?? 11,
      active: this.init.active ?? true,
      SPECIALISTS, APPS, DAY_FULL,
    };
  },
  computed: {
    app() { return appById(this.appId); },
    times() { const t = []; for (let h = 0; h <= 24; h += 0.5) t.push(h); return t; },
    startTimes() { return this.times.slice(0, -1); },
    endTimes() { return this.times.filter(t => t > this.start); },
  },
  methods: {
    fmtHour,
    submit() { if (this.end <= this.start) return; this.$emit('submit', { id: this.init.id, edit: this.init.edit, specialistId: this.specialistId, appId: this.appId, day: this.day, start: this.start, end: this.end, active: this.active }); },
  },
  template: `
    <div class="modal-backdrop" @click="$emit('close')">
      <div class="modal" :style="{ '--app': app.color }" @click.stop>
        <div class="modal__top"></div>
        <div class="modal__head">
          <div><div class="modal__title">{{ init.edit ? 'Editar ventana' : 'Nueva ventana' }}</div><div class="modal__sub">Disponibilidad de un especialista</div></div>
          <button class="modal__x" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal__body">
          <div class="mfield"><label class="mfield__label">Especialista</label>
            <select class="mselect" v-model="specialistId">
              <option v-for="s in SPECIALISTS" :key="s.id" :value="s.id">{{ s.fullName }}</option>
            </select>
          </div>
          <div class="mfield"><label class="mfield__label">Aplicación</label>
            <select class="mselect" v-model="appId">
              <option v-for="a in APPS" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="mfield"><label class="mfield__label">Día</label>
            <select class="mselect" v-model.number="day">
              <option v-for="(d, i) in DAY_FULL" :key="i" :value="i">{{ d }}</option>
            </select>
          </div>
          <div class="mgrid2">
            <div class="mfield"><label class="mfield__label">Inicio</label>
              <select class="mselect" v-model.number="start">
                <option v-for="t in startTimes" :key="t" :value="t">{{ fmtHour(t) }}</option>
              </select>
            </div>
            <div class="mfield"><label class="mfield__label">Fin</label>
              <select class="mselect" v-model.number="end">
                <option v-for="t in endTimes" :key="t" :value="t">{{ fmtHour(t) }}</option>
              </select>
            </div>
          </div>
          <label class="mrow" style="cursor:pointer;gap:0.5rem">
            <input type="checkbox" v-model="active" style="width:16px;height:16px;accent-color:var(--primary)" />
            <span style="font-weight:600;font-size:0.82rem">Ventana activa</span>
          </label>
        </div>
        <div class="modal__foot">
          <button class="mbtn" @click="$emit('close')">Cancelar</button>
          <button class="mbtn mbtn--primary" @click="submit">{{ init.edit ? 'Guardar' : 'Crear ventana' }}</button>
        </div>
      </div>
    </div>
  `,
};

// ---- Modal de asignación masiva ----
// Especialistas + aplicaciones (acumulativas) por pills con búsqueda,
// horario tipo Google, recurrencia ("repetir cada" + "termina").
const BulkAssignModal = {
  name: 'BulkAssignModal',
  props: ['holidays', 'weekDates'],
  emits: ['close', 'submit'],
  data() {
    return {
      pickedSpecs: [SPECIALISTS[0].id, SPECIALISTS[1].id],
      pickedApps: [APPS[0].id],
      specSearchOpen: false, specQuery: '',
      appSearchOpen: false, appQuery: '',
      days: [0, 1, 2, 3, 4],
      start: 8, end: 17, active: true,
      freq: 'none', endMode: 'never', endDate: '', endCount: 12,
      SPECIALISTS, APPS, DAY_LABELS: T.DAY_LABELS,
      freqOptions: [['none', 'No se repite'], ['daily', 'Cada día'], ['weekly', 'Cada semana'], ['biweekly', 'Cada 2 semanas'], ['monthly', 'Cada mes']],
      endOptions: [['never', 'Nunca'], ['on', 'En fecha'], ['after', 'Tras N']],
    };
  },
  computed: {
    filteredSpecs() { const q = this.specQuery.trim().toLowerCase(); return q ? SPECIALISTS.filter(s => s.fullName.toLowerCase().includes(q)) : SPECIALISTS; },
    filteredApps() { const q = this.appQuery.trim().toLowerCase(); return q ? APPS.filter(a => a.name.toLowerCase().includes(q)) : APPS; },
    startStr: { get() { return hourToStr(this.start); }, set(v) { this.start = strToHour(v); } },
    endStr: { get() { return hourToStr(this.end); }, set(v) { this.end = strToHour(v); } },
    hours() { return Math.max(0, this.end - this.start); },
    durLabel() { const h = Math.floor(this.hours), m = Math.round((this.hours - h) * 60); return ((h ? h + 'h' : '') + (m ? ' ' + m + 'm' : '')).trim() || '0h'; },
    count() { return this.pickedSpecs.length * this.days.length * this.pickedApps.length; },
    valid() { return this.pickedSpecs.length && this.days.length && this.pickedApps.length && this.end > this.start; },
    conflictDays() { return this.days.filter(d => d >= 5 || (this.holidays && this.holidays[this.weekDates[d]])); },
    warn() {
      if (!this.conflictDays.length) return null;
      return this.conflictDays.map(d => (this.holidays && this.holidays[this.weekDates[d]]) ? this.holidays[this.weekDates[d]] : T.DAY_FULL[d]);
    },
    repText() {
      if (this.freq === 'none') return '';
      const f = { daily: 'cada día', weekly: 'cada semana', biweekly: 'cada 2 semanas', monthly: 'cada mes' }[this.freq];
      let end = '';
      if (this.endMode === 'on' && this.endDate) end = ' hasta ' + this.endDate;
      else if (this.endMode === 'after') end = ' · ' + this.endCount + ' veces';
      return 'se repite ' + f + end;
    },
  },
  methods: {
    initialsOf,
    toggleSpec(id) { this.pickedSpecs = this.pickedSpecs.includes(id) ? this.pickedSpecs.filter(x => x !== id) : [...this.pickedSpecs, id]; },
    toggleApp(id) { this.pickedApps = this.pickedApps.includes(id) ? this.pickedApps.filter(x => x !== id) : [...this.pickedApps, id]; },
    allSpecs() { this.pickedSpecs = this.pickedSpecs.length === SPECIALISTS.length ? [] : SPECIALISTS.map(s => s.id); },
    allApps() { this.pickedApps = this.pickedApps.length === APPS.length ? [] : APPS.map(a => a.id); },
    toggleDay(d) { this.days = this.days.includes(d) ? this.days.filter(x => x !== d) : [...this.days, d]; },
    toggleSpecSearch() { this.specSearchOpen = !this.specSearchOpen; if (this.specSearchOpen) this.$nextTick(() => this.$refs.specS && this.$refs.specS.focus()); else this.specQuery = ''; },
    toggleAppSearch() { this.appSearchOpen = !this.appSearchOpen; if (this.appSearchOpen) this.$nextTick(() => this.$refs.appS && this.$refs.appS.focus()); else this.appQuery = ''; },
    submit() {
      if (!this.valid) return;
      const out = [];
      this.pickedSpecs.forEach(sp => this.days.forEach(day => this.pickedApps.forEach(appId => {
        out.push({ specialistId: sp, appId, day, start: this.start, end: this.end, active: this.active });
      })));
      this.$emit('submit', out);
    },
  },
  template: `
    <div class="modal-backdrop" @click="$emit('close')">
      <div class="modal modal--bulk" @click.stop>
        <div class="modal__head">
          <div>
            <div class="modal__title">Asignación masiva</div>
            <div class="modal__sub">Disponibilidad para varios especialistas a la vez</div>
          </div>
          <button class="modal__x" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal__body">
          <!-- Especialistas -->
          <div class="bfield">
            <div class="bfield__head">
              <label class="bfield__label">Especialistas <span class="bfield__n">{{ pickedSpecs.length }}</span></label>
              <div class="bfield__tools">
                <button class="bfield__link" @click="allSpecs">{{ pickedSpecs.length === SPECIALISTS.length ? 'Quitar todos' : 'Todos' }}</button>
                <button :class="['bfield__lupa', specSearchOpen && 'bfield__lupa--on']" @click="toggleSpecSearch" title="Buscar"><i class="bx bx-search"></i></button>
              </div>
            </div>
            <div v-show="specSearchOpen" class="bsearch"><i class="bx bx-search"></i><input ref="specS" v-model="specQuery" type="text" placeholder="Buscar especialista…" /></div>
            <div class="pillwrap">
              <button v-for="s in filteredSpecs" :key="s.id" :class="['pill', pickedSpecs.includes(s.id) && 'pill--on']" @click="toggleSpec(s.id)">
                <span class="pill__av" :style="{ background: s.color }">{{ initialsOf(s.fullName) }}</span>
                <span class="pill__txt">{{ s.fullName }}</span>
                <i class="bx bx-x pill__x"></i>
              </button>
              <div v-if="!filteredSpecs.length" class="bempty">Sin resultados</div>
            </div>
          </div>

          <!-- Aplicaciones (acumulativas) -->
          <div class="bfield">
            <div class="bfield__head">
              <label class="bfield__label">Aplicaciones <span class="bfield__n">{{ pickedApps.length }}</span></label>
              <div class="bfield__tools">
                <button class="bfield__link" @click="allApps">{{ pickedApps.length === APPS.length ? 'Quitar todas' : 'Todas' }}</button>
                <button :class="['bfield__lupa', appSearchOpen && 'bfield__lupa--on']" @click="toggleAppSearch" title="Buscar"><i class="bx bx-search"></i></button>
              </div>
            </div>
            <div v-show="appSearchOpen" class="bsearch"><i class="bx bx-search"></i><input ref="appS" v-model="appQuery" type="text" placeholder="Buscar aplicación…" /></div>
            <div class="pillwrap">
              <button v-for="a in filteredApps" :key="a.id" :class="['pill', pickedApps.includes(a.id) && 'pill--on']" @click="toggleApp(a.id)">
                <span class="pill__dot" :style="{ background: a.color }"></span>
                <span class="pill__txt">{{ a.name }}</span>
                <i class="bx bx-x pill__x"></i>
              </button>
              <div v-if="!filteredApps.length" class="bempty">Sin resultados</div>
            </div>
          </div>

          <!-- Horario -->
          <div class="bfield">
            <label class="bfield__label">Horario</label>
            <div class="timerow">
              <div class="timebox">
                <input type="time" step="1800" v-model="startStr" />
                <span class="timebox__sep">–</span>
                <input type="time" step="1800" v-model="endStr" />
              </div>
              <span class="timedur">{{ durLabel }}</span>
            </div>
          </div>

          <!-- Días -->
          <div class="bfield">
            <label class="bfield__label">Días de la semana</label>
            <div class="daypick">
              <button v-for="(d, i) in DAY_LABELS" :key="i"
                :class="['daypick__btn', days.includes(i) && 'daypick__btn--on', i >= 5 && 'daypick__btn--weekend']"
                @click="toggleDay(i)">{{ d }}</button>
            </div>
          </div>

          <!-- Repetición -->
          <div class="bfield">
            <label class="bfield__label">Repetición</label>
            <div class="chiprow">
              <button type="button" v-for="[v, l] in freqOptions" :key="v" :class="['chip', freq === v && 'chip--on']" @click="freq = v">{{ l }}</button>
            </div>
            <div v-if="freq !== 'none'" class="reprow--end">
              <span class="reprow__sep">Termina</span>
              <div class="chiprow">
                <button type="button" v-for="[v, l] in endOptions" :key="v" :class="['chip', 'chip--sm', endMode === v && 'chip--on']" @click="endMode = v">{{ l }}</button>
              </div>
              <input v-if="endMode === 'on'" type="date" v-model="endDate" class="bdate" />
              <div v-if="endMode === 'after'" class="afterbox"><input type="number" min="1" v-model.number="endCount" /><span>veces</span></div>
            </div>
          </div>
        </div>
        <div class="modal__foot modal__foot--bulk">
          <div class="bsummary" v-if="valid"><b>{{ count }}</b> ventana{{ count === 1 ? '' : 's' }} · <b>{{ durLabel }}</b> c/u<span v-if="repText" class="bsummary__rep"> · {{ repText }}</span></div>
          <div class="bsummary bsummary--empty" v-else>Elige especialistas, apps y días</div>
          <div class="modal__foot-actions">
            <button class="mbtn" @click="$emit('close')">Cancelar</button>
            <button class="mbtn mbtn--primary" :disabled="!valid" @click="submit">Crear{{ valid ? ' ' + count : '' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// ============================================================
// APP RAÍZ
// ============================================================
const App = {
  name: 'App',
  components: { WeekView, DayView, MonthView, AgendaView, CalSidebar, DetailModal, CreateModal, BulkAssignModal },
  data() {
    const savedView = (function(){ try { return localStorage.getItem('tyflow.cal.view'); } catch(e){ return null; } })();
    const validViews = ['day', '5days', 'week', 'month', 'agenda'];
    return {
      theme: 'dark', density: 'comfortable',
      view: validViews.includes(savedView) ? savedView : 'week',
      tool: 'default',
      enabledSpecs: SPECIALISTS.map(s => s.id),
      enabledApps: APPS.map(a => a.id),
      showActive: true, showInactive: true,
      weekOffset: 0, dayCursor: 0, monthCursor: { y: 2026, m: 5 },
      miniCursor: { y: 2026, m: 5 }, selectedIso: isoOf(BASE_MONDAY),
      windows: WINDOWS.slice(),
      detail: null, create: null, bulk: null, toast: null,
      scrollEl: null, _toastT: null,
      SPECIALISTS, APPS,
      navCollapsed: false, navActive: 'Calendario', viewMenu: false,
      nav: [
        ['Inicio', 'bx-home-alt-2'],
        ['Usuarios', 'bx-group'],
        ['Calendario', 'bx-calendar'],
        ['Casos', 'bx-task'],
        ['Configuración', 'bx-cog'],
        ['Mi Perfil', 'bx-user'],
      ],
      views: [['day', 'Día'], ['5days', '5 días'], ['week', 'Semana'], ['month', 'Mes'], ['agenda', 'Agenda']],
      densities: [['compact', 'bx-collapse-vertical', 'Compacta'], ['comfortable', 'bx-menu', 'Cómoda'], ['spacious', 'bx-expand-vertical', 'Amplia']],
      tools: [['default', 'bx-pointer', 'Normal'], ['eraser', 'bx-eraser', 'Borrador'], ['select', 'bx-select-multiple', 'Seleccionar']],
    };
  },
  computed: {
    hourH() { return HOURH[this.density]; },
    interactive() { return this.tool === 'default'; },
    filtered() {
      return this.windows.filter(w =>
        this.enabledSpecs.includes(w.specialistId) &&
        this.enabledApps.includes(w.appId) &&
        (w.active ? this.showActive : this.showInactive));
    },
    isWeekish() { return this.view === 'week' || this.view === '5days' || this.view === 'agenda'; },
    nDays() { return this.view === '5days' ? 5 : 7; },
    visibleWeekDates() { return this.weekDates.slice(0, this.nDays); },
    weekDates() { return Array.from({ length: 7 }, (_, i) => isoOf(addDays(BASE_MONDAY, this.weekOffset * 7 + i))); },
    dayWeekOffset() { return Math.floor(this.dayCursor / 7); },
    dayIndex() { return ((this.dayCursor % 7) + 7) % 7; },
    dayDate() { return addDays(BASE_MONDAY, this.dayCursor); },
    dayViewWeekDates() { return Array.from({ length: 7 }, (_, i) => isoOf(addDays(BASE_MONDAY, this.dayWeekOffset * 7 + i))); },
    weekData() { return this.weekOffset === 0 ? this.filtered : []; },
    dayData() { return this.dayWeekOffset === 0 ? this.filtered : []; },
    todayIndexWeek() { return this.weekOffset === 0 ? 0 : -1; },
    isDayToday() { return this.dayCursor === 0; },
    weekNowHour() { return this.todayIndexWeek === 0 ? NOW_HOUR : null; },
    dayNowHour() { return this.isDayToday ? NOW_HOUR : null; },
    todayIso() { return isoOf(BASE_MONDAY); },
    holidayMap() { return HOLIDAYS; },
    dayHoliday() { return HOLIDAYS[isoOf(this.dayDate)] || null; },
    viewLabel() { const o = this.views.find(v => v[0] === this.view); return o ? o[1] : ''; },
    weekLabel() {
      if (this.view === 'month') return cap(MONTHS[this.monthCursor.m]) + ' ' + this.monthCursor.y;
      if (this.view === 'day') {
        const d = this.dayDate;
        return `${cap(DAY_FULL[this.dayIndex])} ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
      }
      const span = this.view === '5days' ? 4 : 6;
      const a = addDays(BASE_MONDAY, this.weekOffset * 7), b = addDays(BASE_MONDAY, this.weekOffset * 7 + span);
      const mo = a.getMonth() === b.getMonth() ? MON_SHORT[a.getMonth()] : `${MON_SHORT[a.getMonth()]}–${MON_SHORT[b.getMonth()]}`;
      return `${a.getDate()} – ${b.getDate()} ${mo} ${b.getFullYear()}`;
    },
  },
  watch: {
    theme(v) { document.documentElement.dataset.theme = v; },
    density() { this.scheduleScroll(); },
    view(v) { try { localStorage.setItem('tyflow.cal.view', v); } catch(e){} this.scheduleScroll(); },
    weekOffset() { this.scheduleScroll(); },
    dayCursor() { this.scheduleScroll(); },
  },
  methods: {
    initials(name) { return initialsOf(name); },
    selectView(v) { this.view = v; this.viewMenu = false; },
    showToast(msg) { this.toast = msg; clearTimeout(this._toastT); this._toastT = setTimeout(() => { this.toast = null; }, 2200); },
    setScroll(el) { this.scrollEl = el; this.scheduleScroll(); },
    scheduleScroll() { this.$nextTick(() => { if (this.scrollEl && this.view !== 'month' && this.view !== 'agenda') this.scrollEl.scrollTop = 7 * this.hourH - 12; }); },
    toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; },
    goPrev() {
      if (this.isWeekish) this.weekOffset--;
      else if (this.view === 'day') this.dayCursor--;
      else { const { y, m } = this.monthCursor; this.monthCursor = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; }
      this.syncSelected();
    },
    goNext() {
      if (this.isWeekish) this.weekOffset++;
      else if (this.view === 'day') this.dayCursor++;
      else { const { y, m } = this.monthCursor; this.monthCursor = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; }
      this.syncSelected();
    },
    goToday() {
      this.weekOffset = 0; this.dayCursor = 0; this.monthCursor = { y: 2026, m: 5 };
      this.miniCursor = { y: 2026, m: 5 }; this.selectedIso = isoOf(BASE_MONDAY);
    },
    syncSelected() {
      if (this.view === 'day') this.selectedIso = isoOf(this.dayDate);
      else if (this.isWeekish) this.selectedIso = isoOf(addDays(BASE_MONDAY, this.weekOffset * 7));
      if (this.view !== 'month') {
        const d = this.view === 'day' ? this.dayDate : addDays(BASE_MONDAY, this.weekOffset * 7);
        this.miniCursor = { y: d.getFullYear(), m: d.getMonth() };
      } else { this.miniCursor = { ...this.monthCursor }; }
    },
    miniPrev() { const { y, m } = this.miniCursor; this.miniCursor = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; },
    miniNext() { const { y, m } = this.miniCursor; this.miniCursor = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; },
    pickDay(cell) {
      const diff = Math.round((cell.date - BASE_MONDAY) / 86400000);
      this.selectedIso = cell.iso;
      if (this.view === 'day') this.dayCursor = diff;
      else if (this.isWeekish) this.weekOffset = Math.floor(diff / 7);
      else this.monthCursor = { y: cell.date.getFullYear(), m: cell.date.getMonth() };
    },
    toggleSpec(id) {
      this.enabledSpecs = this.enabledSpecs.includes(id)
        ? this.enabledSpecs.filter(x => x !== id) : [...this.enabledSpecs, id];
    },
    toggleApp(id) {
      this.enabledApps = this.enabledApps.includes(id)
        ? this.enabledApps.filter(x => x !== id) : [...this.enabledApps, id];
    },
    allSpecs() {
      this.enabledSpecs = this.enabledSpecs.length === SPECIALISTS.length ? [] : SPECIALISTS.map(s => s.id);
    },
    allApps() {
      this.enabledApps = this.enabledApps.length === APPS.length ? [] : APPS.map(a => a.id);
    },
    toggleActiveFilter() { this.showActive = !this.showActive; },
    toggleInactiveFilter() { this.showInactive = !this.showInactive; },
    openCreate() { this.create = { day: 0, start: 9, end: 11, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true }; },
    openBulk() { this.bulk = true; },
    submitBulk(list) {
      const stamp = Date.now();
      const created = list.map((d, i) => ({ ...d, id: 'wb' + (stamp + i) }));
      this.windows = [...this.windows, ...created];
      this.bulk = null;
      this.showToast(`${created.length} ventanas creadas en bloque.`);
    },
    onWeekCreate({ day, start, end }) {
      if (this.weekOffset !== 0) return;
      this.create = { day, start, end, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true };
    },
    onDayCreate({ start, end }) {
      this.create = { day: this.dayIndex, start, end, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true };
    },
    submitCreate(data) {
      const fields = { specialistId: data.specialistId, appId: data.appId, day: data.day, start: data.start, end: data.end, active: data.active };
      if (data.edit && data.id) {
        this.windows = this.windows.map(x => x.id === data.id ? { ...x, ...fields } : x);
        this.showToast('Ventana actualizada.');
      } else {
        this.windows = [...this.windows, { ...fields, id: 'w' + Date.now() }];
        this.showToast('Ventana de trabajo creada.');
      }
      this.create = null;
    },
    toggleActive(w) {
      const ids = new Set((w.members || [w]).map(m => m.id));
      const newActive = !w.active;
      this.windows = this.windows.map(x => ids.has(x.id) ? { ...x, active: newActive } : x);
      if (w.members) { this.detail = null; this.showToast(`${ids.size} ventanas ${newActive ? 'habilitadas' : 'inhabilitadas'}.`); }
      else {
        if (this.detail && this.detail.id === w.id) this.detail = { ...this.detail, active: newActive };
        this.showToast(newActive ? 'Ventana habilitada.' : 'Ventana inhabilitada.');
      }
    },
    removeWindow(w) {
      const ids = new Set((w.members || [w]).map(m => m.id));
      this.windows = this.windows.filter(x => !ids.has(x.id));
      this.detail = null;
      this.showToast(ids.size > 1 ? `${ids.size} ventanas eliminadas.` : 'Ventana eliminada.');
    },
    editFromDetail() { this.create = { ...this.detail, edit: true }; this.detail = null; },
    editOne(member) { this.create = { ...member, edit: true }; this.detail = null; },
    onSelectDay(cell) {
      const diff = Math.round((cell.date - BASE_MONDAY) / 86400000);
      this.dayCursor = diff; this.selectedIso = cell.iso; this.view = 'day';
    },
  },
  template: `
    <div class="shell">
      <aside :class="['navrail', navCollapsed && 'navrail--collapsed']">
        <div class="navrail__brand">
          <span class="navrail__logo">Ty</span>
          <span class="navrail__word">TyFlow</span>
          <button class="navrail__collapse" @click="navCollapsed = !navCollapsed" :title="navCollapsed ? 'Expandir' : 'Colapsar'">
            <i :class="['bx', navCollapsed ? 'bx-chevron-right' : 'bx-chevron-left']"></i>
          </button>
        </div>
        <nav class="navrail__nav">
          <button v-for="[label, icon] in nav" :key="label"
            :class="['navrail__item', navActive === label && 'navrail__item--active']" :title="label">
            <i :class="['bx', icon]"></i><span class="navrail__label">{{ label }}</span>
          </button>
        </nav>
        <cal-sidebar
          :specialists="SPECIALISTS" :apps="APPS"
          :enabled-specs="enabledSpecs" :enabled-apps="enabledApps"
          :show-active="showActive" :show-inactive="showInactive"
          :mini-year="miniCursor.y" :mini-month="miniCursor.m"
          :selected-iso="selectedIso" :today-iso="todayIso"
          @create="openCreate" @bulk="openBulk"
          @toggle-spec="toggleSpec" @toggle-app="toggleApp"
          @all-specs="allSpecs" @all-apps="allApps"
          @toggle-active="toggleActiveFilter" @toggle-inactive="toggleInactiveFilter"
          @mini-prev="miniPrev" @mini-next="miniNext" @pick-day="pickDay" />
      </aside>

      <button v-if="navCollapsed" class="nav-fab" @click="navCollapsed = false" title="Mostrar menú">
        <i class="bx bx-chevrons-right"></i>
      </button>

      <div class="app">
        <div class="toolbar">
          <button class="tb-today" @click="goToday">Hoy</button>
          <div class="tb-nav">
            <button class="tb-arrow" @click="goPrev"><i class="bx bx-chevron-left"></i></button>
            <button class="tb-arrow" @click="goNext"><i class="bx bx-chevron-right"></i></button>
          </div>
          <span class="tb-title">{{ weekLabel }}</span>

          <div class="tb-spacer"></div>

        <div class="viewdd" ref="viewDD">
          <button class="viewdd__btn" @click.stop="viewMenu = !viewMenu">
            <span>{{ viewLabel }}</span>
            <i :class="['bx bx-chevron-down viewdd__caret', viewMenu && 'viewdd__caret--open']"></i>
          </button>
          <div v-if="viewMenu" class="viewdd__menu">
            <button v-for="[v, l] in views" :key="v" :class="['viewdd__opt', view === v && 'viewdd__opt--on']" @click="selectView(v)">
              <span>{{ l }}</span>
              <i v-if="view === v" class="bx bx-check"></i>
            </button>
          </div>
        </div>

        <div class="seg seg--icons" v-show="view !== 'month' && view !== 'agenda'">
          <button v-for="[d, ic, l] in densities" :key="d" :class="['seg__btn', density === d && 'seg__btn--active']" :title="l" @click="density = d">
            <i :class="['bx', ic]"></i>
          </button>
        </div>

        <div class="seg seg--icons">
          <button v-for="[t, ic, l] in tools" :key="t" :class="['seg__btn', tool === t && 'seg__btn--active']" :title="l" @click="tool = t">
            <i :class="['bx', ic]"></i>
          </button>
        </div>
      </div>

      <div class="cal-main">
        <div class="cal-wrap">
          <week-view v-if="view === 'week' || view === '5days'"
            :windows="weekData" :week-dates="visibleWeekDates" :hour-h="hourH"
            :today-index="todayIndexWeek" :now-hour="weekNowHour" :interactive="interactive" :holidays="holidayMap"
            @select="detail = $event" @create-range="onWeekCreate" @scroll-ready="setScroll" />

          <day-view v-else-if="view === 'day'"
            :windows="dayData" :week-dates="dayViewWeekDates" :day-index="dayIndex" :hour-h="hourH"
            :is-today="isDayToday" :now-hour="dayNowHour" :interactive="interactive" :holiday="dayHoliday"
            @select="detail = $event" @create-range="onDayCreate" @scroll-ready="setScroll" />

          <agenda-view v-else-if="view === 'agenda'"
            :windows="weekData" :week-dates="weekDates" :today-index="todayIndexWeek"
            @select="detail = $event" />

          <month-view v-else
            :windows="filtered" :year="monthCursor.y" :month="monthCursor.m" :today-iso="todayIso" :holidays="holidayMap"
            @select-day="onSelectDay" @select="detail = $event" />
        </div>
      </div>

      <detail-modal v-if="detail" :w="detail" @close="detail = null" @toggle="toggleActive" @delete="removeWindow" @edit="editFromDetail" @edit-one="editOne" />
      <create-modal v-if="create" :init="create" @close="create = null" @submit="submitCreate" />
      <bulk-assign-modal v-if="bulk" :holidays="holidayMap" :week-dates="weekDates" @close="bulk = null" @submit="submitBulk" />
      <div v-if="toast" class="toast"><i class="bx bx-check-circle"></i>{{ toast }}</div>
      </div>
    </div>
  `,
  mounted() {
    document.documentElement.dataset.theme = this.theme; document.documentElement.dataset.density = this.density;
    this._viewDoc = (e) => { if (this.$refs.viewDD && !this.$refs.viewDD.contains(e.target)) this.viewMenu = false; };
    document.addEventListener('click', this._viewDoc);
  },
  beforeUnmount() { document.removeEventListener('click', this._viewDoc); },
};

Vue.createApp(App).mount('#root');
})();
