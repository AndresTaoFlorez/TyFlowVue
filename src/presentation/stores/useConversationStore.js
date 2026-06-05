import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'
import { Conversation } from '@/domain/entities/Conversation'
import { fetchConversationsUseCase } from '@/application/use-cases/conversations/FetchConversationsUseCase'
import { fetchConversationUseCase } from '@/application/use-cases/conversations/FetchConversationUseCase'
import { ingestConversationsUseCase } from '@/application/use-cases/conversations/IngestConversationsUseCase'
import { fetchAssignmentsByCaseUseCase } from '@/application/use-cases/assignments/FetchAssignmentsByCaseUseCase'

const INITIAL_PAGE_SIZE = 50
const LOAD_MORE_SIZE = 50

export const useConversationStore = defineStore('conversations', () => {
  // ---- State ----
  const conversations = ref([])
  const total = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref(null)
  const hasMore = computed(() => conversations.value.length < total.value)
  const filters = ref({})

  // Internal cursor: tracks how many items are loaded so far
  let _loadedCount = 0
  let _currentFolderId = null

  // ---- SyncEngine (per-folder, re-created on folder change) ----
  let _syncEngine = null

  function _createSyncEngine(folderId) {
    return new SyncEngine({
      cacheKey: `tyflow_conversations_${folderId}`,
      hydrate: (raw) => new Conversation(raw),
      fetchRemote: () => fetchConversationsUseCase({
        folderId,
        page: 1,
        pageSize: INITIAL_PAGE_SIZE,
      }).then(r => {
        total.value = r.total
        return r.data
      }),
      getId: (item) => item.id,
    })
  }

  // ---- Selected conversation (local-first) ----
  const selectedConversation = ref(null)
  const selectedAssignments = ref([])
  const loadingDetail = ref(false)
  const loadingAssignments = ref(false)

  // ---- Load conversations for a folder (cache-first) ----
  async function loadConversations({ newFilters } = {}) {
    if (newFilters != null) filters.value = newFilters
    const folderId = filters.value.folderId
    if (!folderId) return

    // Folder changed → reset
    if (folderId !== _currentFolderId) {
      _currentFolderId = folderId
      _loadedCount = 0
      _syncEngine = _createSyncEngine(folderId)

      // 1. Instant: load from cache
      const cached = _syncEngine.loadFromCache()
      if (cached.length > 0) {
        conversations.value = cached
        total.value = cached.length // approximate until backend confirms
      }

      // 2. Fetch first batch from backend
      loading.value = true
      error.value = null
      try {
        const result = await fetchConversationsUseCase({
          folderId,
          page: 1,
          pageSize: INITIAL_PAGE_SIZE,
        })
        conversations.value = result.data
        total.value = result.total
        _loadedCount = result.data.length
        _syncEngine.writeToCache(result.data)
      } catch (e) {
        // If cache was loaded, keep it; otherwise show error
        if (conversations.value.length === 0) {
          error.value = e.message
        }
      } finally {
        loading.value = false
      }
    }
  }

  // ---- Load more (infinite scroll) ----
  async function loadMore() {
    if (loadingMore.value || !hasMore.value || !_currentFolderId) return
    loadingMore.value = true
    try {
      const nextPage = Math.floor(_loadedCount / LOAD_MORE_SIZE) + 1
      const result = await fetchConversationsUseCase({
        ...filters.value,
        page: nextPage,
        pageSize: LOAD_MORE_SIZE,
      })
      // Deduplicate: only append items not already in the list
      const existingIds = new Set(conversations.value.map(c => c.id))
      const newItems = result.data.filter(c => !existingIds.has(c.id))
      if (newItems.length > 0) {
        conversations.value = [...conversations.value, ...newItems]
      }
      total.value = result.total
      _loadedCount = conversations.value.length
      // Update cache with full loaded set
      if (_syncEngine) _syncEngine.writeToCache(conversations.value)
    } catch {
      // Silent fail — user can scroll again to retry
    } finally {
      loadingMore.value = false
    }
  }

  // ---- Select conversation (local-first) ----
  async function selectConversation(id) {
    if (!id) {
      selectedConversation.value = null
      selectedAssignments.value = []
      return
    }

    // Try local first — no fetch needed
    const local = conversations.value.find(c => c.id === id)
    if (local) {
      selectedConversation.value = local
    } else {
      // Fallback: fetch from backend
      loadingDetail.value = true
      try {
        selectedConversation.value = await fetchConversationUseCase(id)
      } catch (e) {
        error.value = e.message
        throw e
      } finally {
        loadingDetail.value = false
      }
    }

    // TODO: assignments now require case_id — need backend to return case_id in conversation response
    selectedAssignments.value = []
  }

  // ---- Ingest ----
  async function ingest(payload) {
    const result = await ingestConversationsUseCase(payload)
    // After ingest, reload current folder to pick up new conversation
    if (_currentFolderId) {
      _loadedCount = 0
      const prev = _currentFolderId
      _currentFolderId = null // force reload
      await loadConversations({ newFilters: { folderId: prev } })
    }
    return result
  }

  // ---- Clear ----
  function clearAll() {
    conversations.value = []
    total.value = 0
    filters.value = {}
    selectedConversation.value = null
    selectedAssignments.value = []
    error.value = null
    _loadedCount = 0
    _currentFolderId = null
    _syncEngine = null
  }

  return {
    conversations,
    total,
    filters,
    loading,
    loadingMore,
    error,
    hasMore,
    selectedConversation,
    selectedAssignments,
    loadingDetail,
    loadingAssignments,
    loadConversations,
    loadMore,
    selectConversation,
    ingest,
    clearAll,
  }
})
