/**
 * syncSeq — Supersesión de peticiones stale (last-write-wins en el backend).
 *
 * El backend descarta mutaciones viejas cuando ya recibió una más nueva para
 * los mismos recursos (API_CONTRACT del backend: §21 mecanismo genérico por
 * headers, §15 per-item en work windows). Todo es opt-in: peticiones sin
 * headers/op_seq se comportan como siempre. Los GET nunca se cortan.
 *
 * Dos formas de marcar una mutación:
 *
 * 1) Headers a nivel request (POST/PUT/PATCH/DELETE):
 *      headers: syncGuardHeaders(['work_window:<id>', ...])
 *    Si llega después que una petición más nueva para esos recursos, el backend
 *    responde 409 + X-Superseded: true SIN tocar la DB. El client HTTP lo
 *    convierte en ApiError con isSuperseded=true → tratar como no-op silencioso
 *    (no pintar, no error, no reintentar: el estado lo pinta la ganadora).
 *
 * 2) Per-item en PATCH /work-windows: cada item lleva op_seq (este mismo
 *    contador). La respuesta separa updated / failed / superseded; los items
 *    superados se ignoran por completo (tampoco emiten eventos WebSocket).
 *
 * IMPORTANTE: solo proteger operaciones de estado ABSOLUTO (mover/redimensionar
 * con horas finales, delete). Operaciones RELATIVAS (toggle = flip) NO son
 * LWW-safe: descartar una cambia el resultado final.
 */

// Contador monotónico estrictamente creciente. Anclado a Date.now() para que
// siga creciendo entre recargas de página (el backend compara por recurso).
let _lastSeq = 0

export function nextSyncSeq() {
  _lastSeq = Math.max(_lastSeq + 1, Date.now())
  return _lastSeq
}

/**
 * Headers de supersesión para una mutación que toca `keys`.
 * @param {string[]} keys - Recursos tocados, formato `<tipo>:<id>`
 *                          (ej. ['work_window:e0c66f', 'work_window:a1b2c3'])
 */
export function syncGuardHeaders(keys) {
  return {
    'X-Sync-Seq': String(nextSyncSeq()),
    'X-Sync-Keys': keys.join(','),
  }
}
