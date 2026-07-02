# Cómo creamos los videos demostrativos del sistema

> Guía de handoff para reproducir el motor de videos de capacitación/demo.
> Aplica a **OperacionesRanger**, **Nómina Ranger** y los demos hosteados.
> Autor: Claude (asistente de Rhay). Fecha: 2026-07-02.

---

## 1. Idea general

Un video demo no es una grabación de pantalla a mano. Es un **script Python que maneja un
navegador real** (Playwright), ejecuta el flujo verdadero del sistema (login, crear cliente,
calcular nómina…), le pone encima un **overlay** con título y banner de pasos, y le mezcla una
**narración generada por voz sintética** (edge-tts, voz dominicana). Todo sincronizado y
exportado a **MP4** listo para enviar por Telegram/WhatsApp.

**Ventajas:** reproducible, editable por texto, sin micrófono ni edición manual, y usa datos
**reales** del backend (sirve como evidencia/auditoría, no es un mockup).

**Stack:**
- **Playwright (Chromium headless)** → maneja el navegador y graba `.webm`.
- **edge-tts** → genera los clips de voz `.mp3` (voz `es-DO-EmilioNeural`, dominicana).
- **ffmpeg / ffprobe** → mide duración de audios y mezcla voz+video → `.mp4`.

---

## 2. Instalación (una vez)

```bash
pip install playwright edge-tts
python -m playwright install chromium
```
- **ffmpeg** y **ffprobe** deben estar en el PATH (probar `ffmpeg -version`).
- Requiere conexión al backend del sistema que se va a grabar (ver §5, rutas/host).

Estructura de carpetas (dentro de `Docs/guia-usuario/videos/`):
```
rec_common.py          ← MOTOR (no se toca casi nunca)
rec_cliente.py         ← un flujo = un archivo (ejemplo)
rec_puesto.py, ...     ← más flujos
raw/                   ← .webm crudos (se puede borrar)
aud/                   ← .mp3 de narración (se puede borrar)
NN_nombre.mp4          ← salida final
```

---

## 3. El motor: `rec_common.py`

Es la pieza central y **reusable**. Expone una sola función que hace todo el trabajo:

```python
make_video(module_route, title_text, title_sub, intro_say, steps, out_name)
```

Qué hace internamente, en orden:
1. **Pre-genera la narración** con `tts()`: convierte cada texto a `.mp3` y mide su duración con
   `ffprobe`. (Se genera ANTES de grabar para saber cuánto debe durar cada paso en pantalla.)
2. **Login headless** (`login_save_state`) y guarda el `storage_state` (token) → así el video
   **arranca ya logueado**, con intro limpio, sin mostrar la pantalla de login.
3. **Graba** el navegador (`record_video_dir`) mientras ejecuta los pasos:
   - Pone el sistema en **modo claro** (`set_light` → botón `aria-label="Modo claro"`).
   - Inyecta el **overlay** (`OVERLAY_JS`): cartel de título + banner de pasos superior.
   - Por cada paso: muestra el `cap` (banner), corre la acción `do(pg)` si existe, y **espera al
     menos lo que dure la narración** de ese paso.
   - Va midiendo el **offset real** (segundos desde el inicio del video) de cada narración.
4. **Mezcla** (`_mux`): convierte `.webm`→`.mp4` (libx264/aac) y superpone cada clip de voz en su
   offset con `ffmpeg` (`adelay` + `amix`). Resultado sincronizado voz↔imagen.

Salida típica: **~1–1.6 MB, 50–70 s**.

### Helpers útiles del motor
- `type_field(pg, formcontrolname, texto)` — escribe en un input de un `mat-dialog`. **Limpia el
  campo antes** (importante: algunos traen valor por defecto, p.ej. cantidad "1" → sin limpiar
  quedaría "11").
- `pick_select(pg, formcontrolname, option_text)` — elige opción de un `mat-select`. Las opciones
  cargan async; verifica `ng-invalid` y **reintenta** si no commiteó, y espera a que el panel se
  cierre (su overlay bloquea clics siguientes).
- `cap(pg, texto)` / `title(pg, t, s)` — controlan el banner y el cartel de título.
- `set_light(pg)` — fuerza modo claro (silencioso si ya está claro).

---

## 4. Cómo se define UN video (patrón)

Cada flujo es **un archivo** que importa el motor y describe los pasos como una lista de dicts.
Ejemplo real (`rec_cliente.py`):

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rec_common as rc

def _open(pg): pg.click("button:has-text('Nuevo Cliente')"); pg.wait_for_timeout(1500)
def _fill(pg):
    rc.type_field(pg,"nombre","Cliente Capacitación SRL")
    rc.type_field(pg,"ruc","131"+rc.SUF)          # rc.SUF = HHMMSS → datos únicos por corrida
    rc.type_field(pg,"telefono","(809) 555-0199")
def _save(pg): pg.click("mat-dialog-container button:has-text('Guardar')"); pg.wait_for_timeout(2500)

steps = [
    {"cap":"Módulo Clientes — aquí ves la lista",
     "say":"Entramos al módulo de Clientes. Aquí vemos la lista de los clientes registrados."},
    {"cap":"Paso 1:  + Nuevo Cliente",
     "say":"Para agregar uno nuevo, presionamos el botón Nuevo Cliente.","do":_open},
    {"cap":"Paso 2:  completá los datos",
     "say":"Completamos el nombre, el RNC, el teléfono...","do":_fill},
    {"cap":"Paso 3:  Guardar",
     "say":"Cuando todo está listo, presionamos Guardar.","do":_save},
    {"cap":"✓ ¡Cliente creado!",
     "say":"Listo. El cliente quedó registrado y ya aparece en la lista."},
]

rc.make_video(
    module_route="/clientes",
    title_text="Crear un Cliente",
    title_sub="Mantenimientos  ›  Clientes",
    intro_say="Veamos cómo registrar un nuevo cliente en Operaciones Ranger.",
    steps=steps,
    out_name="01_crear_cliente",
)
```

**Anatomía de un paso (`dict`):**
- `cap` → texto del banner superior (lo que se lee en pantalla).
- `say` → texto que la voz narra (se convierte a audio). Escribilo **hablado y natural**.
- `do` (opcional) → función `do(pg)` con la acción Playwright (click, llenar, etc.). Si no hay
  `do`, el paso solo muestra/narra (sirve para intro o cierre).

Correr: `python rec_cliente.py` → genera `01_crear_cliente.mp4`.

---

## 5. Configuración por ambiente (lo que hay que ajustar)

En `rec_common.py`, arriba:
- `BASE` → URL del front. Ej. `http://100.91.126.66:4300` (train por Tailscale) o
  `http://localhost:4300` (demo local).
- `LANIP`/`TSIP` + `reroute` → **solo para el train de OperacionesRanger**: reescribe llamadas
  del host LAN (`10.0.0.152:3342`) al host Tailscale (`100.91.126.66:3342`) para operar por VPN
  sin tocar el ambiente en vivo. En demo local **no se usa** (mismo host).
- `login_save_state` → usuario/clave del login. Ajustar al ambiente
  (train: `manager_demo`/`Manager2026!`; demo local: `demo`/`Demo2026!`).
- `VOICE` → `es-DO-EmilioNeural` (dominicano). Fallback `es-MX-JorgeNeural`.

> Para un **sistema nuevo** basta con: cambiar `BASE`, ajustar el login, y quitar el `reroute` si
> no aplica. El resto del motor sirve igual (es genérico para apps Angular Material).

---

## 6. Gotchas ya resueltos (leer antes de pelear con algo)

- **Modo claro** tarda en montar tras navegar → `set_light` espera el toggle; si ya está claro,
  no aparece y sigue sin error.
- **Token expira ~15 min** → el `storage_state` se genera en el MISMO run, justo antes de grabar.
- **`mat-select` async** → la 1ª selección a veces no commitea → `pick_select` verifica
  `ng-invalid` y reintenta; espera que el panel se cierre (su overlay bloquea el botón Guardar).
- **`type_field` limpia el campo** antes de escribir (evita "11" en cantidades con default "1").
- **Sync voz↔video** → offsets medidos con `time.monotonic()` desde `t0` (= inicio del video); el
  lead-in del `goto` afecta a ambos por igual, quedan sincronizados.
- **Frames de verificación** → usar seek de SALIDA (`ffmpeg -i in -ss N -frames:v 1`); el de
  entrada es impreciso en `.webm` (VFR).
- **`mat-autocomplete` NO renderiza fiable en Playwright** (buscadores tipo "reemplazar guardián"):
  el input recibe texto y la API responde 200, pero el panel `[role=option]` queda intermitente
  con 0 opciones. **No es bug de la app** (a mano funciona); es timing/change-detection. No
  perder horas. **Solución = patrón "3 partes"** (`rec_3partes.py`): ANTES ejecuta el flujo real
  hasta escribir la búsqueda (la API dispara de verdad); DURANTE inyecta una imagen fija por JS
  mostrando el dato **real** de la API; DESPUÉS hace el POST real y muestra la respuesta verídica.
  Todos los datos son reales; solo el dropdown se representa con un still.
- **Demo local — pantalla "Confirmar día"**: abre por defecto en HOY y al confirmar
  **borra/regenera** los turnos de esa fecha → automatizar ahí puede limpiar turnos sembrados.
  Cuidado al grabar contra datos sembrados del día actual.
- **Form Editar Cliente (demo local)**: RNC (`ruc`) es requerido (9 dígitos) y teléfono exige
  patrón `(\d{3}) \d{3}-\d{4}`, si no el botón Guardar queda deshabilitado.

---

## 7. Recetas rápidas

- **Nuevo flujo simple** → copiá `rec_cliente.py`, cambiá `module_route`, los `steps` y `out_name`.
- **Flujo sin login previo** (mostrar el login) → mirá `rec_login.py`.
- **Componente que no renderiza en automatización** (autocomplete) → patrón `rec_3partes.py`.
- **Video promocional** (varias pantallas, sin llenar forms) → mirá `rec_promo_operaciones_v2.py`
  / `rec_promo_nomina.py` (usan pasos con `do` que solo navegan/hacen scroll).
- **Limpiar** → se pueden borrar `raw/` y `aud/`; los `.mp4` finales quedan en la carpeta.

---

## 8. Checklist para reproducir en otra instancia

1. `pip install playwright edge-tts` + `python -m playwright install chromium` + ffmpeg en PATH.
2. Copiar la carpeta `Docs/guia-usuario/videos/` (al menos `rec_common.py` + un `rec_*.py`).
3. Ajustar en `rec_common.py`: `BASE`, login (`login_save_state`), y `reroute` si aplica.
4. Confirmar acceso al backend (por Tailscale o localhost según el caso).
5. `python rec_cliente.py` → verificar que sale el `.mp4` (~1 MB, ~1 min).
6. Enviar por Telegram con `enviar_archivo` (MCP) o adjuntar donde se necesite.

---

## 9. Instancia BusRide (2026-07-02) — motor mejorado

BusRide ya tiene su propia instancia del motor en **`docs/demos/`** (4 videos: registro/login,
panel admin, pasajero, conductor — ver `docs/DEMO.md`). Sobre el motor original se hicieron
mejoras que conviene retro-portar a los otros sistemas:

- **Screenshot automático por paso** → `img/{video}_{NN}.png`. Del MISMO run salen el video y las
  imágenes para la guía visual (documentar con imágenes deja de ser trabajo aparte). Un paso
  puede omitirse con `"shot": False`.
- **`login` parametrizable** en `make_video(..., login=(email, password))` o `login=None` para
  videos que muestran el propio login/registro (BusRide graba flujos de 3 roles distintos).
- **`geolocation` opcional** (`{"lat":…, "lng":…}`): permiso + posición fija del navegador — los
  flujos con mapa (buscar rutas, viaje del conductor) la necesitan.
- **Rutas absolutas** (relativas a `rec_common.py`, no al cwd): los scripts corren desde cualquier
  directorio.
- **Overlay re-inyectado tras cada paso**: si un `do()` navega con `pg.goto`, el overlay se pierde
  (documento nuevo); el motor lo re-inyecta y re-pinta el banner después de cada acción.
- **Siembra por API en Python** (`api.py`): port de `frontend/e2e/utils/api.ts` con `urllib`
  (stdlib, sin dependencias) — asociación → conductor → bus → ruta → asignación → viaje, datos
  únicos por corrida. Los guiones siembran su propio escenario antes de grabar; los QR, tickets y
  liquidaciones de los videos son reales.
- Sin `reroute` (todo local) y sin `set_light` (BusRide no tiene modo oscuro).

**Config BusRide:** `BASE=http://localhost:4320` (`npm start -- --port 4320`, proxy a :3002),
backend `node dist/src/main.js` con `PORT=3002`, BD del contenedor `busride_sqlserver`.
Gotcha propio: el selector "Asociación" del panel elige la primera asociación por defecto — si hay
datos viejos, seleccionar la asociación demo explícitamente (ver `_pick_asociacion` en
`rec_02_admin.py`). Los temporales `raw/`, `aud/` y `_auth_rec.json` están en `.gitignore`; los
`.mp4` finales y `img/` sí se versionan.

---

*Nota: este documento describe el motor tal como está en `rec_common.py` a la fecha. Si el motor
cambia (nuevas voces, otro selector de tema, etc.), actualizar aquí también.*
