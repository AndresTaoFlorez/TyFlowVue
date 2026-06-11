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
    'create', 'bulk', 'toggle-spec', 'toggle-app', 'all-specs', 'all-apps',
    'toggle-active', 'toggle-inactive', 'mini-prev', 'mini-next', 'pick-day',
  ],
  data() { return { specsOpen: true, appsOpen: true, searchOpen: false, query: '', appSearchOpen: false, appQuery: '', createMenu: false }; },
  computed: {
    filteredSpecs() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.specialists;
      return this.specialists.filter(s => s.fullName.toLowerCase().includes(q));
    },
    filteredApps() {
      const q = this.appQuery.trim().toLowerCase();
      if (!q) return this.apps;
      return this.apps.filter(a => a.name.toLowerCase().includes(q));
    },
  },
  methods: {
    initialsOf,
    specOn(id) { return this.enabledSpecs.includes(id); },
    appOn(id) { return this.enabledApps.includes(id); },
    allSpecsOn() { return this.enabledSpecs.length === this.specialists.length; },
    allAppsOn() { return this.enabledApps.length === this.apps.length; },
    cnt(id) { return this.counts ? (this.counts[id] || 0) : 0; },
    toggleSearch() {
      this.searchOpen = !this.searchOpen;
      if (this.searchOpen) { this.specsOpen = true; this.$nextTick(() => this.$refs.specSearch && this.$refs.specSearch.focus()); }
      else this.query = '';
    },
    toggleAppSearch() {
      this.appSearchOpen = !this.appSearchOpen;
      if (this.appSearchOpen) { this.appsOpen = true; this.$nextTick(() => this.$refs.appSearch && this.$refs.appSearch.focus()); }
      else this.appQuery = '';
    },
    chooseCreate() { this.createMenu = false; this.$emit('create'); },
    chooseBulk() { this.createMenu = false; this.$emit('bulk'); },
    onDocClick(e) { if (this.$refs.createWrap && !this.$refs.createWrap.contains(e.target)) this.createMenu = false; },
  },
  mounted() { document.addEventListener('click', this.onDocClick); },
  beforeUnmount() { document.removeEventListener('click', this.onDocClick); },
  template: `
    <aside class="cside">
      <div class="cside__create-wrap" ref="createWrap">
        <button :class="['cside__create', createMenu && 'cside__create--open']" @click.stop="createMenu = !createMenu">
          <i class="bx bx-plus"></i><span>Crear</span>
          <i class="bx bx-chevron-down cside__create-caret"></i>
        </button>
        <div v-if="createMenu" class="cside__menu">
          <button class="cside__menu-item" @click="chooseCreate">
            <i class="bx bx-calendar-plus"></i>
            <span class="cside__menu-txt"><b>Ventana individual</b><small>Un especialista</small></span>
          </button>
          <button class="cside__menu-item" @click="chooseBulk">
            <i class="bx bx-layer-plus"></i>
            <span class="cside__menu-txt"><b>Asignación masiva</b><small>Varios especialistas a la vez</small></span>
          </button>
        </div>
      </div>

      <mini-calendar :year="miniYear" :month="miniMonth" :selected-iso="selectedIso" :today-iso="todayIso"
        @prev="$emit('mini-prev')" @next="$emit('mini-next')" @pick="$emit('pick-day', $event)" />

      <!-- Especialistas -->
      <div class="cside__section">
        <div class="cside__title-row">
          <button class="cside__title" @click="specsOpen = !specsOpen">
            <span>Especialistas</span>
            <i :class="['bx', specsOpen ? 'bx-chevron-up' : 'bx-chevron-down']"></i>
          </button>
          <button :class="['cside__tool', searchOpen && 'cside__tool--on']" @click="toggleSearch" title="Buscar especialista">
            <i class="bx bx-search"></i>
          </button>
        </div>
        <div v-show="specsOpen">
          <div v-show="searchOpen" class="cside__search">
            <i class="bx bx-search"></i>
            <input ref="specSearch" v-model="query" type="text" placeholder="Buscar…" />
            <button v-if="query" class="cside__search-x" @click="query = ''"><i class="bx bx-x"></i></button>
          </div>
          <div class="cside__listhead">
            <span>{{ enabledSpecs.length }}/{{ specialists.length }} activos</span>
            <button class="cside__alllink" @click="$emit('all-specs')">{{ allSpecsOn() ? 'Ninguno' : 'Todos' }}</button>
          </div>
          <div class="cside__list">
            <button v-for="s in filteredSpecs" :key="s.id"
              :class="['specrow', specOn(s.id) && 'specrow--on']" :style="{ '--c': s.color }"
              @click="$emit('toggle-spec', s.id)">
              <span class="specrow__av">{{ initialsOf(s.fullName) }}</span>
              <span class="specrow__name">{{ s.fullName }}</span>
              <i class="bx bx-check specrow__check"></i>
            </button>
            <div v-if="!filteredSpecs.length" class="cside__empty">Sin resultados</div>
          </div>
        </div>
      </div>

      <!-- Aplicaciones -->
      <div class="cside__section">
        <div class="cside__title-row">
          <button class="cside__title" @click="appsOpen = !appsOpen">
            <span>Aplicaciones</span>
            <i :class="['bx', appsOpen ? 'bx-chevron-up' : 'bx-chevron-down']"></i>
          </button>
          <button :class="['cside__tool', appSearchOpen && 'cside__tool--on']" @click="toggleAppSearch" title="Buscar aplicación">
            <i class="bx bx-search"></i>
          </button>
        </div>
        <div v-show="appsOpen">
          <div v-show="appSearchOpen" class="cside__search">
            <i class="bx bx-search"></i>
            <input ref="appSearch" v-model="appQuery" type="text" placeholder="Buscar…" />
            <button v-if="appQuery" class="cside__search-x" @click="appQuery = ''"><i class="bx bx-x"></i></button>
          </div>
          <div class="cside__listhead">
            <span>{{ enabledApps.length }}/{{ apps.length }} activas</span>
            <button class="cside__alllink" @click="$emit('all-apps')">{{ allAppsOn() ? 'Ninguna' : 'Todas' }}</button>
          </div>
          <div class="cside__list">
            <button v-for="a in filteredApps" :key="a.id"
              :class="['specrow', appOn(a.id) && 'specrow--on']" :style="{ '--c': a.color }"
              @click="$emit('toggle-app', a.id)">
              <span class="specrow__swatch"></span>
              <span class="specrow__name">{{ a.name }}</span>
              <i class="bx bx-check specrow__check"></i>
            </button>
            <div v-if="!filteredApps.length" class="cside__empty">Sin resultados</div>
          </div>
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
