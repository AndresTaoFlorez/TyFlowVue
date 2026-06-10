;(function(){
// ============================================================
// TyFlow Calendar — barra lateral interna (estilo Google Cal)
// Crear · mini-calendario · filtros de especialistas / apps ·
// estado activa/inactiva
// ============================================================
const { buildMonthGrid, initialsOf, MONTHS } = window.TY;

const MINI_DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ---- Mini-calendario de mes ----
const MiniCalendar = {
  name: 'MiniCalendar',
  props: ['year', 'month', 'selectedIso', 'todayIso'],
  emits: ['prev', 'next', 'pick'],
  data() { return { MINI_DOW }; },
  computed: {
    label() { return MONTHS[this.month].charAt(0).toUpperCase() + MONTHS[this.month].slice(1) + ' ' + this.year; },
    cells() { return buildMonthGrid(this.year, this.month); },
  },
  methods: {
    cls(cell) {
      return ['mini__day',
        !cell.inMonth && 'mini__day--out',
        cell.iso === this.todayIso && 'mini__day--today',
        cell.iso === this.selectedIso && cell.iso !== this.todayIso && 'mini__day--sel'].filter(Boolean);
    },
  },
  template: `
    <div class="mini">
      <div class="mini__head">
        <span class="mini__label">{{ label }}</span>
        <div class="mini__nav">
          <button class="mini__arrow" @click="$emit('prev')"><i class="bx bx-chevron-left"></i></button>
          <button class="mini__arrow" @click="$emit('next')"><i class="bx bx-chevron-right"></i></button>
        </div>
      </div>
      <div class="mini__grid mini__grid--dow">
        <span v-for="(d, i) in MINI_DOW" :key="i" class="mini__dow">{{ d }}</span>
      </div>
      <div class="mini__grid">
        <button v-for="cell in cells" :key="cell.iso" :class="cls(cell)" @click="$emit('pick', cell)">{{ cell.day }}</button>
      </div>
    </div>
  `,
};

// ---- Barra lateral ----
const CalSidebar = {
  name: 'CalSidebar',
  components: { MiniCalendar },
  props: [
    'specialists', 'apps', 'enabledSpecs', 'enabledApps',
    'showActive', 'showInactive',
    'miniYear', 'miniMonth', 'selectedIso', 'todayIso', 'counts',
  ],
  emits: [
    'create', 'toggle-spec', 'toggle-app', 'all-specs', 'all-apps',
    'toggle-active', 'toggle-inactive', 'mini-prev', 'mini-next', 'pick-day',
  ],
  data() { return { specsOpen: true, appsOpen: true }; },
  methods: {
    initialsOf,
    specOn(id) { return this.enabledSpecs.includes(id); },
    appOn(id) { return this.enabledApps.includes(id); },
    allSpecsOn() { return this.enabledSpecs.length === this.specialists.length; },
    allAppsOn() { return this.enabledApps.length === this.apps.length; },
    cnt(id) { return this.counts ? (this.counts[id] || 0) : 0; },
  },
  template: `
    <aside class="cside">
      <button class="cside__create" @click="$emit('create')">
        <i class="bx bx-plus"></i><span>Crear ventana</span>
      </button>

      <mini-calendar :year="miniYear" :month="miniMonth" :selected-iso="selectedIso" :today-iso="todayIso"
        @prev="$emit('mini-prev')" @next="$emit('mini-next')" @pick="$emit('pick-day', $event)" />

      <!-- Especialistas -->
      <div class="cside__section">
        <button class="cside__title" @click="specsOpen = !specsOpen">
          <span>Especialistas</span>
          <i :class="['bx', specsOpen ? 'bx-chevron-up' : 'bx-chevron-down']"></i>
        </button>
        <div v-show="specsOpen" class="cside__list">
          <label class="cfilter cfilter--all">
            <input type="checkbox" :checked="allSpecsOn()" @change="$emit('all-specs')" />
            <span class="cfilter__box cfilter__box--neutral"><i class="bx bx-check"></i></span>
            <span class="cfilter__name">Todos</span>
          </label>
          <label v-for="s in specialists" :key="s.id" class="cfilter" :style="{ '--c': s.color }">
            <input type="checkbox" :checked="specOn(s.id)" @change="$emit('toggle-spec', s.id)" />
            <span class="cfilter__box"><i class="bx bx-check"></i></span>
            <span class="cfilter__avatar">{{ initialsOf(s.fullName) }}</span>
            <span class="cfilter__name">{{ s.fullName }}</span>
          </label>
        </div>
      </div>

      <!-- Aplicaciones -->
      <div class="cside__section">
        <button class="cside__title" @click="appsOpen = !appsOpen">
          <span>Aplicaciones</span>
          <i :class="['bx', appsOpen ? 'bx-chevron-up' : 'bx-chevron-down']"></i>
        </button>
        <div v-show="appsOpen" class="cside__list">
          <label class="cfilter cfilter--all">
            <input type="checkbox" :checked="allAppsOn()" @change="$emit('all-apps')" />
            <span class="cfilter__box cfilter__box--neutral"><i class="bx bx-check"></i></span>
            <span class="cfilter__name">Todas</span>
          </label>
          <label v-for="a in apps" :key="a.id" class="cfilter" :style="{ '--c': a.color }">
            <input type="checkbox" :checked="appOn(a.id)" @change="$emit('toggle-app', a.id)" />
            <span class="cfilter__box"><i class="bx bx-check"></i></span>
            <span class="cfilter__name">{{ a.name }}</span>
          </label>
        </div>
      </div>

      <!-- Estado -->
      <div class="cside__section">
        <div class="cside__title cside__title--static"><span>Estado</span></div>
        <div class="cside__list">
          <label class="cfilter" style="--c: var(--primary)">
            <input type="checkbox" :checked="showActive" @change="$emit('toggle-active')" />
            <span class="cfilter__box"><i class="bx bx-check"></i></span>
            <span class="cfilter__name">Activas</span>
          </label>
          <label class="cfilter cfilter--striped">
            <input type="checkbox" :checked="showInactive" @change="$emit('toggle-inactive')" />
            <span class="cfilter__box cfilter__box--neutral"><i class="bx bx-check"></i></span>
            <span class="cfilter__swatch cfilter__swatch--striped"></span>
            <span class="cfilter__name">Inactivas</span>
          </label>
        </div>
      </div>
    </aside>
  `,
};

Object.assign(window.TY, { MiniCalendar, CalSidebar });
})();
