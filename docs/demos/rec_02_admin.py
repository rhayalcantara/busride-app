# -*- coding: utf-8 -*-
"""Video 02: panel de administración (usuarios, asociaciones, flota, rutas).

Siembra por API un escenario completo (asociación aprobada, conductor, bus,
ruta con paradas, asignación) para que los listados tengan datos reales, y
además registra un bus EN VIVO desde la UI.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rec_common as rc
import api

SUF = api.sufijo_unico()
print("Sembrando escenario demo…")
ESC = api.sembrar_escenario(SUF, iniciar_viaje=False)
print("Escenario:", ESC["rutaNombre"])

PLACA_UI = f"UI-{SUF}"


def _nav(nombre):
    def _do(pg):
        pg.get_by_role("link", name=nombre).click()
        pg.wait_for_timeout(2500)
    return _do


def _pick_asociacion(pg):
    """Selecciona la asociación demo en el selector de contexto del panel."""
    pg.get_by_label("Asociación").click()
    pg.wait_for_timeout(800)
    pg.get_by_role("option", name=f"Transporte Unido Demo {SUF}").click()
    pg.wait_for_timeout(2000)


def _flota_demo(pg):
    _nav("Flota")(pg)
    _pick_asociacion(pg)


def _rutas_demo(pg):
    _nav("Rutas")(pg)
    _pick_asociacion(pg)


def _crear_bus(pg):
    pg.get_by_role("button", name="Registrar bus").click()
    pg.wait_for_timeout(1200)
    dlg = pg.get_by_role("dialog")
    dlg.get_by_label("Placa").fill(PLACA_UI)
    pg.wait_for_timeout(300)
    dlg.get_by_label("Capacidad total (asientos)").fill("25")
    pg.wait_for_timeout(300)
    dlg.get_by_role("button", name="Registrar", exact=True).click()
    pg.wait_for_timeout(2500)


steps = [
    {"cap": "Usuarios — todas las cuentas del sistema",
     "say": "Al entrar como administrador llegas al panel. La primera sección es Usuarios: aquí ves todas las cuentas, puedes activarlas, desactivarlas o crear usuarios con roles privilegiados."},
    {"cap": "Asociaciones de transporte",
     "say": "En Asociaciones se registran y aprueban las asociaciones de transporte. Cada una tiene su RNC y su porcentaje de comisión.", "do": _nav("Asociaciones")},
    {"cap": "Conductores — licencias y calificación",
     "say": "En Conductores se da de alta a cada conductor con su licencia, y se ve su calificación promedio.", "do": _nav("Conductores")},
    {"cap": "Flota — buses, horarios y asignaciones",
     "say": "En Flota administras los buses de cada asociación, los horarios, y las asignaciones de bus, ruta y conductor. Elegimos nuestra asociación en el selector.", "do": _flota_demo},
    {"cap": "Registrar un bus nuevo",
     "say": "Registremos un bus. Presionamos Registrar bus, escribimos la placa y la capacidad de asientos, y guardamos. El bus aparece de inmediato en el listado.", "do": _crear_bus},
    {"cap": "Rutas — recorridos, paradas y tarifas",
     "say": "Y en Rutas se crean los recorridos: cada ruta tiene sus paradas dibujadas en el mapa, y su tarifa por viaje.", "do": _rutas_demo},
    {"cap": "✓ Panel de administración",
     "say": "Con esto la operación queda lista: asociación, conductor, bus, ruta y asignación. Todo desde el panel de BusRide."},
]

rc.make_video(
    module_route="/panel",
    title_text="Panel de administración",
    title_sub="Usuarios · Asociaciones · Conductores · Flota · Rutas",
    intro_say="Ahora veamos el panel de administración de BusRide, donde se gestiona toda la operación del sistema.",
    steps=steps,
    out_name="02_panel_admin",
    login=(api.ADMIN["email"], api.ADMIN["password"]),
)
