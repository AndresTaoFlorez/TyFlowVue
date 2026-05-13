<script setup>
import NodeGraphCanvas from '@/presentation/components/NodeGraphCanvas.vue'
</script>

<template>
  <section class="content">
    <div class="coming-soon">
      <NodeGraphCanvas />
      <div class="coming-soon__body">
        <div class="coming-soon__icon-wrap">
          <i class='bx bx-envelope coming-soon__icon'></i>
          <i class='bx bx-transfer-alt coming-soon__icon coming-soon__icon--secondary'></i>
          <i class='bx bx-user-check coming-soon__icon'></i>
        </div>
        <h2 class="coming-soon__title">
          <span class="coming-soon__letter" style="--i:0">P</span><span class="coming-soon__letter" style="--i:1">r</span><span class="coming-soon__letter" style="--i:2">o</span><span class="coming-soon__letter" style="--i:3">x</span><span class="coming-soon__letter" style="--i:4">i</span><span class="coming-soon__letter" style="--i:5">m</span><span class="coming-soon__letter" style="--i:6">a</span><span class="coming-soon__letter" style="--i:7">m</span><span class="coming-soon__letter" style="--i:8">e</span><span class="coming-soon__letter" style="--i:9">n</span><span class="coming-soon__letter" style="--i:10">t</span><span class="coming-soon__letter" style="--i:11">e</span>
        </h2>
        <p class="coming-soon__subtitle">Asignacion automatica de casos</p>
        <p class="coming-soon__description">
          Se implementara un RPA que consumira los correos electronicos entrantes
          para extraer las solicitudes y asignar los casos automaticamente a los
          especialistas correspondientes segun su area y disponibilidad.
        </p>
        <div class="coming-soon__steps">
          <div class="coming-soon__step">
            <div class="coming-soon__step-number">1</div>
            <span>Lectura de correos</span>
          </div>
          <div class="coming-soon__step-arrow"><i class='bx bx-right-arrow-alt'></i></div>
          <div class="coming-soon__step">
            <div class="coming-soon__step-number">2</div>
            <span>Extraccion de datos</span>
          </div>
          <div class="coming-soon__step-arrow"><i class='bx bx-right-arrow-alt'></i></div>
          <div class="coming-soon__step">
            <div class="coming-soon__step-number">3</div>
            <span>Asignacion a especialistas</span>
          </div>
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
  will-change: transform, opacity;
}

.coming-soon__subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.4s;
  margin-bottom: 1rem;
}

.coming-soon__description {
  font-size: 0.9rem;
  line-height: 1.6;
  opacity: 0;
  animation: fadeUp 0.6s ease-out both 1.7s;
  color: var(--neutral-600, #475569);
  margin-bottom: 2rem;
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
}

.coming-soon__step-arrow {
  font-size: 1.2rem;
  opacity: 0.6;
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
