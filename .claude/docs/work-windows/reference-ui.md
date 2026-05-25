# Referencia UI - CoordinatorPage (fd_mailreceiver)

Archivo fuente: `D:\Projects\fd_mailreceiver\src\presentation\pages\CoordinatorPage\CoordinatorPage.vue`

## Layout general

Vista dual con tabs: **Calendario** (dia/semana) y **Tabla** (gestion).

### Vista Calendario - Semana (default)
- Grid temporal: columnas = 7 dias (Lun-Dom), filas = horas 8:00-18:00
- Bloques de colores posicionados absolutamente segun start/end time
- Color del bloque indica estado de balance (verde=ok, rojo=exceso, azul=deficit)
- Click en bloque abre modal de detalle
- Navegacion: semana anterior / hoy / semana siguiente
- Columna de hoy resaltada en azul claro

### Vista Calendario - Dia
- Columnas = un specialist por columna (avatar + nombre + nivel)
- Filas = misma grilla de horas
- Bloques organizados por specialist en vez de por dia

### Vista Tabla
- Fila de metricas: total ventanas, asignados, esperados, equilibradas, exceso, deficit
- Tabla: Especialista | Aplicativo | Horario | Asig | Esp | Balance | Estado | Acciones
- Acciones por fila: editar, reset balance

### Modal de detalle
- Metadata: specialist, codigo, dia, horas, aplicacion, nivel
- Casos asignados/esperados, balance con color
- Botones: Editar, Reset, Cerrar ventana, Listo

## Constantes de diseño
- HOUR_H = 52px por hora
- BASE_HOUR = 8 (hora minima)
- DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
- HOURS = ["8:00" ... "18:00"]

## Manejo de overlaps
Cuando 2+ bloques coinciden en specialist/dia/hora:
- Se divide el ancho: `width = 95 / columns %`
- Se desplaza: `left = (col / cols) * 93 + 2 %`

## Colores de balance
- OK: bg #dcfce7, border-left #15803d (verde)
- OVER: bg #fee2e2, border-left #b91c1c (rojo)
- UNDER: bg #dbeafe, border-left #1d4ed8 (azul)

## Diferencias con nuestro backend
- fd_mailreceiver usa `especialist_code` / `application_code` (strings)
- Nuestro backend usa `specialist_id` / `application_id` (hex IDs)
- fd_mailreceiver tiene schedule como dict {date: [{start, end}]}
- Nuestro backend tiene start_time/end_time simples (una franja por ventana)
- fd_mailreceiver tiene balance/load-status endpoints - nuestro backend no (aun)
- Nuestro backend tiene concepto de sesion (open/close) que fd_mailreceiver maneja diferente
