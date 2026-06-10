<script setup>
import UserCard from '@/presentation/components/users/UserCard.vue'

defineProps({
  users: { type: Array, required: true },
  toggling: { type: Set, required: true },
  loadingEditId: { type: String, default: null },
  selected: { type: Set, default: () => new Set() },
  selectable: { type: Boolean, default: false },
})

defineEmits(['toggle', 'edit', 'select'])
</script>

<template>
  <div class="cards-grid">
    <UserCard
      v-for="user in users"
      :key="user.id"
      :user="user"
      :toggling="toggling.has(user.id)"
      :loading-edit="loadingEditId === user.id"
      :selected="selected.has(user.id)"
      :selectable="selectable"
      @toggle="$emit('toggle', $event)"
      @edit="$emit('edit', $event)"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
