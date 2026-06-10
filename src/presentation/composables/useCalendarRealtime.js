import { watch, onMounted, onUnmounted } from 'vue'
import { wsClient, wsStatus } from '@/infrastructure/realtime/wsClient'
import { useCalendarStore } from '@/presentation/stores/useCalendarStore'

export function useCalendarRealtime() {
  const store = useCalendarStore()
  const unsubs = []

  // After reconnection, reload windows for the current range
  watch(wsStatus, (status, prev) => {
    if (status === 'connected' && (prev === 'reconnecting' || prev === 'connecting')) {
      store.forceReload()
    }
  })

  onMounted(() => {
    unsubs.push(wsClient.on('work_window.created',     data => store.onWindowCreatedRT(data)))
    unsubs.push(wsClient.on('work_window.updated',     data => store.onWindowUpdatedRT(data)))
    unsubs.push(wsClient.on('work_window.deleted',     data => store.onWindowDeletedRT(data)))
    unsubs.push(wsClient.on('work_window.toggled',     data => store.onWindowToggledRT(data)))
    unsubs.push(wsClient.on('work_window.inherited',   data => store.onWindowUpdatedRT(data)))
    unsubs.push(wsClient.on('work_window.disinherited', data => store.onWindowUpdatedRT(data)))
    unsubs.push(wsClient.on('work_window.merged',      data => store.onWindowMergedRT(data)))
    unsubs.push(wsClient.on('work_window.batch',       data => store.onWindowBatchRT(data)))
  })

  onUnmounted(() => {
    unsubs.forEach(fn => fn())
  })
}
