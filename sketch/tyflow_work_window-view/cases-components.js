;(function(){
// ============================================================
// TyFlow Casos — componentes compartidos (Vue)
// ============================================================
const T = window.TYC;
const { ORIGINS, STATUSES, PRIORITIES, appById, specById, LOAD_COLOR, LOAD_LABEL, loadOf } = T;

// ---- Avatar con iniciales ----
const Avatar = {
  name: 'Avatar',
  props: { spec: Object, size: { default: 28 } },
  computed: {
    style() {
      return {
        width: this.size + 'px', height: this.size + 'px',
        background: this.spec ? this.spec.color : 'var(--faint)',
        fontSize: (this.size * 0.36) + 'px',
      };
    },
  },
  template: `<div class="avatar" :style="style">{{ spec ? spec.initials : '?' }}</div>`,
};

// ---- Badge de origen ----
const OriginBadge = {
  name: 'OriginBadge',
  props: { id: String },
  computed: { o() { return ORIGINS[this.id]; } },
  template: `
    <span class="badge badge--origin" :style="{ background: o.bg, color: o.color }">
      <i :class="['bx', o.icon]"></i>{{ o.name }}
    </span>`,
};

// ---- Badge de estado ----
const StatusBadge = {
  name: 'StatusBadge',
  props: { id: String, dotOnly: Boolean },
  computed: { s() { return STATUSES[this.id]; } },
  template: `
    <span class="badge badge--status" :style="{ background: s.bg, color: s.color }">
      {{ s.name }}
    </span>`,
};

// ---- Badge de prioridad ----
const PriorityBadge = {
  name: 'PriorityBadge',
  props: { id: String },
  computed: { p() { return PRIORITIES[this.id]; } },
  template: `
    <span class="badge badge--priority" :style="{ background: p.bg, color: p.color }">
      <span class="dot" :style="{ background: p.color }"></span>{{ p.name }}
    </span>`,
};

// ---- Barra de carga ----
const LoadBar = {
  name: 'LoadBar',
  props: { load: Object },
  computed: {
    color() { return LOAD_COLOR[this.load.level]; },
    pct() { return Math.min(100, Math.round(this.load.ratio * 100)); },
  },
  template: `
    <div class="loadbar"><div class="loadbar__fill" :style="{ width: pct + '%', background: color }"></div></div>`,
};

window.TYC_C = { Avatar, OriginBadge, StatusBadge, PriorityBadge, LoadBar };
})();
