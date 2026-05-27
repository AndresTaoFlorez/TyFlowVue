import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchConversationsUseCase } from '@/application/use-cases/conversations/FetchConversationsUseCase'
import { fetchConversationUseCase } from '@/application/use-cases/conversations/FetchConversationUseCase'
import { ingestConversationsUseCase } from '@/application/use-cases/conversations/IngestConversationsUseCase'
import { fetchAssignmentsByConversationUseCase } from '@/application/use-cases/assignments/FetchAssignmentsByConversationUseCase'

export const useConversationStore = defineStore('conversations', () => {
  const conversations = ref([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)
  const filters = ref({})
  const loading = ref(false)
  const error = ref(null)

  const selectedConversation = ref(null)
  const selectedAssignments = ref([])
  const loadingDetail = ref(false)
  const loadingAssignments = ref(false)

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  async function loadConversations({ newPage, newFilters, newPageSize } = {}) {
    if (newPage != null) page.value = newPage
    if (newFilters != null) filters.value = newFilters
    if (newPageSize != null) pageSize.value = newPageSize

    loading.value = true
    error.value = null
    try {
      const result = await fetchConversationsUseCase({
        ...filters.value,
        page: page.value,
        pageSize: pageSize.value,
      })
      conversations.value = result.data
      total.value = result.total
      page.value = result.page
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function selectConversation(id) {
    if (!id) {
      selectedConversation.value = null
      selectedAssignments.value = []
      return
    }

    loadingDetail.value = true
    try {
      selectedConversation.value = await fetchConversationUseCase(id)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loadingDetail.value = false
    }

    loadingAssignments.value = true
    try {
      selectedAssignments.value = await fetchAssignmentsByConversationUseCase(id)
    } catch {
      selectedAssignments.value = []
    } finally {
      loadingAssignments.value = false
    }
  }

  async function ingest(payload) {
    return ingestConversationsUseCase(payload)
  }

  function clearAll() {
    conversations.value = []
    total.value = 0
    page.value = 1
    filters.value = {}
    selectedConversation.value = null
    selectedAssignments.value = []
    error.value = null
  }

  return {
    conversations,
    total,
    page,
    pageSize,
    filters,
    loading,
    error,
    selectedConversation,
    selectedAssignments,
    loadingDetail,
    loadingAssignments,
    totalPages,
    loadConversations,
    selectConversation,
    ingest,
    clearAll,
  }
})
