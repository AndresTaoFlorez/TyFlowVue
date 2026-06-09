<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { startNodeGraph } from '@/presentation/utils/nodeGraph'

const canvas = ref(null)
let cleanup = null

onMounted(() => {
  if (canvas.value) {
    cleanup = startNodeGraph(canvas.value, {
      nodeCount: 14,
      connectDist: 160,
      speed: 0.4,
      minRadius: 2.5,
      maxRadius: 5,
    })
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<template>
  <div class="login-card__banner">
    <canvas ref="canvas" class="banner-canvas"></canvas>
    <div class="banner-content">
      <h3>
        <span class="banner-letter" style="--i:0">T</span><span class="banner-letter" style="--i:1">Y</span><span class="banner-letter" style="--i:2">F</span><span class="banner-letter" style="--i:3">L</span><span class="banner-letter" style="--i:4">O</span><span class="banner-letter" style="--i:5">W</span>
      </h3>
      <p>Soporte, gestion y optimizacion de reparto</p>
    </div>
  </div>
</template>

<style scoped>
.login-card__banner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(160deg, #1a9e6f 0%, #2AC78F 40%, #3EE0A1 100%);
  background-size: 200% 200%;
  animation: gradientShift 14s ease-in-out infinite;
  padding: 60px;
  color: white;
  text-align: center;
  overflow: hidden;
}

.banner-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Contenido */
.banner-content {
  position: relative;
  z-index: 1;
  animation: fadeUp 0.8s ease-out both;
}

.banner-content h3 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  letter-spacing: 0.15em;
}

.banner-letter {
  display: inline-block;
  opacity: 0;
  animation:
    letterDrop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards calc(0.3s + var(--i) * 0.1s),
    letterGlow 4s ease-in-out infinite calc(1.2s + var(--i) * 0.15s);
  will-change: transform, opacity;
}

.banner-content p {
  opacity: 0.9;
  animation: fadeUp 0.8s ease-out both 1s;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
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
  50% { text-shadow: 0 0 18px rgba(255, 255, 255, 0.4); }
}

@media (max-width: 768px) {
  .login-card__banner {
    padding: 40px 20px;
    order: 1;
  }

  .banner-content h3 {
    font-size: 2rem;
  }

  .banner-content p {
    font-size: 0.9rem;
  }
}
</style>
