# scrap — Capturas de UI para auto-revisión visual

Guía **para mí mismo** (Claude). Cuando el usuario pida revisar/verificar la UI,
o necesite ver cómo quedó un cambio visual, uso esto para **capturar y analizar
yo mismo** las pantallas (con la herramienta Read, que renderiza imágenes), en
vez de pedirle al usuario que mande screenshots.

## Cómo usarlo

1. Asegúrate de que estén corriendo: la app en `http://localhost:8182` y la API
   en `http://localhost:8181` (el usuario suele tenerlas abiertas).
2. Ejecuta el harness (login + token + capturas, automático):

   ```bash
   node .claude/scrap/ui-shot.cjs                       # calendario, light+dark, Semana/Día/Mes
   node .claude/scrap/ui-shot.cjs --url /app/cases/list/open --views "" --tag cases
   node .claude/scrap/ui-shot.cjs --themes dark --views Mes --tag cal-mes
   node .claude/scrap/ui-shot.cjs --url /app/calendar --full --selector ".cal-pager"
   ```

3. **Lee** las imágenes generadas con la tool Read (las renderiza visualmente) y
   analiza color/contraste/espaciado/layout. Itera el código y vuelve a capturar.

### Opciones (todas con default, ver cabecera de `ui-shot.cjs`)
`--url` ruta · `--tag` prefijo · `--themes light,dark` · `--views Día,Semana,Mes`
(clica botones por texto; vacío = sin clic) · `--viewport WxH` · `--wait ms` ·
`--full` página completa · `--selector` espera CSS antes de capturar.

Credenciales por env `TYFLOW_EMAIL` / `TYFLOW_PASSWORD` (o defaults en el script).

## Arquitectura de carpetas

```
.claude/scrap/
├── README.md          ← esta guía (entrada)
├── ui-shot.cjs        ← harness único reutilizable (Puppeteer)
└── shots/             ← salida, UNA carpeta por día (no regar archivos)
    └── YYYY-MM-DD/
        └── <tag>__<theme>[__<view>].png
```

Reglas de orden:
- **Nunca** dejar PNGs sueltos en `.claude/` ni en la raíz del repo.
- Todo screenshot va a `shots/<fecha>/` con nombre `<tag>__<theme>__<view>.png`.
- Un solo script (`ui-shot.cjs`); no crear `screenshot_xxx.cjs` por cada caso.
- `shots/` es desechable: se puede limpiar libremente (artefactos, no fuente).

## Notas

- El tema se siembra en `localStorage` (`tyflow_preferences_v2.theme`) antes del
  boot, así el módulo de color (`src/presentation/utils/color.js`) resuelve el
  fondo real del tema correcto.
- Ruta del calendario: `/app/calendar`. Botones de vista: `Día` `Semana` `Mes`.
- Puppeteer se resuelve global (`C:/nvm4w/nodejs/node_modules/puppeteer`) o local.
