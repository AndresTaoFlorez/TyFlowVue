/**
 * Animacion de grafo de nodos con canvas.
 *
 * Uso:
 *   const cleanup = startNodeGraph(canvasElement, { nodeCount: 14 })
 *   // al desmontar:
 *   cleanup()
 *
 * Optimizaciones:
 *   - Spatial grid para conexiones O(n) en vez de O(n²)
 *   - Batching de lineas en un solo path por rango de alpha
 *   - Distancia al cuadrado (sin sqrt)
 *   - Sin creacion de objetos en el loop de dibujo
 *   - Halos pre-renderizados en offscreen canvas (evita createRadialGradient por frame)
 *   - Inicio diferido con requestIdleCallback para no bloquear FCP
 */

const REF_DIAGONAL = 1600

const DEFAULTS = {
  nodeCount: 14,
  connectDist: 160,
  speed: 0.4,
  minRadius: 2.5,
  maxRadius: 5,
  lineAlpha: 0.35,
  haloAlpha: 0.15,
  color: [255, 255, 255],
}

function createNode(w, h, speed, minRadius, maxRadius) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * speed * 2,
    vy: (Math.random() - 0.5) * speed * 2,
    r: minRadius + Math.random() * (maxRadius - minRadius),
    pulseOffset: Math.random() * Math.PI * 2,
    haloCanvas: null,
  }
}

function createNodes(w, h, count, cfg) {
  const arr = new Array(count)
  for (let i = 0; i < count; i++) {
    arr[i] = createNode(w, h, cfg.speed, cfg.minRadius, cfg.maxRadius)
  }
  return arr
}

/** Pre-render a halo sprite for a node at a fixed size */
function createHaloSprite(radius, cr, cg, cb, haloAlpha) {
  const size = Math.ceil(radius * 2) + 2
  const oc = document.createElement('canvas')
  oc.width = size
  oc.height = size
  const octx = oc.getContext('2d')
  const cx = size / 2
  const grad = octx.createRadialGradient(cx, cx, 0, cx, cx, radius)
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},${haloAlpha})`)
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
  octx.fillStyle = grad
  octx.fillRect(0, 0, size, size)
  return oc
}

// Numero de buckets de alpha para batching de lineas
const ALPHA_BUCKETS = 4

export function startNodeGraph(canvasEl, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts }
  const ctx = canvasEl.getContext('2d')
  let w, h, nodes, dpr, animId, connectDist2, connectDist, cellSize
  let cols, rows
  let grid = []  // flat array como spatial hash
  let cancelled = false

  function buildGrid() {
    cellSize = connectDist || 160
    cols = Math.ceil(w / cellSize) || 1
    rows = Math.ceil(h / cellSize) || 1
    if (grid.length < cols * rows) {
      grid = new Array(cols * rows)
      for (let i = 0; i < grid.length; i++) grid[i] = []
    }
  }

  function clearGrid() {
    for (let i = 0, len = cols * rows; i < len; i++) grid[i].length = 0
  }

  function insertGrid() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const c = Math.min(Math.floor(n.x / cellSize), cols - 1)
      const r = Math.min(Math.floor(n.y / cellSize), rows - 1)
      grid[r * cols + c].push(i)
    }
  }

  const [cr, cg, cb] = cfg.color

  function buildHaloSprites() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const maxHaloRadius = n.r * 1.25 * 4
      n.haloCanvas = createHaloSprite(maxHaloRadius, cr, cg, cb, cfg.haloAlpha)
    }
  }

  let needsResize = true

  function applyResize() {
    dpr = window.devicePixelRatio || 1
    const rect = canvasEl.parentElement.getBoundingClientRect()
    const newW = rect.width
    const newH = rect.height
    if (newW === 0 || newH === 0) return
    canvasEl.width = newW * dpr
    canvasEl.height = newH * dpr
    canvasEl.style.width = newW + 'px'
    canvasEl.style.height = newH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const diag = Math.sqrt(newW * newW + newH * newH)
    const scale = diag / REF_DIAGONAL
    connectDist = cfg.connectDist * scale
    connectDist2 = connectDist * connectDist
    const maxCount = cfg.nodeCount * 2
    const targetCount = Math.min(maxCount, Math.max(6, Math.round(cfg.nodeCount * scale)))

    if (!nodes) {
      w = newW
      h = newH
      nodes = createNodes(w, h, targetCount, cfg)
      buildHaloSprites()
    } else {
      const sx = newW / w
      const sy = newH / h
      for (const n of nodes) {
        n.x *= sx
        n.y *= sy
      }
      const prevLen = nodes.length
      while (nodes.length < targetCount) {
        nodes.push(createNode(newW, newH, cfg.speed, cfg.minRadius, cfg.maxRadius))
      }
      if (nodes.length > targetCount) nodes.length = targetCount
      // Build sprites for new nodes only
      for (let i = prevLen; i < nodes.length; i++) {
        const n = nodes[i]
        const maxHaloRadius = n.r * 1.25 * 4
        n.haloCanvas = createHaloSprite(maxHaloRadius, cr, cg, cb, cfg.haloAlpha)
      }
      w = newW
      h = newH
    }

    buildGrid()
    needsResize = false
  }

  // Pre-computar strings de color para los buckets de alpha (inmutable)
  const bucketColors = new Array(ALPHA_BUCKETS)
  for (let b = 0; b < ALPHA_BUCKETS; b++) {
    const a = ((b + 0.5) / ALPHA_BUCKETS) * cfg.lineAlpha
    bucketColors[b] = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`
  }
  const solidColor = `rgba(${cr},${cg},${cb},0.7)`

  let time = 0

  function draw() {
    if (cancelled) return
    if (needsResize) applyResize()
    time += 0.016
    ctx.clearRect(0, 0, w, h)

    // --- Mover nodos ---
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      n.x += n.vx
      n.y += n.vy
      if (n.x < 20 || n.x > w - 20) n.vx = -n.vx
      if (n.y < 20 || n.y > h - 20) n.vy = -n.vy
      n.vx += (Math.random() - 0.5) * 0.02
      n.vy += (Math.random() - 0.5) * 0.02
      const sp = n.vx * n.vx + n.vy * n.vy
      const maxSp = cfg.speed * cfg.speed
      if (sp > maxSp) {
        const f = cfg.speed / Math.sqrt(sp)
        n.vx *= f
        n.vy *= f
      }
    }

    // --- Spatial grid: insertar nodos ---
    clearGrid()
    insertGrid()

    // --- Lineas con batching por alpha ---
    // Un path por bucket
    const paths = new Array(ALPHA_BUCKETS)
    for (let b = 0; b < ALPHA_BUCKETS; b++) paths[b] = new Path2D()

    // Solo revisar celdas vecinas (incluida la propia)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r * cols + c]
        if (cell.length === 0) continue

        // Pares dentro de la misma celda
        for (let a = 0; a < cell.length; a++) {
          for (let b = a + 1; b < cell.length; b++) {
            addEdge(cell[a], cell[b], paths)
          }
        }

        // Vecinos: derecha, abajo, abajo-derecha, abajo-izquierda
        if (c + 1 < cols) crossCells(cell, grid[r * cols + c + 1], paths)
        if (r + 1 < rows) {
          crossCells(cell, grid[(r + 1) * cols + c], paths)
          if (c + 1 < cols) crossCells(cell, grid[(r + 1) * cols + c + 1], paths)
          if (c - 1 >= 0) crossCells(cell, grid[(r + 1) * cols + c - 1], paths)
        }
      }
    }

    // Dibujar todas las lineas (una draw call por bucket)
    ctx.lineWidth = 1
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      ctx.strokeStyle = bucketColors[b]
      ctx.stroke(paths[b])
    }

    // --- Dibujar nodos (halos con sprites pre-renderizados) ---
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const pulse = 1 + Math.sin(time * 2 + n.pulseOffset) * 0.25
      const haloSize = n.r * pulse * 4 * 2
      if (n.haloCanvas) {
        ctx.drawImage(n.haloCanvas, n.x - haloSize / 2, n.y - haloSize / 2, haloSize, haloSize)
      }
    }

    // Nodos solidos en un solo batch
    const solidPath = new Path2D()
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const pulse = 1 + Math.sin(time * 2 + n.pulseOffset) * 0.25
      const rd = n.r * pulse
      solidPath.moveTo(n.x + rd, n.y)
      solidPath.arc(n.x, n.y, rd, 0, 6.2832)
    }
    ctx.fillStyle = solidColor
    ctx.fill(solidPath)

    animId = requestAnimationFrame(draw)
  }

  function addEdge(i, j, paths) {
    const ni = nodes[i], nj = nodes[j]
    const dx = ni.x - nj.x
    const dy = ni.y - nj.y
    const d2 = dx * dx + dy * dy
    if (d2 < connectDist2) {
      const t = 1 - d2 / connectDist2  // aproximacion lineal sin sqrt
      const bucket = Math.min((t * ALPHA_BUCKETS) | 0, ALPHA_BUCKETS - 1)
      paths[bucket].moveTo(ni.x, ni.y)
      paths[bucket].lineTo(nj.x, nj.y)
    }
  }

  function crossCells(cellA, cellB, paths) {
    if (cellB.length === 0) return
    for (let a = 0; a < cellA.length; a++) {
      for (let b = 0; b < cellB.length; b++) {
        addEdge(cellA[a], cellB[b], paths)
      }
    }
  }

  // Defer animation start to avoid blocking initial paint
  const scheduleStart = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
  scheduleStart(() => {
    if (cancelled) return
    applyResize()
    const ro = new ResizeObserver(() => { needsResize = true })
    ro.observe(canvasEl.parentElement)
    canvasEl._ro = ro
    draw()
  })

  return () => {
    cancelled = true
    cancelAnimationFrame(animId)
    if (canvasEl._ro) {
      canvasEl._ro.disconnect()
      canvasEl._ro = null
    }
  }
}
