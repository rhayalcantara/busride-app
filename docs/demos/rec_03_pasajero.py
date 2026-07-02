# -*- coding: utf-8 -*-
"""Video 03: flujo del pasajero — wallet, buscar ruta en el mapa, reservar y QR.

Siembra: escenario completo con viaje EN CURSO (para que la búsqueda encuentre
la ruta) y un pasajero nuevo sin saldo (la compra se hace EN VIVO en la UI).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rec_common as rc
import api

SUF = api.sufijo_unico()
print("Sembrando escenario demo (viaje en curso)…")
ESC = api.sembrar_escenario(SUF, iniciar_viaje=True)
PASAJERO = api.registrar_pasajero(SUF)
print("Escenario:", ESC["rutaNombre"], "| pasajero:", PASAJERO["email"])


def _comprar(pg):
    card = pg.locator(".wallet__paquete", has_text="Paquete Básico")
    card.get_by_role("button", name="Comprar").click()
    pg.wait_for_timeout(1200)
    pg.get_by_role("dialog").get_by_role("button", name="Comprar").click()
    pg.wait_for_timeout(2500)


def _ir_buscar(pg):
    pg.goto(rc.BASE + "/pasajero", wait_until="networkidle")
    pg.wait_for_timeout(2500)


def _buscar(pg):
    mapa = pg.locator("app-mapa")
    caja = mapa.bounding_box()
    mapa.click(position={"x": caja["width"] / 2 + 100, "y": caja["height"] / 2 + 100})
    pg.wait_for_timeout(800)
    pg.get_by_label("Radio de búsqueda").click()
    pg.wait_for_timeout(600)
    pg.get_by_role("option", name="2000 m").click()
    pg.wait_for_timeout(600)
    pg.get_by_role("button", name="Buscar rutas").click()
    pg.wait_for_timeout(2500)


def _abrir_ruta(pg):
    pg.locator(".buscar__card", has_text=ESC["rutaNombre"]).click()
    pg.wait_for_timeout(2000)


def _reservar(pg):
    pg.get_by_role("button", name="Reservar", exact=True).click()
    pg.wait_for_timeout(2500)
    pg.get_by_role("button", name="Reservar y generar QR").click()
    pg.wait_for_timeout(3000)


steps = [
    {"cap": "Tu wallet — saldo en viajes",
     "say": "Como pasajero, lo primero es tener saldo. En tu wallet ves tus viajes disponibles: ahora mismo, cero."},
    {"cap": "Paso 1:  comprar un paquete",
     "say": "Compramos el Paquete Básico: presiona Comprar, confirma, y el saldo se acredita al instante. Ya tenemos diez viajes.", "do": _comprar},
    {"cap": "Buscar rutas cerca de ti",
     "say": "Ahora busquemos una ruta. El mapa parte de tu ubicación real, marcada en el centro.", "do": _ir_buscar},
    {"cap": "Paso 2:  destino, radio y buscar",
     "say": "Marca tu destino con un clic en el mapa, ajusta el radio de búsqueda, y presiona Buscar rutas. El sistema encuentra las rutas activas que te sirven.", "do": _buscar},
    {"cap": "Paso 3:  elige tu ruta",
     "say": "Aquí está nuestra ruta, con su tarifa y los asientos disponibles. La abrimos para ver el detalle con sus paradas.", "do": _abrir_ruta},
    {"cap": "Paso 4:  reservar",
     "say": "Presionamos Reservar. Las paradas de origen y destino ya vienen seleccionadas desde la búsqueda, así que solo confirmamos y generamos el QR.", "do": _reservar},
    {"cap": "✓ Tu QR de abordaje — válido por 5 minutos",
     "say": "Y listo: este es tu código QR de abordaje, válido por cinco minutos. Se lo muestras al conductor al subir al bus, y él lo escanea para confirmar tu asiento."},
]

rc.make_video(
    module_route="/pasajero/wallet",
    title_text="Viajar como pasajero",
    title_sub="Wallet · Buscar ruta · Reservar con QR",
    intro_say="Veamos el flujo completo del pasajero en BusRide: comprar saldo, encontrar una ruta cerca, y reservar tu asiento con un código QR.",
    steps=steps,
    out_name="03_pasajero",
    login=(PASAJERO["email"], PASAJERO["password"]),
    geolocation=api.PUNTO_BASE,
)
