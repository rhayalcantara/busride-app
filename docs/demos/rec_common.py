# -*- coding: utf-8 -*-
"""Motor para grabar videos demostrativos de BusRide CON VOZ + screenshots por paso.

Adaptación del motor de OperacionesRanger (ver docs/COMO_CREAMOS_VIDEOS_DEMO.md)
con estas mejoras:
- Rutas absolutas (relativas a este archivo, no al cwd).
- `login` parametrizable por video (email/password) o None para arrancar sin
  sesión (videos que muestran el login/registro).
- `geolocation` opcional (los flujos de pasajero/conductor usan el mapa).
- **Screenshot automático por paso** → docs/demos/img/ (alimenta la guía visual
  DEMO.md del mismo run que produce el video).
- Sin reroute (todo local) y sin toggle de tema (BusRide no tiene modo oscuro).

Requiere: backend en :3002, ng serve con proxy en :4320 (BASE), ffmpeg en PATH.
"""
from playwright.sync_api import sync_playwright
import time, glob, os, asyncio, subprocess
import edge_tts

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = "http://localhost:4320"
OUTDIR = os.path.join(AQUI, "raw")
AUDDIR = os.path.join(AQUI, "aud")
IMGDIR = os.path.join(AQUI, "img")
VOICE = "es-DO-EmilioNeural"     # dominicano, profesional
VOICE_FB = "es-MX-JorgeNeural"   # fallback
SUF = time.strftime("%H%M%S")


# ---------- TTS ----------
def tts(text, path):
    async def _g(voice):
        await edge_tts.Communicate(text, voice, rate="+6%").save(path)
    try:
        asyncio.run(_g(VOICE))
    except Exception:
        asyncio.run(_g(VOICE_FB))
    dur = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path]
    ).decode().strip())
    return dur


# ---------- Overlay (branding BusRide) ----------
OVERLAY_JS = r"""
() => {
  if (document.getElementById('__capbar')) return;
  const bar=document.createElement('div'); bar.id='__capbar';
  bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;'+
    'background:linear-gradient(90deg,#0b3d6b,#00a86b);color:#fff;pointer-events:none;'+
    'font:600 22px Segoe UI,Arial;padding:14px 26px;letter-spacing:.3px;'+
    'box-shadow:0 3px 12px rgba(0,0,0,.25);transition:opacity .3s;opacity:0;';
  document.body.appendChild(bar);
  const tc=document.createElement('div'); tc.id='__title';
  tc.style.cssText='position:fixed;inset:0;z-index:2147483646;display:flex;'+
    'flex-direction:column;align-items:center;justify-content:center;pointer-events:none;'+
    'background:linear-gradient(160deg,#052e1f,#0b3d6b 60%,#00a86b 150%);'+
    'color:#fff;font-family:Segoe UI,Arial;opacity:0;transition:opacity .4s;';
  tc.innerHTML='<div style="font-size:32px;letter-spacing:4px;color:#bfe2f5">🚌 BUS<b style=color:#4ade80>RIDE</b></div>'+
    '<div id="__tt" style="font-size:40px;font-weight:700;margin-top:18px"></div>'+
    '<div id="__ts" style="font-size:18px;color:#9fe6c6;margin-top:10px"></div>';
  document.body.appendChild(tc);
  window.__cap=(t)=>{const b=document.getElementById('__capbar');b.textContent=t;b.style.opacity=t?'1':'0';};
  window.__title=(t,s)=>{const c=document.getElementById('__title');document.getElementById('__tt').textContent=t||'';document.getElementById('__ts').textContent=s||'';c.style.opacity=(t!==null)?'1':'0';};
}
"""
def cap(pg, t): pg.evaluate("(t)=>window.__cap(t)", t)
def title(pg, t, s=""):
    if t is None: pg.evaluate("()=>window.__title(null)")
    else: pg.evaluate("(a)=>window.__title(a[0],a[1])", [t, s])


# ---------- login ----------
def login_save_state(b, state_path, email, password):
    """Login por la UI real (deja los tokens en localStorage → storage_state)."""
    ctx = b.new_context(viewport={"width": 1280, "height": 720})
    pg = ctx.new_page()
    pg.goto(BASE + "/login", wait_until="networkidle", timeout=30000)
    pg.get_by_label("Email").fill(email)
    pg.get_by_label("Contraseña", exact=True).fill(password)
    pg.get_by_role("button", name="Iniciar sesión").click()
    pg.wait_for_url(lambda u: "/login" not in u, timeout=15000)
    pg.wait_for_timeout(1000)
    ctx.storage_state(path=state_path)
    ctx.close()


# ---------- driver ----------
def make_video(module_route, title_text, title_sub, intro_say, steps, out_name,
               login=None, geolocation=None):
    """steps: lista de dict {cap, say, do(pg) opcional, shot opcional (False para omitir)}.

    - login: (email, password) para arrancar ya logueado, o None (muestra login/registro).
    - geolocation: dict {lat, lng} → permiso + posición fija (mapas).
    Graba, narra, captura un PNG por paso en img/ y mezcla el MP4 final.
    """
    os.makedirs(OUTDIR, exist_ok=True); os.makedirs(AUDDIR, exist_ok=True)
    os.makedirs(IMGDIR, exist_ok=True)
    state = os.path.join(AQUI, "_auth_rec.json")

    # 1) pre-generar TTS
    clips = []  # (path, dur)
    intro_clip = os.path.join(AUDDIR, f"{out_name}_intro.mp3"); intro_dur = tts(intro_say, intro_clip)
    for i, s in enumerate(steps):
        cp = os.path.join(AUDDIR, f"{out_name}_{i}.mp3"); d = tts(s["say"], cp); clips.append((cp, d))
    print("TTS listo:", out_name, "intro", round(intro_dur, 1), "pasos", [round(d, 1) for _, d in clips])

    timeline = []  # (offset_seconds, clip_path)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx_kwargs = dict(viewport={"width": 1280, "height": 720},
                          record_video_dir=OUTDIR,
                          record_video_size={"width": 1280, "height": 720},
                          locale="es-DO")
        if login:
            login_save_state(b, state, login[0], login[1])
            ctx_kwargs["storage_state"] = state
        if geolocation:
            ctx_kwargs["geolocation"] = {"latitude": geolocation["lat"], "longitude": geolocation["lng"]}
            ctx_kwargs["permissions"] = ["geolocation"]
        ctx = b.new_context(**ctx_kwargs)
        pg = ctx.new_page()
        t0 = time.monotonic()
        pg.goto(BASE + module_route, wait_until="networkidle", timeout=45000); pg.wait_for_timeout(1500)
        pg.evaluate(OVERLAY_JS)
        # TITULO + intro narracion
        timeline.append((time.monotonic() - t0, intro_clip))
        title(pg, title_text, title_sub)
        pg.wait_for_timeout(int(intro_dur * 1000) + 500)
        title(pg, None); pg.wait_for_timeout(500)
        # PASOS
        for i, s in enumerate(steps):
            cp, dur = clips[i]
            start = time.monotonic()
            timeline.append((start - t0, cp))
            pg.evaluate(OVERLAY_JS)   # re-inyectar si hubo navegación full-page
            cap(pg, s["cap"])
            if s.get("do"):
                try: s["do"](pg)
                except Exception as e: print(f"  paso {i} do() err: {str(e)[:120]}")
            pg.evaluate(OVERLAY_JS); cap(pg, s["cap"])  # tras navegar, el overlay se pierde
            # asegurar que el paso dure al menos la narracion
            elapsed = time.monotonic() - start
            remain = dur + 0.4 - elapsed
            if remain > 0: pg.wait_for_timeout(int(remain * 1000))
            # screenshot del paso (UI ya asentada) → guía visual
            if s.get("shot", True):
                try:
                    pg.screenshot(path=os.path.join(IMGDIR, f"{out_name}_{i:02d}.png"))
                except Exception as e:
                    print(f"  paso {i} screenshot err: {str(e)[:80]}")
        cap(pg, ""); pg.wait_for_timeout(400)
        ctx.close(); b.close()

    webm = sorted(glob.glob(os.path.join(OUTDIR, "*.webm")), key=os.path.getmtime)[-1]
    out = os.path.join(AQUI, f"{out_name}.mp4")
    _mux(webm, timeline, out)
    print("VIDEO FINAL:", out)
    return out


def _mux(webm, timeline, out):
    """Convierte webm->mp4 y superpone los clips de voz en sus offsets."""
    inputs = ["-i", webm]
    for _, cp in timeline: inputs += ["-i", cp]
    fc = []; mixed = []
    for idx, (off, _) in enumerate(timeline, start=1):
        ms = max(0, int(off * 1000))
        fc.append(f"[{idx}:a]adelay={ms}|{ms}[a{idx}]"); mixed.append(f"[a{idx}]")
    fc.append("".join(mixed) + f"amix=inputs={len(timeline)}:normalize=0[aout]")
    cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fc),
           "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-shortest", out]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
