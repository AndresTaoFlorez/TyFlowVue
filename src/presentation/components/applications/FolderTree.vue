<script setup>
import { computed } from 'vue'
import FolderTreeNode from '@/presentation/components/applications/FolderTreeNode.vue'

const props = defineProps({
  folders: { type: Array, default: () => [] },
  specialists: { type: Array, default: () => [] },
  supportLevels: { type: Array, default: () => [] },
  selectedFolderId: { type: String, default: null },
  collapsedMainBoxIds: { type: Set, default: () => new Set() },
})

defineEmits(['select', 'context-menu', 'toggle-collapse'])

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
      :selected-folder-id="selectedFolderId"
      :collapsed-main-box-ids="collapsedMainBoxIds"
      :depth="0"
      @select="$emit('select', $event)"
      @context-menu="(ev, n) => $emit('context-menu', ev, n)"
      @toggle-collapse="$emit('toggle-collapse', $event)"
    />
  </div>
</template>

<style scoped>
.folder-tree {
  padding: 0.25rem 0;
}
</style>
