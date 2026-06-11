;(function(){
// ============================================================
// TyFlow Calendar — componentes visuales (Vue 3)
// ============================================================
const { appById, specById, initialsOf, fmtHour, fmtRange, HOURS } = window.TY;

// Bloque de ventana cronometrada (posicionado por la vista).
// `w` puede ser una ventana o un GRUPO (con .members) de ventanas idénticas.
const WindowBlock = {
  name: 'WindowBlock',
  props: ['w', 'top', 'height', 'left', 'width', 'selected'],
  emits: ['select'],
  computed: {
    app() { return appById(this.w.appId); },
    members() { return this.w.members || [this.w]; },
    count() { return this.members.length; },
    grouped() { return this.count > 1; },
    leadSpec() { return specById(this.members[0].specialistId); },
    avatars() { return this.members.slice(0, 3).map(m => specById(m.specialistId)); },
    short() { return this.height != null && this.height < 40; },
    cls() {
      return ['wb', this.grouped && 'wb--group', !this.w.active && 'wb--inactive', this.selected && 'wb--selected'].filter(Boolean);
    },
    styleObj() {
      return { top: this.top + 'px', height: this.height + 'px', left: this.left, width: this.width, '--app': this.app.color };
    },
    title() {
      const t = this.app.name + ' · ' + fmtRange(this.w.start, this.w.end);
      return (this.grouped ? this.count + ' especialistas · ' : this.leadSpec.fullName + ' · ') + t;
    },
  },
  methods: {
    initialsOf, fmtRange,
    onClick(e) { e.stopPropagation(); this.$emit('select', this.w); },
  },
  template: `
    <div :class="cls" :style="styleObj" @click="onClick" :title="title">
      <div class="wb__head">
        <template v-if="grouped">
          <span class="wb__stack">
            <span v-for="(s, i) in avatars" :key="i" class="wb__avatar wb__avatar--stk"
                  :style="{ background: s.color, zIndex: 5 - i }">{{ initialsOf(s.fullName) }}</span>
            <span v-if="count > 3" class="wb__stack-more">+{{ count - 3 }}</span>
          </span>
          <span class="wb__name">{{ count }} esp.</span>
        </template>
        <template v-else>
          <span class="wb__avatar" :style="{ background: leadSpec.color }">{{ initialsOf(leadSpec.fullName) }}</span>
          <span class="wb__name">{{ leadSpec.fullName }}</span>
        </template>
        <span v-if="!w.active" class="wb__tag"><i class="bx bx-block"></i></span>
      </div>
      <span v-if="!short" class="wb__time">{{ fmtRange(w.start, w.end) }}</span>
      <span v-if="!short" class="wb__app">{{ app.name }}</span>
    </div>
  `,
};

// Chip de día completo / ventana larga (en el lane "todo el día")
const AllDayChip = {
  name: 'AllDayChip',
  props: ['w'],
  emits: ['select'],
  computed: {
    app() { return appById(this.w.appId); },
    spec() { return specById(this.w.specialistId); },
  },
  methods: {
    initialsOf, fmtHour,
    onClick(e) { e.stopPropagation(); this.$emit('select', this.w); },
  },
  template: `
    <div :class="['adc', !w.active && 'adc--inactive']" :style="{ '--app': app.color }" @click="onClick"
         :title="spec.fullName + ' · ' + app.name">
      <span class="adc__avatar">{{ initialsOf(spec.fullName) }}</span>
      <span class="adc__name">{{ spec.fullName }}</span>
      <span class="adc__time">{{ fmtHour(w.start, true) }}–{{ fmtHour(w.end, true) }}</span>
    </div>
  `,
};

const AllDayMore = {
  name: 'AllDayMore',
  props: ['count'],
  emits: ['expand'],
  template: `<div class="adc adc--more" @click="$emit('expand')"><span class="adc__name">+{{ count }} más</span></div>`,
};

// Barra de ventana en celda de mes (estilo "calendar bar")
const MonthChip = {
  name: 'MonthChip',
  props: ['w'],
  emits: ['select'],
  computed: {
    app() { return appById(this.w.appId); },
    spec() { return specById(this.w.specialistId); },
  },
  methods: {
    fmtHour,
    onClick(e) { e.stopPropagation(); this.$emit('select', this.w); },
  },
  template: `
    <div :class="['mcal__chip', !w.active && 'mcal__chip--inactive']" :style="{ '--app': app.color }"
         @click="onClick" :title="spec.fullName + ' · ' + app.name">
      <span class="mcal__chip-time">{{ fmtHour(w.start, true) }}</span>
      <span class="mcal__chip-text">{{ spec.fullName }}</span>
    </div>
  `,
};

// Gutter de horas
const HourGutter = {
  name: 'HourGutter',
  props: ['hourH'],
  data() { return { HOURS }; },
  methods: { fmtHour },
  template: `
    <div class="cal-gutter">
      <div v-for="h in HOURS" :key="h" class="cal-gutter__cell" :style="{ height: hourH + 'px' }">
        <span class="cal-gutter__label">{{ h === 0 ? '12 AM' : fmtHour(h) }}</span>
      </div>
    </div>
  `,
};

Object.assign(window.TY, { WindowBlock, AllDayChip, AllDayMore, MonthChip, HourGutter });
})();
