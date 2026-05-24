import { ref, computed } from 'vue'

/**
 * Composable para indicar visualmente qué campos de un formulario
 * están pendientes de confirmación del backend.
 *
 * Uso típico:
 *   const { isPending, markPending, clearPending } = usePendingFields()
 *
 *   // Al guardar — compara el snapshot original contra lo enviado:
 *   markPending(formularioOriginal, formularioEnviado)
 *
 *   // En el template:
 *   <span :class="{ 'field--pending': isPending('firstName') }">…</span>
 *
 *   // Campos compuestos (pendiente si CUALQUIERA cambió):
 *   <span :class="{ 'field--pending': isPending(['firstName', 'firstSurname']) }">…</span>
 *
 *   // Después de recargar datos frescos:
 *   clearPending()
 */
export function usePendingFields() {
  const _pending = ref(new Set())

  function markPending(oldData, newData) {
    const changed = new Set()
    for (const key of Object.keys(newData)) {
      if (!(key in oldData)) continue
      if (!isEqual(oldData[key], newData[key])) changed.add(key)
    }
    _pending.value = changed
  }

  function clearPending() {
    _pending.value = new Set()
  }

  function isPending(fieldOrFields) {
    if (Array.isArray(fieldOrFields)) {
      return fieldOrFields.some((f) => _pending.value.has(f))
    }
    return _pending.value.has(fieldOrFields)
  }

  const hasPending = computed(() => _pending.value.size > 0)

  function hasChanges(oldData, newData) {
    for (const key of Object.keys(newData)) {
      if (!(key in oldData)) continue
      if (!isEqual(oldData[key], newData[key])) return true
    }
    return false
  }

  return { hasPending, isPending, markPending, clearPending, hasChanges }
}

function isEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a == b

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sa = [...a].sort()
    const sb = [...b].sort()
    return sa.every((v, i) => v === sb[i])
  }

  return String(a) === String(b)
}
