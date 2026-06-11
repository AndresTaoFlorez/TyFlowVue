<script setup>
import { computed } from 'vue'

const props = defineProps({
  preferences: { type: Object, default: null },
  name:        { type: String,  default: '' },
  size:        { type: String,  default: '2rem' },
  bgColor:     { type: String,  default: null },
})

const url     = computed(() => props.preferences?.avatar_url   || null)
const emoji   = computed(() => props.preferences?.avatar_emoji || null)
const initials = computed(() => {
  const parts = (props.name || '?').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
})
</script>

<template>
  <span class="ua" :style="{ width: size, height: size, fontSize: `calc(${size} * 0.42)`, background: bgColor || undefined }">
    <img v-if="url" :src="url" class="ua__img" alt="" loading="lazy" />
    <span v-else-if="emoji" class="ua__emoji" role="img">{{ emoji }}</span>
    <span v-else class="ua__initials">{{ initials }}</span>
  </span>
</template>

<style scoped>
.ua {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--bg-card, #e5e7eb);
  color: var(--text-secondary);
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.ua__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.ua__emoji {
  font-size: 0.9em;
  line-height: 1;
}

.ua__initials {
  font-size: inherit;
  line-height: 1;
}
</style>
