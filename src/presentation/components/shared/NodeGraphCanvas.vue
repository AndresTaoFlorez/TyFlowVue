<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { startNodeGraph } from '@/presentation/utils/nodeGraph'

const props = defineProps({
  nodeCount:   { type: Number, default: 24 },
  connectDist: { type: Number, default: 220 },
  speed:       { type: Number, default: 0.3 },
  minRadius:   { type: Number, default: 1.5 },
  maxRadius:   { type: Number, default: 4 },
  lineAlpha:   { type: Number, default: 0.25 },
  haloAlpha:   { type: Number, default: 0.1 },
  color:       { type: Array,  default: () => [42, 199, 143] },
})

const canvas = ref(null)
let cleanup = null

onMounted(() => {
  if (canvas.value) {
    cleanup = startNodeGraph(canvas.value, {
      nodeCount: props.nodeCount,
      connectDist: props.connectDist,
      speed: props.speed,
      minRadius: props.minRadius,
      maxRadius: props.maxRadius,
      lineAlpha: props.lineAlpha,
      haloAlpha: props.haloAlpha,
      color: props.color,
    })
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<template>
  <canvas ref="canvas" class="node-graph-canvas"></canvas>
</template>

<style scoped>
.node-graph-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
