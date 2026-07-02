# -*- coding: utf-8 -*-
"""Siembra de datos demo por la API real de BusRide (puerto del backend, sin proxy).

Es el port a Python de frontend/e2e/utils/api.ts: mismo orden, mismas lecciones
(rnc SIEMPRE único — la columna UNIQUE de SQL Server solo admite un null;
datos únicos por corrida vía sufijo).
"""
import json
import time
import urllib.error
import urllib.request

API = "http://localhost:3002/api/v1"
ADMIN = {"email": "admin@busride.do", "password": "Admin123!cambiar"}
PASSWORD_DEMO = "Demo2026!segura"
# Punto fijo de los escenarios geoespaciales (Santo Domingo)
PUNTO_BASE = {"lat": 18.4861, "lng": -69.9312}
# Roles según el seed de la BD (orden de inserción en 02_schema.sql)
ROL = {"admin": 1, "asociacion": 2, "conductor": 3, "pasajero": 4}


def req(metodo, ruta, token=None, data=None):
    r = urllib.request.Request(API + ruta, method=metodo.upper())
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    cuerpo = json.dumps(data).encode() if data is not None else None
    try:
        with urllib.request.urlopen(r, cuerpo) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{metodo.upper()} {ruta} → {e.code}: {e.read().decode()[:300]}") from e


def login(email, password):
    """Devuelve la respuesta completa del login (accessToken, refreshToken, usuario)."""
    return req("post", "/auth/login", data={"email": email, "password": password})


def sembrar_escenario(sufijo, iniciar_viaje=False):
    """Asociación aprobada → conductor → bus → ruta con 3 paradas → asignación.

    Nombres legibles (salen en pantalla en los videos). Devuelve un dict con
    ids, credenciales del conductor y las paradas ordenadas.
    """
    admin = login(ADMIN["email"], ADMIN["password"])["accessToken"]

    usuario_asoc = req("post", "/auth/usuarios", admin, {
        "email": f"demo.asoc.{sufijo}@busride.do",
        "password": PASSWORD_DEMO,
        "nombre": "Transporte Unido",
        "apellido": "Demo",
        "rolId": ROL["asociacion"],
    })
    asociacion = req("post", "/asociaciones", admin, {
        "usuarioId": usuario_asoc["usuarioId"],
        "nombre": f"Transporte Unido Demo {sufijo}",
        "rnc": f"DEMO-{sufijo}",
        "comisionPct": 5,
    })
    req("patch", f"/asociaciones/{asociacion['id']}/aprobar", admin, {})

    email_conductor = f"demo.conductor.{sufijo}@busride.do"
    usuario_conductor = req("post", "/auth/usuarios", admin, {
        "email": email_conductor,
        "password": PASSWORD_DEMO,
        "nombre": "Carlos",
        "apellido": "Demo",
        "rolId": ROL["conductor"],
    })
    alta = req("post", "/conductores", admin, {
        "usuarioId": usuario_conductor["usuarioId"],
        "asociacionId": asociacion["id"],
        "licenciaNumero": f"LIC-DEMO-{sufijo}",
        "licenciaVence": "2030-12-31",
    })
    conductor_id = alta["conductor"]["id"]

    bus = req("post", "/flota/buses", admin, {
        "asociacionId": asociacion["id"],
        "placa": f"DEM-{sufijo[-6:]}",
        "capacidadTotal": 20,
    })

    ruta_nombre = f"Ruta Centro Demo {sufijo}"
    ruta = req("post", "/rutas", admin, {
        "asociacionId": asociacion["id"],
        "nombre": ruta_nombre,
        "tarifa": 50,
        "paradas": [
            {"nombre": "Terminal Parque Central", "orden": 1,
             "lat": PUNTO_BASE["lat"], "lng": PUNTO_BASE["lng"], "esTerminal": True},
            {"nombre": "Parada Avenida Duarte", "orden": 2,
             "lat": PUNTO_BASE["lat"] - 0.0045, "lng": PUNTO_BASE["lng"] + 0.0045},
            {"nombre": "Terminal Zona Sur", "orden": 3,
             "lat": PUNTO_BASE["lat"] - 0.009, "lng": PUNTO_BASE["lng"] + 0.009, "esTerminal": True},
        ],
    })
    paradas = sorted(req("get", f"/rutas/{ruta['id']}/paradas", admin), key=lambda p: p["orden"])

    asignacion = req("post", "/flota/asignaciones", admin, {
        "busId": bus["id"],
        "rutaId": ruta["id"],
        "conductorId": conductor_id,
    })

    escenario = {
        "sufijo": sufijo,
        "asociacionId": asociacion["id"],
        "conductor": {"email": email_conductor, "password": PASSWORD_DEMO, "conductorId": conductor_id},
        "busId": bus["id"],
        "rutaId": ruta["id"],
        "rutaNombre": ruta_nombre,
        "asignacionId": asignacion["id"],
        "paradas": paradas,
    }

    if iniciar_viaje:
        token_conductor = login(email_conductor, PASSWORD_DEMO)["accessToken"]
        viaje = req("post", "/viajes/iniciar", token_conductor, {"asignacionId": asignacion["id"]})
        req("patch", f"/viajes/{viaje['id']}/posicion", token_conductor, PUNTO_BASE)
        escenario["viajeId"] = viaje["id"]

    return escenario


def registrar_pasajero(sufijo, nombre="María", apellido="Demo"):
    email = f"demo.pasajero.{sufijo}@correo.com"
    req("post", "/auth/registrar", data={
        "email": email, "password": PASSWORD_DEMO, "nombre": nombre, "apellido": apellido,
    })
    return {"email": email, "password": PASSWORD_DEMO}


def comprar_paquete(token_pasajero, sufijo):
    paquetes = req("get", "/wallet/paquetes", token_pasajero)
    req("post", "/wallet/comprar", token_pasajero, {
        "paqueteId": paquetes[0]["id"],
        "referenciaExterna": f"DEMO-PAGO-{sufijo}",
    })


def viaje_activo(token_conductor):
    return req("get", "/viajes/mi-activo", token_conductor)


def crear_reserva(token_pasajero, viaje_id, parada_origen_id, parada_destino_id):
    return req("post", "/reservas", token_pasajero, {
        "viajeId": viaje_id,
        "paradaOrigenId": parada_origen_id,
        "paradaDestinoId": parada_destino_id,
        "latPasajero": PUNTO_BASE["lat"],
        "lngPasajero": PUNTO_BASE["lng"],
    })


def sufijo_unico():
    return time.strftime("%H%M%S")
