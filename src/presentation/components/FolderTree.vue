<script setup>
import { computed } from 'vue'
import FolderTreeNode from '@/presentation/components/FolderTreeNode.vue'

const props = defineProps({
  folders: { type: Array, default: () => [] },
  specialists: { type: Array, default: () => [] },
  supportLevels: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})

defineEmits(['add-child', 'edit', 'delete', 'rename'])

const tree = computed(() => {
  const map = {}
  const roots = []

  for (const f of props.folders) {
    map[f.id] = { ...f, children: [] }
  }

  for (const f of props.folders) {
    if (f.parentFolderId && map[f.parentFolderId]) {
      map[f.parentFolderId].children.push(map[f.id])
    } else {
      roots.push(map[f.id])
    }
  }

  return roots
})
</script>

<template>
  <div class="folder-tree">
    <FolderTreeNode
      v-for="node in tree"
      :key="node.id"
      :node="node"
      :specialists="specialists"
      :support-levels="supportLevels"
      :editable="editable"
      :depth="0"
      @add-child="$emit('add-child', $event)"
      @edit="$emit('edit', $event)"
      @delete="$emit('delete', $event)"
      @rename="(folder, newName) => $emit('rename', folder, newName)"
    />
  </div>
</template>

<style scoped>
.folder-tree {
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 0.5rem;
}
</style>
