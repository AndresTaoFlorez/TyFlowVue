<script setup>
import { ref } from 'vue'
import NodeGraphCanvas from '@/presentation/components/NodeGraphCanvas.vue'

const activeStep = ref(null)

const steps = [
  {
    number: 1,
    label: 'Lectura de correos',
    icon: 'bx-envelope',
    description:
      'El sistema se conectara a un RPA mediante API REST para consumir automaticamente los correos electronicos entrantes. El RPA leera el buzon institucional, filtrara los mensajes relevantes y entregara las solicitudes listas para su procesamiento.',
  },
  {
    number: 2,
    label: 'Asignacion a especialistas',
    icon: 'bx-user-check',
    description:
      'Usando el algoritmo WDD (Weighted Dynamic Distribution), el caso se asignara automaticamente al especialista mas adecuado segun su area, nivel de soporte, carga actual y disponibilidad en su ventana de trabajo.',
  },
  {
    number: 3,
    label: 'Gestion de casos',
    icon: 'bx-briefcase',
    description:
      'Los especialistas podran visualizar, gestionar y dar seguimiento a los casos asignados. El sistema registrara el estado de cada caso, los tiempos de respuesta y permitira la reasignacion cuando sea necesario.',
  },
]

function toggleStep(index) {
  activeStep.value = activeStep.value === index ? null : index
}
</script>

<template>
  <section class="content">
    <div class="coming-soon">
      <NodeGraphCanvas />
      <div class="coming-soon__body">
        <div class="coming-soon__icon-wrap">
          <i class='bx bx-envelope coming-soon__icon'></i>
          <i class='bx bx-user-check coming-soon__icon coming-soon__icon--secondary'></i>
          <i class='bx bx-briefcase coming-soon__icon'></i>
        </div>
        <h2 class="coming-soon__title">
          <span class="coming-soon__letter" style="--i:0">P</span><span class="coming-soon__letter" style="--i:1">r</span><span class="coming-soon__letter" style="--i:2">o</span><span class="coming-soon__letter" style="--i:3">x</span><span class="coming-soon__letter" style="--i:4">i</span><span class="coming-soon__letter" style="--i:5">m</span><span class="coming-soon__letter" style="--i:6">a</span><span class="coming-soon__letter" style="--i:7">m</span><span class="coming-soon__letter" style="--i:8">e</span><span class="coming-soon__letter" style="--i:9">n</span><span class="coming-soon__letter" style="--i:10">t</span><span class="coming-soon__letter" style="--i:11">e</span>
        </h2>
        <p class="coming-soon__subtitle">Asignacion automatica de casos</p>
        <div class="coming-soon__info">
          <Transition name="swap" mode="out-in">
            <p v-if="activeStep === null" key="default" class="coming-soon__description">
              Se implementara una integracion con un RPA via API REST que consumira
              los correos electronicos entrantes, asignara los casos automaticamente
              a los especialistas y permitira su gestion y seguimiento completo.
            </p>
            <div v-else class="coming-soon__detail" :key="activeStep">
              <i :class="['bx', steps[activeStep].icon, 'coming-soon__detail-icon']"></i>
              <p class="coming-soon__detail-text">{{ steps[activeStep].description }}</p>
            </div>
          </Transition>
        </div>
        <div class="coming-soon__steps">
          <template v-for="(step, i) in steps" :key="step.number">
            <div v-if="i > 0" class="coming-soon__step-arrow">
              <i class='bx bx-right-arrow-alt'></i>
            </div>
            <button
              class="coming-soon__step"
              :class="{ 'coming-soon__step--active': activeStep === i }"
              @click="toggleStep(i)"
            >
              <div class="coming-soon__step-number">{{ step.number }}</div>
              <span>{{ step.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.coming-soon {
  position: relative;
  flex: 1;
  min-height: 420px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coming-soon__body {
  position: relative;
  z-index: 1;
  text-align: center;
  color: var(--neutral-800, #1e293b);
  padding: 3rem 2rem;
  max-width: 600px;
  animation: fadeUp 0.8s ease-out both;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  border-radius: var(--radius-lg);
}

.coming-soon__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 2.5rem;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 0.3s;
}

.coming-soon__icon {
  opacity: 0.9;
  animation: iconFloat 3s ease-in-out infinite;
}

.coming-soon__icon--secondary {
  font-size: 1.5rem;
  opacity: 0.6;
  animation-delay: 0.5s;
}

.coming-soon__title {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.coming-soon__letter {
  display: inline-block;
  opacity: 0;
  animation:
    letterDrop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards calc(0.4s + var(--i) * 0.07s),
    letterGlow 4s ease-in-out infinite calc(1.5s + var(--i) * 0.12s);
  will-change: auto;
}

.coming-soon__subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.4s;
  margin-bottom: 1rem;
}

.coming-soon__info {
  min-height: 5.5rem;
  margin-bottom: 2rem;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.7s;
}

.coming-soon__description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--neutral-600, #475569);
  margin: 0;
}

.coming-soon__steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 2s;
}

.coming-soon__step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(42, 199, 143, 0.1);
  backdrop-filter: blur(3px);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  color: inherit;
}

.coming-soon__step:hover {
  background: rgba(42, 199, 143, 0.18);
  transform: translateY(-2px);
}

.coming-soon__step--active {
  background: rgba(42, 199, 143, 0.22);
  border-color: rgba(42, 199, 143, 0.5);
  box-shadow: 0 0 12px rgba(42, 199, 143, 0.15);
}

.coming-soon__step-number {
  width: 1.5rem;
  height: 1.5rem;
  background: rgba(42, 199, 143, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.25s ease;
}

.coming-soon__step--active .coming-soon__step-number {
  background: rgba(42, 199, 143, 0.45);
}

.coming-soon__step-arrow {
  font-size: 1.2rem;
  opacity: 0.6;
}

/* Detail panel */
.coming-soon__detail {
  padding: 1rem 1.25rem;
  background: rgba(42, 199, 143, 0.07);
  border: 1px solid rgba(42, 199, 143, 0.2);
  border-radius: var(--radius-md);
  text-align: left;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.coming-soon__detail-icon {
  font-size: 1.6rem;
  color: rgba(42, 199, 143, 0.8);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.coming-soon__detail-text {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--neutral-700, #334155);
  margin: 0;
}

/* Swap transition (out-in) */
.swap-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.swap-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes letterDrop {
  0% { opacity: 0; transform: translateY(-30px) scale(0.5) rotate(-8deg); filter: blur(4px); }
  70% { transform: translateY(3px) scale(1.05) rotate(1deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); filter: blur(0); }
}

@keyframes letterGlow {
  0%, 100% { text-shadow: 0 0 0 transparent; }
  50% { text-shadow: 0 0 18px rgba(42, 199, 143, 0.4); }
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@media (max-width: 768px) {
  .coming-soon__body {
    padding: 2rem 1.25rem;
  }

  .coming-soon__title {
    font-size: 1.6rem;
  }

  .coming-soon__steps {
    flex-direction: column;
    gap: 0.5rem;
  }

  .coming-soon__step-arrow {
    transform: rotate(90deg);
  }

  .coming-soon__icon-wrap {
    font-size: 2rem;
  }
}
</style>
