# -*- coding: utf-8 -*-
"""Video 01: registro de pasajero e inicio de sesión (arranca SIN sesión)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rec_common as rc
import api

EMAIL = f"demo.registro.{rc.SUF}@correo.com"


def _ir_registro(pg):
    pg.get_by_role("link", name="Regístrate como pasajero").click()
    pg.wait_for_timeout(1800)


def _llenar(pg):
    pg.get_by_label("Nombre").fill("María")
    pg.wait_for_timeout(300)
    pg.get_by_label("Apellido").fill("Demo")
    pg.wait_for_timeout(300)
    pg.get_by_label("Email").fill(EMAIL)
    pg.wait_for_timeout(300)
    pg.get_by_label("Contraseña", exact=True).fill("Demo2026!segura")
    pg.wait_for_timeout(300)


def _crear(pg):
    pg.get_by_role("button", name="Crear cuenta").click()
    pg.wait_for_timeout(3500)


def _salir(pg):
    pg.get_by_role("button", name="Cerrar sesión").click()
    pg.wait_for_timeout(2000)


steps = [
    {"cap": "Pantalla de inicio de sesión",
     "say": "Esta es la pantalla de entrada de BusRide. Si ya tienes cuenta, entras con tu correo y contraseña."},
    {"cap": "Paso 1:  Regístrate como pasajero",
     "say": "Si eres nuevo, presiona Regístrate como pasajero.", "do": _ir_registro},
    {"cap": "Paso 2:  completa tus datos",
     "say": "Completa tu nombre, apellido, correo, y una contraseña de al menos ocho caracteres.", "do": _llenar},
    {"cap": "Paso 3:  Crear cuenta",
     "say": "Presiona Crear cuenta. El sistema te registra y te deja dentro automáticamente.", "do": _crear},
    {"cap": "✓ ¡Bienvenida! Esta es tu área de pasajero",
     "say": "Listo. Ya estás en tu área de pasajero, con el mapa para buscar rutas cerca de ti."},
    {"cap": "Cerrar sesión",
     "say": "Cuando termines, cierras sesión desde el botón de arriba y vuelves a la pantalla de entrada.", "do": _salir},
]

rc.make_video(
    module_route="/login",
    title_text="Crear tu cuenta",
    title_sub="Registro de pasajero e inicio de sesión",
    intro_say="Bienvenido a BusRide, la plataforma de rutas y abordaje de autobuses. Veamos cómo crear tu cuenta de pasajero.",
    steps=steps,
    out_name="01_registro_login",
    login=None,
    geolocation=api.PUNTO_BASE,
)
