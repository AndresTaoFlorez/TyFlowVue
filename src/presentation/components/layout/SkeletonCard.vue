<script setup>
defineProps({
  count: {
    type: Number,
    default: 6
  }
})
</script>

<template>
  <div class="cards-grid">
    <div v-for="n in count" :key="n" class="skeleton-card">
      <div class="skeleton-card__header">
        <div class="skeleton skeleton--circle"></div>
        <div class="skeleton-card__lines">
          <div class="skeleton skeleton--text skeleton--w70"></div>
          <div class="skeleton skeleton--text skeleton--w50"></div>
        </div>
      </div>
      <div class="skeleton-card__body">
        <div class="skeleton skeleton--text skeleton--w60"></div>
        <div class="skeleton skeleton--text skeleton--w80"></div>
        <div class="skeleton skeleton--text skeleton--w40"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.skeleton-card {
  background: var(--bg-main);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-left: 3px solid var(--border-light);
}

.skeleton-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.skeleton-card__lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.skeleton {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite ease-in-out;
  border-radius: var(--radius-sm);
}

.skeleton--circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.skeleton--text {
  height: 0.75rem;
}

.skeleton--w40 { width: 40%; }
.skeleton--w50 { width: 50%; }
.skeleton--w60 { width: 60%; }
.skeleton--w70 { width: 70%; }
.skeleton--w80 { width: 80%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
