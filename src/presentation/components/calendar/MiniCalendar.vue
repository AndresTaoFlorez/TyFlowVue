<script setup>
import { computed } from 'vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },        // 0-11
  selectedIsos: { type: Array, default: () => [] },
  todayIso: { type: String, default: '' },
})

const emit = defineEmits(['prev', 'next', 'pick'])

const MINI_DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const label = computed(() => `${MESES[props.month]} ${props.year}`)

// Grid de 42 celdas, semana empieza en lunes
const cells = computed(() => {
  const first = new Date(props.year, props.month, 1)
  const day = first.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  const start = new Date(first)
  start.setDate(first.getDate() + toMonday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      iso: fmtDateISO(d),
      day: d.getDate(),
      inMonth: d.getMonth() === props.month,
    }
  })
})

const selectedSet = computed(() => new Set(props.selectedIsos))

function cls(cell) {
  return {
    'mini__day--out': !cell.inMonth,
    'mini__day--today': cell.iso === props.todayIso,
    'mini__day--sel': selectedSet.value.has(cell.iso) && cell.iso !== props.todayIso,
  }
}
</script>

<template>
  <div class="mini">
    <div class="mini__head">
      <span class="mini__label">{{ label }}</span>
      <div class="mini__nav">
        <button class="mini__arrow" @click="emit('prev')" aria-label="Mes anterior"><i class="bx bx-chevron-left"></i></button>
        <button class="mini__arrow" @click="emit('next')" aria-label="Mes siguiente"><i class="bx bx-chevron-right"></i></button>
      </div>
    </div>
    <div class="mini__grid mini__grid--dow">
      <span v-for="(d, i) in MINI_DOW" :key="i" class="mini__dow">{{ d }}</span>
    </div>
    <div class="mini__grid">
      <button v-for="cell in cells" :key="cell.iso" class="mini__day" :class="cls(cell)" @click="emit('pick', cell.iso)">
        {{ cell.day }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Vive sobre el navrail: tonos --nav-* (theme-aware), no --text/--surface */
.mini__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding: 0 0.15rem;
}

.mini__label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--nav-text-strong);
}

.mini__nav { display: flex; gap: 0.1rem; }

.mini__arrow {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 7px;
  color: var(--nav-text);
  cursor: pointer;
  font-size: 1rem;
  transition: background .12s, color .12s;
}

.mini__arrow:hover { background: var(--nav-hover); color: var(--nav-text-strong); }

.mini__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.mini__grid--dow { margin-bottom: 2px; }

.mini__dow {
  text-align: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--nav-text);
  opacity: 0.7;
  padding: 2px 0;
}

.mini__day {
  aspect-ratio: 1;
  border: none;
  background: none;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--nav-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, color .12s;
}

.mini__day:hover { background: var(--nav-hover); color: var(--nav-text-strong); }
.mini__day--out { opacity: 0.45; }
.mini__day--today { background: var(--primary-500); color: #fff; font-weight: 800; }
.mini__day--today:hover { background: var(--primary-600); color: #fff; }
.mini__day--sel {
  background: color-mix(in srgb, var(--primary-500) 22%, transparent);
  color: var(--primary-500);
  font-weight: 800;
}
</style>
