import { onMounted, onUnmounted } from 'vue'
import { wsClient } from '@/infrastructure/realtime/wsClient'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

export function useCasesRealtime() {
  const store = useCasesStore()
  const unsubs = []

  onMounted(() => {
    unsubs.push(wsClient.on('case.created',   data => store.onCaseCreatedRT(data)))
    unsubs.push(wsClient.on('case.assigned',  data => store.onCaseAssignedRT(data)))
    unsubs.push(wsClient.on('case.reassigned',data => store.onCaseReassignedRT(data)))
    unsubs.push(wsClient.on('case.updated',   data => store.onCaseUpdatedRT(data)))
    unsubs.push(wsClient.on('autopilot.started',   data => store.onAutopilotStartedRT(data)))
    unsubs.push(wsClient.on('autopilot.progress',  data => store.onAutopilotProgressRT(data)))
    unsubs.push(wsClient.on('autopilot.completed', data => store.onAutopilotCompletedRT(data)))
  })

  onUnmounted(() => {
    unsubs.forEach(fn => fn())
  })
}
