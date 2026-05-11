/**
 * Animacion de grafo de nodos con canvas.
 *
 * Uso:
 *   const cleanup = startNodeGraph(canvasElement, { nodeCount: 14 })
 *   // al desmontar:
 *   cleanup()
 */

const DEFAULTS = {
  nodeCount: 14,
  connectDist: 160,
  speed: 0.4,
  minRadius: 2.5,
  maxRadius: 5,
  lineAlpha: 0.35,
  haloAlpha: 0.15,
}

function createNodes(w, h, { nodeCount, speed, minRadius, maxRadius }) {
  return Array.from({ length: nodeCount }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * speed * 2,
    vy: (Math.random() - 0.5) * speed * 2,
    r: minRadius + Math.random() * (maxRadius - minRadius),
    pulseOffset: Math.random() * Math.PI * 2,
  }))
}

export function startNodeGraph(canvasEl, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts }
  const ctx = canvasEl.getContext('2d')
  let w, h, nodes, dpr, animId

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
      nodes = createNodes(w, h, cfg)
    } else {
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
      if (n.x < 20 || n.x > w - 20) n.vx *= -1
      if (n.y < 20 || n.y > h - 20) n.vy *= -1
      n.vx += (Math.random() - 0.5) * 0.02
      n.vy += (Math.random() - 0.5) * 0.02
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
      if (speed > cfg.speed) {
        n.vx = (n.vx / speed) * cfg.speed
        n.vy = (n.vy / speed) * cfg.speed
      }
    }

    // Lineas entre nodos cercanos
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < cfg.connectDist) {
          const alpha = (1 - dist / cfg.connectDist) * cfg.lineAlpha
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
      grad.addColorStop(0, `rgba(255, 255, 255, ${cfg.haloAlpha})`)
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
