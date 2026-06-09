;(function(){
// ============================================================
// TyFlow Casos — App raíz, navegación, reasignación y Tweaks
// ============================================================
const T = window.TYC;
const V = window.TYC_V;
const C = window.TYC_C;
const { SPECIALISTS, CASES, loadOf, activeCasesOf, specById, LOAD_COLOR } = T;
const { ListaView, EspecialistasView, CargasView } = V;

const DEFAULTS = window.TYC_TWEAKS || {};
const ACCENTS = {
  '#2AC78F': ['#2AC78F', '#249F75'],
  '#4F8DF7': ['#4F8DF7', '#3B74D6'],
  '#9B6DF3': ['#9B6DF3', '#7E4FD8'],
  '#E0675F': ['#E0675F', '#C84A42'],
};

// ---- Reassign modal ----
const ReassignModal = {
  name: 'ReassignModal',
  components: { ...C },
  props: { ids: Array, thresholds: Object },
  emits: ['close', 'confirm'],
  data() { return { sel: null, SPECIALISTS }; },
  computed: {
    rows() {
      return SPECIALISTS.map(s => ({ s, load: loadOf(s, this.thresholds), active: activeCasesOf(s.id).length }))
        .sort((a, b) => a.load.ratio - b.load.ratio);
    },
  },
  methods: {
    loadColor(l) { return LOAD_COLOR[l.level]; },
    loadPct(l) { return Math.min(100, Math.round(l.ratio * 100)); },
  },
  template: `
    <div class="modal-backdrop" @click="$emit('close')">
      <div class="modal" @click.stop>
        <div class="modal__head">
          <div>
            <div class="modal__title">Reasignar {{ ids.length }} caso(s)</div>
            <div class="modal__sub">Elige el especialista destino · ordenados por menor carga</div>
          </div>
          <button class="modal__x" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal__body">
          <div v-for="x in rows" :key="x.s.id"
            :class="['spec-option', sel===x.s.id && 'spec-option--sel']" @click="sel=x.s.id">
            <avatar :spec="x.s" :size="34" />
            <div style="min-width:0;flex:1">
              <div class="spec-option__name">{{ x.s.fullName }}</div>
              <div class="spec-option__meta">
                <span :style="{ color: x.s.turno ? 'var(--primary)' : 'var(--faint)' }">
                  <i :class="['bx', x.s.turno ? 'bxs-circle' : 'bx-block']" style="font-size:0.5rem;vertical-align:1px"></i>
                  {{ x.s.turno ? 'Con turno' : 'Sin turno' }}
                </span>
                <span>· {{ x.s.role }}</span>
              </div>
            </div>
            <div class="spec-option__load">
              <div class="spec-option__loadn" :style="{ color: loadColor(x.load) }">{{ x.active }}/{{ x.s.capacity }}</div>
              <div class="spec-option__loadbar"><div :style="{ width: loadPct(x.load)+'%', background: loadColor(x.load) }"></div></div>
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="mbtn" @click="$emit('close')">Cancelar</button>
          <button class="mbtn mbtn--primary" :disabled="!sel" :style="{ opacity: sel ? 1 : 0.5 }" @click="$emit('confirm', sel)">Reasignar</button>
        </div>
      </div>
    </div>
  `,
};

// ---- Tweaks panel (Vue-native) ----
const TweaksPanel = {
  name: 'TweaksPanel',
  props: { state: Object },
  emits: ['set', 'close'],
  data() { return { accents: Object.keys(ACCENTS) }; },
  template: `
    <div style="position:fixed;top:16px;right:16px;z-index:400;width:280px;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;font-size:0.82rem">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-bottom:1px solid var(--border-soft)">
        <div style="font-weight:700;display:flex;align-items:center;gap:0.4rem"><i class="bx bx-slider-alt" style="color:var(--primary)"></i>Tweaks</div>
        <button class="modal__x" style="font-size:1.3rem" @click="$emit('close')">&times;</button>
      </div>
      <div style="padding:1rem;display:flex;flex-direction:column;gap:1.15rem">
        <div>
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--faint);margin-bottom:0.5rem">Color de acento</div>
          <div style="display:flex;gap:0.5rem">
            <button v-for="a in accents" :key="a" @click="$emit('set',{accent:a})"
              :style="{ width:'34px',height:'34px',borderRadius:'9px',background:a,cursor:'pointer',border: state.accent===a ? '2px solid var(--text)' : '2px solid transparent', outline: state.accent===a ? '2px solid '+a : 'none', outlineOffset:'1px' }"></button>
          </div>
        </div>
        <div>
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--faint);margin-bottom:0.5rem">Densidad</div>
          <div class="seg" style="width:100%">
            <button v-for="d in ['compact','comfortable','spacious']" :key="d" :class="['seg__btn', state.density===d && 'seg__btn--active']" style="flex:1;justify-content:center;text-transform:capitalize" @click="$emit('set',{density:d})">{{ d==='compact'?'Compacta':d==='comfortable'?'Cómoda':'Amplia' }}</button>
          </div>
        </div>
        <div>
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--faint);margin-bottom:0.5rem">Estilo de filas (Lista)</div>
          <div class="seg" style="width:100%">
            <button v-for="r in ['zebra','lines']" :key="r" :class="['seg__btn', state.rowStyle===r && 'seg__btn--active']" style="flex:1;justify-content:center" @click="$emit('set',{rowStyle:r})">{{ r==='zebra'?'Cebra':'Líneas' }}</button>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--faint);margin-bottom:0.5rem">
            <span>Umbral SLA (espera)</span><span style="color:var(--primary)">{{ Math.round(state.slaHours/24*10)/10 }}d</span>
          </div>
          <input type="range" min="48" max="336" step="12" :value="state.slaHours" @input="$emit('set',{slaHours: +$event.target.value})" style="width:100%;accent-color:var(--primary)" />
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--faint);margin-bottom:0.5rem">
            <span>Sensibilidad de carga</span><span style="color:var(--primary)">{{ Math.round(state.loadHigh*100) }}%</span>
          </div>
          <input type="range" min="0.6" max="1" step="0.05" :value="state.loadHigh" @input="$emit('set',{loadHigh: +$event.target.value})" style="width:100%;accent-color:var(--primary)" />
          <div style="font-size:0.66rem;color:var(--faint);margin-top:0.3rem">Umbral de "saturado"</div>
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
  components: { ListaView, EspecialistasView, CargasView, ReassignModal, TweaksPanel },
  data() {
    return {
      theme: DEFAULTS.theme || 'light',
      tab: 'lista',
      cases: CASES,
      reassignIds: null,
      focusSpec: null,
      toast: null, _toastT: null,
      editMode: false,
      tw: {
        accent: DEFAULTS.accent || '#2AC78F',
        density: DEFAULTS.density || 'comfortable',
        rowStyle: DEFAULTS.rowStyle || 'zebra',
        slaHours: DEFAULTS.slaHours || 168,
        loadHigh: DEFAULTS.loadHigh || 0.8,
      },
    };
  },
  computed: {
    caseCount() { return this.cases.length; },
    thresholds() { return { mid: this.tw.loadHigh * 0.6, high: this.tw.loadHigh }; },
  },
  watch: {
    theme(v) { document.documentElement.dataset.theme = v; },
    'tw.density'(v) { document.documentElement.dataset.density = v; },
    'tw.rowStyle'(v) { document.documentElement.dataset.rowstyle = v; },
    'tw.accent'(v) { this.applyAccent(v); },
  },
  methods: {
    applyAccent(a) {
      const [p, p6] = ACCENTS[a] || ACCENTS['#2AC78F'];
      document.documentElement.style.setProperty('--primary', p);
      document.documentElement.style.setProperty('--primary-600', p6);
    },
    showToast(msg) { this.toast = msg; clearTimeout(this._toastT); this._toastT = setTimeout(() => this.toast = null, 2200); },
    toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; },
    goCargas(specId) { this.focusSpec = specId; this.tab = 'cargas'; },
    openReassign(ids) { this.reassignIds = ids; },
    confirmReassign(specId) {
      const set = new Set(this.reassignIds);
      let n = 0;
      this.cases.forEach(c => { if (set.has(c.id)) { c.specialistId = specId; if (c.statusId === 'abierto') c.statusId = 'asignado'; n++; } });
      const name = specById(specId).fullName;
      this.reassignIds = null;
      this.showToast(n ? `${n} caso(s) reasignados a ${name}.` : `Asignación: ${name}.`);
    },
    setTweak(edits) {
      Object.assign(this.tw, edits);
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    },
  },
  template: `
    <div class="app">
      <div class="topbar">
        <div class="topbar__title">Casos</div>
        <div class="topbar__actions">
          <button class="icon-btn" title="Tema" @click="toggleTheme">
            <i :class="['bx', theme === 'dark' ? 'bx-moon' : 'bx-sun']"></i>
          </button>
          <button class="btn-ghost" @click="showToast('Autopilot: asignación automática activada.')"><i class="bx bx-bot"></i> Autopilot</button>
          <button class="btn-create" @click="showToast('Formulario de nuevo caso.')"><i class="bx bx-plus"></i> Nuevo caso</button>
        </div>
      </div>

      <div class="tabs">
        <button :class="['tab', tab==='lista' && 'tab--active']" @click="tab='lista'">
          <i class="bx bx-list-ul"></i> Lista <span class="tab__count">{{ caseCount }}</span>
        </button>
        <button :class="['tab', tab==='especialistas' && 'tab--active']" @click="tab='especialistas'">
          <i class="bx bx-group"></i> Especialistas
        </button>
        <button :class="['tab', tab==='cargas' && 'tab--active']" @click="tab='cargas'">
          <i class="bx bx-bar-chart-alt-2"></i> Cargas
        </button>
      </div>

      <lista-view v-if="tab==='lista'" :thresholds="thresholds" :sla-hours="tw.slaHours"
        @toast="showToast" @reassign-bulk="openReassign" />
      <especialistas-view v-else-if="tab==='especialistas'" :thresholds="thresholds"
        @toast="showToast" @go-cargas="goCargas" @reassign-bulk="openReassign" />
      <cargas-view v-else :thresholds="thresholds" :focus-spec="focusSpec"
        @toast="showToast" @reassign-bulk="openReassign" />

      <reassign-modal v-if="reassignIds" :ids="reassignIds" :thresholds="thresholds"
        @close="reassignIds=null" @confirm="confirmReassign" />

      <tweaks-panel v-if="editMode" :state="tw" @set="setTweak" @close="editMode=false; $root.dismissEdit()" />

      <div v-if="toast" class="toast"><i class="bx bx-check-circle"></i>{{ toast }}</div>
    </div>
  `,
  mounted() {
    document.documentElement.dataset.theme = this.theme;
    document.documentElement.dataset.density = this.tw.density;
    document.documentElement.dataset.rowstyle = this.tw.rowStyle;
    this.applyAccent(this.tw.accent);
  },
};

const app = Vue.createApp(App);
const vm = app.mount('#root');

// ---- Tweaks host protocol ----
vm.dismissEdit = () => window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
window.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === '__activate_edit_mode') vm.editMode = true;
  else if (t === '__deactivate_edit_mode') vm.editMode = false;
});
window.parent.postMessage({ type: '__edit_mode_available' }, '*');
})();
