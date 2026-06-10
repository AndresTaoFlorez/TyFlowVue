<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeGraphCanvas from '@/presentation/components/shared/NodeGraphCanvas.vue'

const router = useRouter()
const activeFeature = ref(null)

const titleLetters = 'Bienvenido'.split('')

const features = [
  {
    label: 'Asignacion a especialistas',
    icon: 'bx-user-check',
    description:
      'Usando el algoritmo WDD (Weighted Dynamic Distribution), cada caso se asigna automaticamente al especialista mas adecuado segun su area, nivel de soporte, carga actual y disponibilidad en su ventana de trabajo.',
    route: { name: 'cases-specialists' },
  },
  {
    label: 'Gestion de casos',
    icon: 'bx-briefcase',
    description:
      'Visualiza, gestiona y da seguimiento a los casos asignados. El sistema registra el estado de cada caso, los tiempos de respuesta y permite la reasignacion cuando sea necesario.',
    route: { name: 'cases-list', params: { status: 'open' } },
  },
]

function toggleFeature(index) {
  activeFeature.value = activeFeature.value === index ? null : index
}

function goToFeature(feature) {
  router.push(feature.route)
}
</script>

<template>
  <section class="content">
    <div class="hero">
      <NodeGraphCanvas />
      <div class="hero__body">
        <div class="hero__icon-wrap">
          <i class='bx bx-user-check hero__icon'></i>
          <i class='bx bx-briefcase hero__icon hero__icon--secondary'></i>
        </div>
        <h2 class="hero__title">
          <span
            v-for="(letter, i) in titleLetters"
            :key="i"
            class="hero__letter"
            :style="{ '--i': i }"
          >{{ letter }}</span>
        </h2>
        <p class="hero__subtitle">Gestion inteligente de casos</p>
        <div class="hero__info">
          <Transition name="swap" mode="out-in">
            <p v-if="activeFeature === null" key="default" class="hero__description">
              TyFlow asigna automaticamente cada caso al especialista mas adecuado y
              te permite gestionar y dar seguimiento a todo el flujo de trabajo, con
              control de estados, tiempos de respuesta y reasignaciones.
            </p>
            <div v-else class="hero__detail" :key="activeFeature">
              <i :class="['bx', features[activeFeature].icon, 'hero__detail-icon']"></i>
              <p class="hero__detail-text">{{ features[activeFeature].description }}</p>
            </div>
          </Transition>
        </div>
        <div class="hero__features">
          <button
            v-for="(feature, i) in features"
            :key="feature.label"
            class="hero__feature"
            :class="{ 'hero__feature--active': activeFeature === i }"
            @mouseenter="activeFeature = i"
            @mouseleave="activeFeature = null"
            @click="goToFeature(feature)"
          >
            <div class="hero__feature-icon">
              <i :class="['bx', feature.icon]"></i>
            </div>
            <div class="hero__feature-text">
              <span class="hero__feature-label">{{ feature.label }}</span>
              <span class="hero__feature-status">
                <i class='bx bxs-circle'></i> Disponible
              </span>
            </div>
            <i class='bx bx-right-arrow-alt hero__feature-go'></i>
          </button>
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

.hero {
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

.hero__body {
  position: relative;
  z-index: 1;
  text-align: center;
  color: var(--text-primary);
  padding: 3rem 2rem;
  max-width: 640px;
  animation: fadeUp 0.8s ease-out both;
  background: color-mix(in srgb, var(--bg-main) 45%, transparent);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: var(--radius-lg);
}

.hero__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 2.5rem;
  color: var(--primary-500);
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 0.3s;
}

.hero__icon {
  opacity: 0.95;
  animation: iconFloat 3s ease-in-out infinite;
}

.hero__icon--secondary {
  font-size: 1.5rem;
  opacity: 0.65;
  animation-delay: 0.5s;
}

.hero__title {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.hero__letter {
  display: inline-block;
  opacity: 0;
  animation:
    letterDrop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards calc(0.4s + var(--i) * 0.07s),
    letterGlow 4s ease-in-out infinite calc(1.5s + var(--i) * 0.12s);
  will-change: auto;
}

.hero__subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary-600);
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.4s;
  margin-bottom: 1rem;
}

.hero__info {
  min-height: 5.5rem;
  margin-bottom: 2rem;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.7s;
}

.hero__description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0;
}

.hero__features {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0.85rem;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 2s;
}

.hero__feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  max-width: 290px;
  text-align: left;
  background: color-mix(in srgb, var(--primary-500) 10%, transparent);
  backdrop-filter: blur(3px);
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  border: 1.5px solid color-mix(in srgb, var(--primary-500) 18%, transparent);
  cursor: pointer;
  transition: all 0.25s ease;
  color: var(--text-primary);
}

.hero__feature:hover,
.hero__feature--active {
  background: color-mix(in srgb, var(--primary-500) 20%, transparent);
  border-color: color-mix(in srgb, var(--primary-500) 50%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-500) 18%, transparent);
}

.hero__feature-icon {
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--primary-500) 22%, transparent);
  color: var(--primary-600);
  font-size: 1.25rem;
}

.hero__feature-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.hero__feature-label {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
}

.hero__feature-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-600);
}

.hero__feature-status i {
  font-size: 0.5rem;
}

.hero__feature-go {
  font-size: 1.3rem;
  color: var(--primary-600);
  flex-shrink: 0;
  opacity: 0.5;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.hero__feature:hover .hero__feature-go,
.hero__feature--active .hero__feature-go {
  opacity: 1;
  transform: translateX(3px);
}

/* Detail panel */
.hero__detail {
  padding: 1rem 1.25rem;
  background: color-mix(in srgb, var(--primary-500) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary-500) 20%, transparent);
  border-radius: var(--radius-md);
  text-align: left;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.hero__detail-icon {
  font-size: 1.6rem;
  color: var(--primary-600);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.hero__detail-text {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--text-secondary);
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
  50% { text-shadow: 0 0 18px color-mix(in srgb, var(--primary-500) 40%, transparent); }
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@media (max-width: 768px) {
  .hero__body {
    padding: 2rem 1.25rem;
  }

  .hero__title {
    font-size: 1.6rem;
  }

  .hero__features {
    flex-direction: column;
  }

  .hero__feature {
    max-width: none;
  }

  .hero__icon-wrap {
    font-size: 2rem;
  }
}
</style>
