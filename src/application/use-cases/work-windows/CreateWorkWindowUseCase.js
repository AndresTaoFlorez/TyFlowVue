import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function createWorkWindowUseCase(windowsData) {
  const items = Array.isArray(windowsData) ? windowsData : [windowsData]

  if (items.length === 0) {
    throw new WorkWindowError('Debe incluir al menos una ventana.')
  }

  const normalized = items.map((item, i) => {
    const label = items.length > 1 ? ` (ventana ${i + 1})` : ''
    if (!item.specialistId) throw new WorkWindowError(`Especialista requerido${label}.`)
    if (!item.applicationId) throw new WorkWindowError(`Aplicación requerida${label}.`)
    if (!item.startTime) throw new WorkWindowError(`Hora de inicio requerida${label}.`)
    if (!item.endTime) throw new WorkWindowError(`Hora de fin requerida${label}.`)

    const startMins = parseTimeMins(item.startTime)
    const endMins = parseTimeMins(item.endTime)

    const date = item.scheduledDate || todayISO()
    const today = todayISO()
    const endDateVal = item.endDate || date

    // La ventana puede cruzar días (estilo Google Calendar): el orden de horas
    // solo aplica cuando inicio y fin caen el MISMO día calendario.
    if (endDateVal < date) {
      throw new WorkWindowError(`La fecha de fin no puede ser anterior a la de inicio${label}.`)
    }
    if (endDateVal === date && startMins >= endMins) {
      throw new WorkWindowError(`La hora de inicio debe ser anterior a la de fin${label}.`)
    }

    if (date < today) {
      throw new WorkWindowError(`No se pueden crear ventanas en fechas pasadas${label}.`)
    }
    // El fin no puede quedar detrás de la timeline: si cae HOY, exigir margen
    // de 30 min sobre la hora actual (si cae en un día futuro, no aplica).
    if (endDateVal === today) {
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      if (endMins < nowMins + 30) {
        throw new WorkWindowError(
          `Para hoy, la hora de fin debe ser al menos 30 minutos posterior a la hora actual${label}.`
        )
      }
    }

    return {
      specialistId: item.specialistId,
      applicationId: item.applicationId,
      startsAt: WorkWindow.toTimestampTz(date, item.startTime),
      endsAt: WorkWindow.toTimestampTz(endDateVal, item.endTime),
      inheritsOnReopen: item.inheritsOnReopen ?? false,
      affinityWeight: item.affinityWeight ?? null,
    }
  })

  try {
    return await WorkWindowRepository.create(normalized)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al crear la ventana de trabajo.')
  }
}

function parseTimeMins(t) {
  const parts = (t || '').split(':')
  return parseInt(parts[0] || 0, 10) * 60 + parseInt(parts[1] || 0, 10)
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
