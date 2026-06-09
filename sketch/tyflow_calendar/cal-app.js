;(function(){
// ============================================================
// TyFlow Calendar — App raíz, modales y montaje (Vue 3)
// ============================================================
const T = window.TY;
const {
  APPS, SPECIALISTS, WINDOWS, DAY_FULL, MONTHS,
  appById, specById, fmtHour, fmtRange,
  WeekView, DayView, MonthView,
} = T;

const HOURH = { compact: 32, comfortable: 48, spacious: 68 };
const BASE_MONDAY = new Date(2026, 5, 8);
const NOW_HOUR = 14;
const MON_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- Modal de detalle ----
const DetailModal = {
  name: 'DetailModal',
  props: ['w'],
  emits: ['close', 'toggle', 'delete', 'edit'],
  computed: {
    app() { return appById(this.w.appId); },
    spec() { return specById(this.w.specialistId); },
  },
  data() { return { DAY_FULL }; },
  methods: { fmtRange },
  template: `
    <div class="modal-backdrop" @click="$emit('close')">
      <div class="modal" :style="{ '--app': app.color }" @click.stop>
        <div class="modal__top"></div>
        <div class="modal__head">
          <div>
            <div class="modal__title">{{ spec.fullName }}</div>
            <div class="modal__sub">Ventana de trabajo</div>
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
        </div>
        <div class="modal__foot">
          <button class="mbtn" @click="$emit('toggle', w)">{{ w.active ? 'Inhabilitar' : 'Habilitar' }}</button>
          <button class="mbtn" @click="$emit('edit')">Editar</button>
          <button class="mbtn mbtn--danger" @click="$emit('delete', w)">Eliminar</button>
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
    submit() { if (this.end <= this.start) return; this.$emit('submit', { specialistId: this.specialistId, appId: this.appId, day: this.day, start: this.start, end: this.end, active: this.active }); },
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

// ============================================================
// APP RAÍZ
// ============================================================
const App = {
  name: 'App',
  components: { WeekView, DayView, MonthView, DetailModal, CreateModal },
  data() {
    return {
      theme: 'dark', density: 'comfortable', view: 'week', tool: 'default',
      fSpec: 'all', fApp: 'all',
      weekOffset: 0, dayCursor: 0, monthCursor: { y: 2026, m: 5 },
      windows: WINDOWS.slice(),
      detail: null, create: null, toast: null,
      scrollEl: null, _toastT: null,
      SPECIALISTS, APPS,
      views: [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']],
      densities: [['compact', 'bx-collapse-vertical', 'Compacta'], ['comfortable', 'bx-menu', 'Cómoda'], ['spacious', 'bx-expand-vertical', 'Amplia']],
      tools: [['default', 'bx-pointer', 'Normal'], ['eraser', 'bx-eraser', 'Borrador'], ['select', 'bx-select-multiple', 'Seleccionar']],
    };
  },
  computed: {
    hourH() { return HOURH[this.density]; },
    interactive() { return this.tool === 'default'; },
    filtered() {
      return this.windows.filter(w =>
        (this.fSpec === 'all' || w.specialistId === this.fSpec) &&
        (this.fApp === 'all' || w.appId === this.fApp));
    },
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
    weekLabel() {
      if (this.view === 'month') return cap(MONTHS[this.monthCursor.m]) + ' ' + this.monthCursor.y;
      if (this.view === 'day') {
        const d = this.dayDate;
        return `${cap(DAY_FULL[this.dayIndex])} ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
      }
      const a = addDays(BASE_MONDAY, this.weekOffset * 7), b = addDays(BASE_MONDAY, this.weekOffset * 7 + 6);
      const mo = a.getMonth() === b.getMonth() ? MON_SHORT[a.getMonth()] : `${MON_SHORT[a.getMonth()]}–${MON_SHORT[b.getMonth()]}`;
      return `${a.getDate()} – ${b.getDate()} ${mo} ${b.getFullYear()}`;
    },
  },
  watch: {
    theme(v) { document.documentElement.dataset.theme = v; },
    density() { this.scheduleScroll(); },
    view() { this.scheduleScroll(); },
    weekOffset() { this.scheduleScroll(); },
    dayCursor() { this.scheduleScroll(); },
  },
  methods: {
    showToast(msg) { this.toast = msg; clearTimeout(this._toastT); this._toastT = setTimeout(() => { this.toast = null; }, 2200); },
    setScroll(el) { this.scrollEl = el; this.scheduleScroll(); },
    scheduleScroll() { this.$nextTick(() => { if (this.scrollEl && this.view !== 'month') this.scrollEl.scrollTop = 7 * this.hourH - 12; }); },
    toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; },
    goPrev() {
      if (this.view === 'week') this.weekOffset--;
      else if (this.view === 'day') this.dayCursor--;
      else { const { y, m } = this.monthCursor; this.monthCursor = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; }
    },
    goNext() {
      if (this.view === 'week') this.weekOffset++;
      else if (this.view === 'day') this.dayCursor++;
      else { const { y, m } = this.monthCursor; this.monthCursor = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; }
    },
    goToday() { this.weekOffset = 0; this.dayCursor = 0; this.monthCursor = { y: 2026, m: 5 }; },
    openCreate() { this.create = { day: 0, start: 9, end: 11, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true }; },
    onWeekCreate({ day, start, end }) {
      if (this.weekOffset !== 0) return;
      this.create = { day, start, end, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true };
    },
    onDayCreate({ start, end }) {
      this.create = { day: this.dayIndex, start, end, specialistId: SPECIALISTS[0].id, appId: APPS[0].id, active: true };
    },
    submitCreate(data) {
      this.windows = [...this.windows, { ...data, id: 'w' + Date.now() }];
      this.create = null;
      this.showToast('Ventana de trabajo creada.');
    },
    toggleActive(w) {
      this.windows = this.windows.map(x => x.id === w.id ? { ...x, active: !x.active } : x);
      if (this.detail && this.detail.id === w.id) this.detail = { ...this.detail, active: !this.detail.active };
      this.showToast(w.active ? 'Ventana inhabilitada.' : 'Ventana habilitada.');
    },
    removeWindow(w) {
      this.windows = this.windows.filter(x => x.id !== w.id);
      this.detail = null;
      this.showToast('Ventana eliminada.');
    },
    editFromDetail() { this.create = { ...this.detail, edit: true }; this.detail = null; },
    onSelectDay(cell) {
      const diff = Math.round((cell.date - BASE_MONDAY) / 86400000);
      this.dayCursor = diff; this.view = 'day';
    },
  },
  template: `
    <div class="app">
      <div class="topbar">
        <div class="topbar__title">Calendario</div>
        <div class="topbar__actions">
          <button class="icon-btn" title="Tema" @click="toggleTheme">
            <i :class="['bx', theme === 'dark' ? 'bx-moon' : 'bx-sun']"></i>
          </button>
          <button class="btn-create" @click="openCreate"><i class="bx bx-plus"></i> Nueva Ventana</button>
        </div>
      </div>

      <div class="toolbar">
        <button class="tb-arrow" @click="goPrev"><i class="bx bx-chevron-left"></i></button>
        <button class="tb-today" @click="goToday">Hoy</button>
        <button class="tb-arrow" @click="goNext"><i class="bx bx-chevron-right"></i></button>
        <button class="tb-date"><span>{{ weekLabel }}</span><i class="bx bx-calendar"></i></button>

        <div class="seg">
          <button v-for="[v, l] in views" :key="v" :class="['seg__btn', view === v && 'seg__btn--active']" @click="view = v">{{ l }}</button>
        </div>

        <span class="tb-label">Densidad</span>
        <div class="seg">
          <button v-for="[d, ic, l] in densities" :key="d" :class="['seg__btn', density === d && 'seg__btn--active']" :title="l" @click="density = d">
            <i :class="['bx', ic]"></i>
          </button>
        </div>

        <div class="seg">
          <button v-for="[t, ic, l] in tools" :key="t" :class="['tool-btn', tool === t && 'tool-btn--active']" :title="l" @click="tool = t">
            <i :class="['bx', ic]"></i>
          </button>
        </div>

        <div class="tb-spacer"></div>

        <div class="legend">
          <span class="legend__item"><span class="legend__dot legend__dot--active"></span>Activa</span>
          <span class="legend__item"><span class="legend__dot legend__dot--inactive"></span>Inactiva</span>
        </div>
        <select class="tb-select" v-model="fSpec">
          <option value="all">Todos los especialistas</option>
          <option v-for="s in SPECIALISTS" :key="s.id" :value="s.id">{{ s.fullName }}</option>
        </select>
        <select class="tb-select" v-model="fApp">
          <option value="all">Todas las apps</option>
          <option v-for="a in APPS" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>

      <div class="cal-wrap">
        <week-view v-if="view === 'week'"
          :windows="weekData" :week-dates="weekDates" :hour-h="hourH"
          :today-index="todayIndexWeek" :now-hour="weekNowHour" :interactive="interactive"
          @select="detail = $event" @create-range="onWeekCreate" @scroll-ready="setScroll" />

        <day-view v-else-if="view === 'day'"
          :windows="dayData" :week-dates="dayViewWeekDates" :day-index="dayIndex" :hour-h="hourH"
          :is-today="isDayToday" :now-hour="dayNowHour" :interactive="interactive"
          @select="detail = $event" @create-range="onDayCreate" @scroll-ready="setScroll" />

        <month-view v-else
          :windows="filtered" :year="monthCursor.y" :month="monthCursor.m" :today-iso="todayIso"
          @select-day="onSelectDay" />
      </div>

      <detail-modal v-if="detail" :w="detail" @close="detail = null" @toggle="toggleActive" @delete="removeWindow" @edit="editFromDetail" />
      <create-modal v-if="create" :init="create" @close="create = null" @submit="submitCreate" />
      <div v-if="toast" class="toast"><i class="bx bx-check-circle"></i>{{ toast }}</div>
    </div>
  `,
  mounted() { document.documentElement.dataset.theme = this.theme; document.documentElement.dataset.density = this.density; },
};

Vue.createApp(App).mount('#root');
})();
