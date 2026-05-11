<script setup>
import UserCard from '@/presentation/components/UserCard.vue'

defineProps({
  users: { type: Array, required: true },
  toggling: { type: Set, required: true }
})

defineEmits(['toggle', 'edit'])
</script>

<template>
  <div class="cards-grid">
    <UserCard
      v-for="user in users"
      :key="user.id"
      :user="user"
      :toggling="toggling.has(user.id)"
      @toggle="$emit('toggle', $event)"
      @edit="$emit('edit', $event)"
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
