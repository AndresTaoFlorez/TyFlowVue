<script setup>
import '@/presentation/styles/calendar/MiniCalendar.css'
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
