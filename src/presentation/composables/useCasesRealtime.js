import { watch, onMounted, onUnmounted } from 'vue'
import { wsClient, wsStatus } from '@/infrastructure/realtime/wsClient'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

export function useCasesRealtime() {
  const store = useCasesStore()
  const unsubs = []

  // After a reconnection, force-sync cases AND the autopilot status to recover
  // events missed while disconnected (an autopilot.completed perdido dejaba
  // el spinner corriendo para siempre).
  watch(wsStatus, (status, prev) => {
    if (status === 'connected' && (prev === 'reconnecting' || prev === 'connecting')) {
      store.loadCases()
      store.syncAutopilotStatus()
    }
  })

  onMounted(() => {
    unsubs.push(wsClient.on('case.created',    data => store.onCaseCreatedRT(data)))
    unsubs.push(wsClient.on('case.assigned',   data => store.onCaseAssignedRT(data)))
    unsubs.push(wsClient.on('case.reassigned', data => store.onCaseReassignedRT(data)))
    unsubs.push(wsClient.on('case.updated',    data => store.onCaseUpdatedRT(data)))
    unsubs.push(wsClient.on('autopilot.started',   data => store.onAutopilotStartedRT(data)))
    unsubs.push(wsClient.on('autopilot.progress',  data => store.onAutopilotProgressRT(data)))
    unsubs.push(wsClient.on('autopilot.completed', data => store.onAutopilotCompletedRT(data)))
  })

  onUnmounted(() => {
    unsubs.forEach(fn => fn())
  })
}
