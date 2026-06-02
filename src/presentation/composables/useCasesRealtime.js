import { onMounted, onUnmounted } from 'vue'
import { wsClient } from '@/infrastructure/realtime/wsClient'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

export function useCasesRealtime() {
  const store = useCasesStore()
  const unsubs = []

  onMounted(() => {
    unsubs.push(wsClient.on('case.created', data => store.onCaseCreatedRT(data)))
    unsubs.push(wsClient.on('case.assigned', data => store.onCaseAssignedRT(data)))
    unsubs.push(wsClient.on('case.reassigned', data => store.onCaseReassignedRT(data)))
  })

  onUnmounted(() => {
    unsubs.forEach(fn => fn())
  })
}
