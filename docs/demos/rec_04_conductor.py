# -*- coding: utf-8 -*-
"""Video 04: flujo del conductor — iniciar viaje, abordar con QR/token, finalizar
y ver la liquidación.

Siembra: escenario SIN viaje (el conductor lo inicia EN VIVO en la UI) y un
pasajero con saldo. La reserva del pasajero se crea por API en medio del video
(igual que el e2e): el token del QR se pega en el fallback manual del escáner.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rec_common as rc
import api

SUF = api.sufijo_unico()
print("Sembrando escenario demo (sin viaje)…")
ESC = api.sembrar_escenario(SUF, iniciar_viaje=False)
PASAJERO = api.registrar_pasajero(SUF)
TOKEN_PASAJERO = api.login(PASAJERO["email"], PASAJERO["password"])["accessToken"]
api.comprar_paquete(TOKEN_PASAJERO, SUF)
print("Escenario:", ESC["rutaNombre"], "| pasajero con saldo:", PASAJERO["email"])

RESERVA = {}


def _iniciar(pg):
    card = pg.locator("mat-card", has_text=ESC["rutaNombre"])
    card.get_by_role("button", name="Iniciar viaje").click()
    pg.wait_for_timeout(3000)


def _abordar(pg):
    # El pasajero reserva por API en el viaje recién iniciado → qrToken real
    token_conductor = api.login(ESC["conductor"]["email"], ESC["conductor"]["password"])["accessToken"]
    viaje = api.viaje_activo(token_conductor)
    RESERVA.update(api.crear_reserva(
        TOKEN_PASAJERO, viaje["id"], ESC["paradas"][0]["id"], ESC["paradas"][-1]["id"]))
    pg.goto(rc.BASE + "/conductor/abordar", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    pg.get_by_label("Token del QR").fill(RESERVA["qrToken"])
    pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Usar este token").click()
    pg.wait_for_timeout(1500)


def _confirmar(pg):
    pg.get_by_label("Número de asiento").fill("5")
    pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Confirmar abordaje").click()
    pg.wait_for_timeout(2500)


def _ir_finalizar(pg):
    pg.goto(rc.BASE + "/conductor/finalizar", wait_until="networkidle")
    pg.wait_for_timeout(2000)


def _finalizar(pg):
    pg.get_by_role("button", name="Finalizar viaje").click()
    pg.wait_for_timeout(1200)
    pg.get_by_role("dialog").get_by_role("button", name="Finalizar", exact=True).click()
    pg.wait_for_timeout(3000)


def _liquidaciones(pg):
    pg.goto(rc.BASE + "/conductor/liquidaciones", wait_until="networkidle")
    pg.wait_for_timeout(2500)


steps = [
    {"cap": "Mis asignaciones",
     "say": "El conductor entra y ve sus asignaciones: el bus, la ruta y el horario que le tocan."},
    {"cap": "Paso 1:  iniciar el viaje",
     "say": "Para empezar a trabajar, presiona Iniciar viaje en su asignación activa.", "do": _iniciar},
    {"cap": "Viaje en curso — posición y asientos en vivo",
     "say": "Esta es su pantalla de viaje: el mapa con su posición, que se transmite en tiempo real a los pasajeros, las paradas de la ruta, y los asientos libres."},
    {"cap": "Paso 2:  abordar — escanear o pegar el token",
     "say": "Un pasajero acaba de reservar y llega con su QR. El conductor lo escanea con la cámara, o pega el token manualmente, como hacemos aquí.", "do": _abordar},
    {"cap": "Paso 3:  asignar asiento y confirmar",
     "say": "Asignamos el asiento número cinco y confirmamos. El sistema valida el QR, descuenta el viaje de la wallet, y emite el ticket.", "do": _confirmar},
    {"cap": "✓ ¡Abordaje confirmado!",
     "say": "Abordaje confirmado: ticket emitido, asiento cinco ocupado, y el contador de asientos libres se actualiza al instante.", "shot": True},
    {"cap": "Paso 4:  finalizar el viaje",
     "say": "Al terminar el recorrido, el conductor va a Finalizar viaje, donde ve el resumen de pasajeros abordados.", "do": _ir_finalizar},
    {"cap": "✓ Liquidación generada",
     "say": "Confirma, y el sistema genera la liquidación automáticamente: el monto bruto, las comisiones de la plataforma y de la asociación, y el neto del conductor.", "do": _finalizar},
    {"cap": "Historial de liquidaciones",
     "say": "Todas sus liquidaciones quedan en su historial, con el resumen por período. Así de simple es operar con BusRide.", "do": _liquidaciones},
]

rc.make_video(
    module_route="/conductor",
    title_text="Operar como conductor",
    title_sub="Iniciar viaje · Abordar con QR · Liquidación",
    intro_say="Ahora veamos el día de trabajo de un conductor en BusRide: iniciar su viaje, abordar pasajeros con código QR, y cobrar su liquidación.",
    steps=steps,
    out_name="04_conductor",
    login=(ESC["conductor"]["email"], ESC["conductor"]["password"]),
    geolocation=api.PUNTO_BASE,
)
