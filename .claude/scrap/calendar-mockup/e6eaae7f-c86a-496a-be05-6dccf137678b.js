;(function(){
// ============================================================
// TyFlow Calendar — vistas Semana / Día / Mes (Vue 3)
// ============================================================
const {
  WEEK_DATES, HOURS, DAY_LABELS, DAY_FULL,
  fmtHour, layoutColumns, splitDay, groupWindows, buildMonthGrid,
  WindowBlock, AllDayChip, AllDayMore, MonthChip, HourGutter,
} = window.TY;

// ---- Columna de un día (semana/día) — maneja drag-create ----
const DayColumn = {
  name: 'DayColumn',
  components: { WindowBlock },
  props: {
    dayIndex: Number, windows: Array, hourH: Number,
    isToday: Boolean, nowHour: { default: null }, interactive: Boolean, wide: Boolean,
    isHoliday: Boolean,
  },
  emits: ['select', 'create-range'],
  data() { return { drag: null }; },
  computed: {
    laid() { return layoutColumns(groupWindows(this.windows)); },
    colHeight() { return 24 * this.hourH; },
    gutterPct() { return this.wide ? 1.5 : 2; },
    colClass() {
      return ['cal-col',
        this.isToday && 'cal-col--today',
        this.dayIndex >= 5 && 'cal-col--weekend',
        this.isHoliday && 'cal-col--holiday',
        this.interactive && 'cal-col--interactive'].filter(Boolean);
    },
    gA() { return this.drag ? Math.min(this.drag.startH, this.drag.endH) : 0; },
    gB() { return this.drag ? Math.max(this.drag.startH, this.drag.endH) : 0; },
  },
  methods: {
    fmtHour,
    blockStyle(item) {
      const { w, col, cols } = item;
      const top = w.start * this.hourH + 1;
      const height = Math.max(this.hourH * 0.5, (w.end - w.start) * this.hourH - 2);
      const colW = (100 - this.gutterPct) / cols;
      const left = `${col * colW + this.gutterPct / 2}%`;
      const width = `${colW - (cols > 1 ? 0.6 : this.gutterPct)}%`;
      return { top, height, left, width };
    },
    yToHour(clientY) {
      const rect = this.$refs.col.getBoundingClientRect();
      let h = (clientY - rect.top) / this.hourH;
      h = Math.round(h * 2) / 2;
      return Math.max(0, Math.min(24, h));
    },
    onDown(e) {
      if (!this.interactive || e.button !== 0) return;
      if (e.target.closest('.wb')) return;
      const startH = this.yToHour(e.clientY);
      this.drag = { startH, endH: startH + 0.5 };
      const move = (ev) => { if (this.drag) this.drag = { startH, endH: this.yToHour(ev.clientY) }; };
      const up = (ev) => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        const end = this.yToHour(ev.clientY);
        const a = Math.min(startH, end), b = Math.max(startH, end);
        this.drag = null;
        if (b - a >= 0.5) this.$emit('create-range', { day: this.dayIndex, start: a, end: b });
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
  },
  template: `
    <div ref="col" :class="colClass" :style="{ height: colHeight + 'px' }" @mousedown="onDown">
      <div v-for="h in HOURS" :key="h" class="cal-hour"></div>

      <window-block v-for="item in laid" :key="item.w.id"
        :w="item.w"
        :top="blockStyle(item).top" :height="blockStyle(item).height"
        :left="blockStyle(item).left" :width="blockStyle(item).width"
        @select="$emit('select', $event)" />

      <div v-if="isToday && nowHour != null" class="cal-now" :style="{ top: (nowHour * hourH) + 'px' }">
        <span class="cal-now__dot"></span><span class="cal-now__line"></span>
      </div>

      <div v-if="drag" class="cal-ghost" :style="{ top: (gA * hourH) + 'px', height: Math.max(6, (gB - gA) * hourH) + 'px' }">
        <span class="cal-ghost__label">{{ fmtHour(gA) }} – {{ fmtHour(gB) }}</span>
      </div>
    </div>
  `,
  created() { this.HOURS = HOURS; },
};

// ---- Lane "todo el día" ----
const AllDayLane = {
  name: 'AllDayLane',
  components: { AllDayChip, AllDayMore },
  props: { columns: Array, gridTemplate: String, maxRows: { default: 2 } },
  emits: ['select', 'expand-day'],
  computed: { any() { return this.columns.some(c => c.length > 0); } },
  template: `
    <div v-if="any" class="allday" :style="{ gridTemplateColumns: gridTemplate }">
      <div class="allday__gutter"><span class="allday__gutter-label">Todo<br>el día</span></div>
      <div v-for="(wins, i) in columns" :key="i" :class="['allday__col', i >= 5 && 'allday__col--weekend']">
        <all-day-chip v-for="w in wins.slice(0, maxRows)" :key="w.id" :w="w" @select="$emit('select', $event)" />
        <all-day-more v-if="wins.length > maxRows" :count="wins.length - maxRows" @expand="$emit('expand-day', i)" />
      </div>
    </div>
  `,
};

// ============================================================
// VISTA SEMANA
// ============================================================
const WeekView = {
  name: 'WeekView',
  components: { DayColumn, AllDayLane, HourGutter },
  props: {
    windows: Array, weekDates: Array, hourH: Number,
    todayIndex: Number, nowHour: { default: null }, interactive: Boolean,
    holidays: { type: Object, default: () => ({}) },
  },
  emits: ['select', 'create-range', 'scroll-ready'],
  data() { return { DAY_LABELS }; },
  computed: {
    nDays() { return this.weekDates.length; },
    gridTemplate() { return 'var(--gutter-w) repeat(' + this.nDays + ', 1fr)'; },
    byDay() { return this.weekDates.map((_, d) => this.windows.filter(w => w.day === d)); },
    split() { return this.byDay.map(splitDay); },
    allDayCols() { return this.split.map(s => s.allDay); },
  },
  methods: {
    dayNum(iso) { return parseInt(iso.split('-')[2], 10); },
    holiday(iso) { return this.holidays[iso] || null; },
    headCls(i, iso) {
      return ['cal-head__day', i === this.todayIndex && 'cal-head__day--today',
        i >= 5 && 'cal-head__day--weekend', this.holiday(iso) && 'cal-head__day--holiday'].filter(Boolean);
    },
  },
  mounted() { this.$emit('scroll-ready', this.$refs.scroll); },
  template: `
    <div class="cal">
      <div class="cal-head" :style="{ gridTemplateColumns: gridTemplate }">
        <div class="cal-head__gutter"></div>
        <div v-for="(iso, i) in weekDates" :key="iso" :class="headCls(i, iso)">
          <div class="cal-head__top">
            <span class="cal-head__dow">{{ DAY_LABELS[i] }}</span>
            <span class="cal-head__num">{{ dayNum(iso) }}</span>
          </div>
          <span v-if="holiday(iso)" class="cal-head__holiday"><i class="bx bxs-star"></i>{{ holiday(iso) }}</span>
        </div>
      </div>

      <div class="cal-scroll" ref="scroll">
        <div class="cal-body" :style="{ gridTemplateColumns: gridTemplate }">
          <hour-gutter :hour-h="hourH" />
          <day-column v-for="(iso, i) in weekDates" :key="iso"
            :day-index="i" :windows="byDay[i]" :hour-h="hourH"
            :is-today="i === todayIndex" :now-hour="nowHour" :interactive="interactive"
            :is-holiday="!!holiday(iso)"
            @select="$emit('select', $event)" @create-range="$emit('create-range', $event)" />
        </div>
      </div>
    </div>
  `,
};

// ============================================================
// VISTA DÍA
// ============================================================
const DayView = {
  name: 'DayView',
  components: { DayColumn, AllDayLane, HourGutter },
  props: {
    windows: Array, weekDates: Array, dayIndex: Number, hourH: Number,
    isToday: Boolean, nowHour: { default: null }, interactive: Boolean,
    holiday: { type: String, default: null },
  },
  emits: ['select', 'create-range', 'scroll-ready'],
  data() { return { DAY_FULL }; },
  computed: {
    gridTemplate() { return 'var(--gutter-w) 1fr'; },
    dayWins() { return this.windows.filter(w => w.day === this.dayIndex); },
    split() { return splitDay(this.dayWins); },
    num() { return parseInt(this.weekDates[this.dayIndex].split('-')[2], 10); },
  },
  mounted() { this.$emit('scroll-ready', this.$refs.scroll); },
  template: `
    <div class="cal">
      <div class="cal-head" :style="{ gridTemplateColumns: gridTemplate }">
        <div class="cal-head__gutter"></div>
        <div :class="['cal-head__day', isToday && 'cal-head__day--today', dayIndex >= 5 && 'cal-head__day--weekend', holiday && 'cal-head__day--holiday']" style="flex-direction:row;gap:0.6rem;align-items:center">
          <span class="cal-head__num">{{ num }}</span>
          <span class="cal-head__dow" style="font-size:0.8rem">{{ DAY_FULL[dayIndex] }}</span>
          <span v-if="holiday" class="cal-head__holiday"><i class="bx bxs-star"></i>{{ holiday }}</span>
        </div>
      </div>

      <div class="cal-scroll" ref="scroll">
        <div class="cal-body" :style="{ gridTemplateColumns: gridTemplate }">
          <hour-gutter :hour-h="hourH" />
          <day-column :day-index="dayIndex" :windows="dayWins" :hour-h="hourH"
            :is-today="isToday" :now-hour="nowHour" :interactive="interactive" :wide="true" :is-holiday="!!holiday"
            @select="$emit('select', $event)" @create-range="$emit('create-range', $event)" />
        </div>
      </div>
    </div>
  `,
};

// ============================================================
// VISTA MES
// ============================================================
const MonthView = {
  name: 'MonthView',
  components: { MonthChip },
  props: { windows: Array, year: Number, month: Number, todayIso: String, holidays: { type: Object, default: () => ({}) } },
  emits: ['select-day', 'select'],
  data() { return { DAY_LABELS }; },
  computed: {
    cells() { return buildMonthGrid(this.year, this.month); },
    rows() {
      const r = [];
      for (let i = 0; i < 6; i++) r.push(this.cells.slice(i * 7, i * 7 + 7));
      return r;
    },
    winsByIso() {
      const m = {};
      this.windows.forEach(w => { const iso = WEEK_DATES[w.day]; (m[iso] = m[iso] || []).push(w); });
      return m;
    },
  },
  methods: {
    wins(iso) { return this.winsByIso[iso] || []; },
    holiday(iso) { return (this.holidays && this.holidays[iso]) || null; },
    cellCls(cell) {
      return ['mcal__cell',
        !cell.inMonth && 'mcal__cell--other',
        cell.iso === this.todayIso && 'mcal__cell--today',
        this.holiday(cell.iso) && 'mcal__cell--holiday',
        cell.dow >= 5 && 'mcal__cell--weekend'].filter(Boolean);
    },
  },
  template: `
    <div class="cal">
      <div class="mcal">
        <div class="mcal__head">
          <div v-for="d in DAY_LABELS" :key="d" class="mcal__dow">{{ d }}</div>
        </div>
        <div class="mcal__body">
          <div v-for="(week, ri) in rows" :key="ri" class="mcal__row">
            <button v-for="cell in week" :key="cell.iso" :class="cellCls(cell)" @click="$emit('select-day', cell)">
              <div class="mcal__cell-head">
                <span v-if="holiday(cell.iso)" class="mcal__holiday" :title="holiday(cell.iso)"><i class="bx bxs-star"></i>{{ holiday(cell.iso) }}</span>
                <span class="mcal__day">{{ cell.day }}</span>
              </div>
              <month-chip v-for="w in wins(cell.iso).slice(0, 4)" :key="w.id" :w="w" @select="$emit('select', $event)" />
              <span v-if="wins(cell.iso).length > 4" class="mcal__more">+{{ wins(cell.iso).length - 4 }} más</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// ============================================================
// VISTA AGENDA (Scheduled) — lista cronológica por día
// ============================================================
const { appById, specById, initialsOf, fmtRange, MONTHS } = window.TY;

const AgendaView = {
  name: 'AgendaView',
  props: { windows: Array, weekDates: Array, todayIndex: Number },
  emits: ['select'],
  computed: {
    groups() {
      return this.weekDates.map((iso, i) => {
        const wins = this.windows
          .filter(w => w.day === i)
          .sort((a, b) => a.start - b.start || a.end - b.end);
        return { iso, dayIndex: i, wins };
      }).filter(g => g.wins.length);
    },
    isEmpty() { return this.groups.length === 0; },
  },
  methods: {
    initialsOf, fmtRange,
    app(w) { return appById(w.appId); },
    spec(w) { return specById(w.specialistId); },
    dayNum(iso) { return parseInt(iso.split('-')[2], 10); },
    monthShort(iso) { return MONTHS[parseInt(iso.split('-')[1], 10) - 1].slice(0, 3); },
    dayName(i) { return DAY_FULL[i]; },
  },
  template: `
    <div class="cal">
      <div class="agenda" v-if="!isEmpty">
        <div v-for="g in groups" :key="g.iso" class="agenda__group">
          <div :class="['agenda__date', g.dayIndex === todayIndex && 'agenda__date--today']">
            <span class="agenda__date-num">{{ dayNum(g.iso) }}</span>
            <div class="agenda__date-meta">
              <span class="agenda__date-dow">{{ dayName(g.dayIndex) }}</span>
              <span class="agenda__date-mon">{{ monthShort(g.iso) }}</span>
            </div>
          </div>
          <div class="agenda__rows">
            <button v-for="w in g.wins" :key="w.id"
              :class="['agenda__row', !w.active && 'agenda__row--inactive']"
              :style="{ '--app': app(w).color }" @click="$emit('select', w)">
              <span class="agenda__time">{{ fmtRange(w.start, w.end) }}</span>
              <span class="agenda__bar"></span>
              <span class="agenda__avatar">{{ initialsOf(spec(w).fullName) }}</span>
              <span class="agenda__name">{{ spec(w).fullName }}</span>
              <span class="agenda__app">{{ app(w).name }}</span>
              <span v-if="!w.active" class="agenda__off"><i class="bx bx-block"></i> Inactiva</span>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="agenda-empty">
        <i class="bx bx-calendar-x"></i>
        <p>No hay ventanas de trabajo en este rango.</p>
      </div>
    </div>
  `,
};

Object.assign(window.TY, { DayColumn, AllDayLane, WeekView, DayView, MonthView, AgendaView });
})();
