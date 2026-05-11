<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref(null)
let animId = null

// Configuracion del grafo
const NODE_COUNT = 14
const CONNECT_DIST = 160
const NODE_SPEED = 0.4
const NODE_MIN_R = 2.5
const NODE_MAX_R = 5

function createNodes(w, h) {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * NODE_SPEED * 2,
    vy: (Math.random() - 0.5) * NODE_SPEED * 2,
    r: NODE_MIN_R + Math.random() * (NODE_MAX_R - NODE_MIN_R),
    pulseOffset: Math.random() * Math.PI * 2,
  }))
}

function startAnimation(canvasEl) {
  const ctx = canvasEl.getContext('2d')
  let w, h, nodes, dpr

  function resize() {
    dpr = window.devicePixelRatio || 1
    const rect = canvasEl.parentElement.getBoundingClientRect()
    const newW = rect.width
    const newH = rect.height
    canvasEl.width = newW * dpr
    canvasEl.height = newH * dpr
    canvasEl.style.width = newW + 'px'
    canvasEl.style.height = newH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (!nodes) {
      w = newW
      h = newH
      nodes = createNodes(w, h)
    } else {
      // Reubicar nodos que quedaron fuera de los nuevos limites
      for (const n of nodes) {
        n.x = Math.min(n.x, newW - 20)
        n.y = Math.min(n.y, newH - 20)
      }
      w = newW
      h = newH
    }
  }

  resize()
  window.addEventListener('resize', resize)

  let time = 0

  function draw() {
    time += 0.016
    ctx.clearRect(0, 0, w, h)

    // Mover nodos
    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy

      // Rebotar suavemente en bordes con margen
      if (n.x < 20 || n.x > w - 20) n.vx *= -1
      if (n.y < 20 || n.y > h - 20) n.vy *= -1

      // Perturbacion sutil tipo respiracion
      n.vx += (Math.random() - 0.5) * 0.02
      n.vy += (Math.random() - 0.5) * 0.02

      // Limitar velocidad
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
      if (speed > NODE_SPEED) {
        n.vx = (n.vx / speed) * NODE_SPEED
        n.vy = (n.vy / speed) * NODE_SPEED
      }
    }

    // Dibujar lineas entre nodos cercanos
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.35
          ctx.beginPath()
          ctx.moveTo(nodes[i].x, nodes[i].y)
          ctx.lineTo(nodes[j].x, nodes[j].y)
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Dibujar nodos
    for (const n of nodes) {
      const pulse = 1 + Math.sin(time * 2 + n.pulseOffset) * 0.25
      const r = n.r * pulse

      // Halo
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)')
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.beginPath()
      ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Nodo solido
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + Math.sin(time * 2 + n.pulseOffset) * 0.2})`
      ctx.fill()
    }

    animId = requestAnimationFrame(draw)
  }

  draw()

  return () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
  }
}

let cleanup = null

onMounted(() => {
  if (canvas.value) {
    cleanup = startAnimation(canvas.value)
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
