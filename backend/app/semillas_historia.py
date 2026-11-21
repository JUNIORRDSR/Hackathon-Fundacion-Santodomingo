"""Historia de demostración, ficticia (Ley 1581): tres meses de recolecciones, canjes, rutas y el día de hoy lleno.
Escribe directo en las tablas para fechar en el pasado, sin avisos de WhatsApp. Corre una vez (SEMBRAR_HISTORIA=1)."""
import logging
import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, insert, select

from app.compartido.bd import transaccion
from app.compartido.formato import HORA_COLOMBIA
from app.compartido.tipos import COLECTIVO_DEL_FLUJO, Colectivo, Flujo
from app.modulos.acceso import contrato as acceso
from app.modulos.directorio import contrato as directorio
from app.modulos.directorio import tablas as td
from app.modulos.puntos import contrato as puntos
from app.modulos.puntos import tablas as tp
from app.modulos.puntos.dominio import Regla
from app.modulos.solicitudes import tablas as ts

azar = random.Random(2026)
DIAS = 95
NOMBRES = ("Marta", "José", "Camila", "Luis", "Yolanda", "Andrés", "Diana", "Carlos", "Paola", "Jorge", "Liliana",
           "Ricardo", "Sandra", "Javier", "Gloria", "Fernando", "Natalia", "Héctor", "Adriana", "Wilson", "Patricia",
           "Édgar", "Claudia", "Mauricio")
APELLIDOS = ("Salcedo", "Rincón", "Torres", "Mejía", "Pineda", "Ríos", "Gómez", "Cruz", "Rojas", "Ortega", "Ariza",
             "Pacheco", "Barrios", "Castro", "Polo", "Charris", "Escorcia", "De la Hoz", "Vargas", "Molina")
NEGOCIOS = ("Asadero El Sabrosón", "Jugos La Esquina", "Minimercado San Pablo", "Comidas Rápidas Mi Barrio",
            "Verdulería La Cosecha", "Restaurante Doña Chepa", "Panadería La Espiga", "Cafetería El Tinto",
            "Fritos La Bendición", "Papelería El Estudiante", "Heladería Polo Norte", "Carnicería El Novillo")
NUEVOS = ("Iván Charris", "Mónica Escorcia", "Rafael De la Hoz", "Daniela Vargas", "Kelly Molina", "Álvaro Peña")
ENCARGADOS = {Colectivo.HUERTEROS: ("Luz Marina Ortega", "Wilmer Ariza", "Yolanda Pacheco"),
              Colectivo.RECICLADORES: ("Edwin Barrios", "Nelly Castro", "Óscar Polo")}
PREMIOS = (("Kit de semillas de hortalizas", 35), ("Bolsa de tela EcoConecta", 70), ("Planta aromática en matera", 90),
           ("Canasta de hortalizas de la huerta", 120), ("Termo EcoConecta", 150), ("Compostera doméstica", 250))
MOTIVOS = ("Venían mezclados con plástico y vidrio", "La bolsa traía residuos sanitarios",
           "Material húmedo y con restos de comida", "Traía icopor y empaques metalizados")
KILOS = {(Flujo.ORGANICO, "hogar"): (2.0, 7.5), (Flujo.ORGANICO, "unidad_productiva"): (12.0, 34.0),
         (Flujo.RECICLABLE, "hogar"): (1.5, 6.0), (Flujo.RECICLABLE, "unidad_productiva"): (8.0, 26.0)}
HORAS = [f"{h:02d}:{m:02d}" for h in range(7, 18) for m in (0, 30)]
# El cronograma de hoy, de punta a punta; repartido por turnos entre los encargados de cada colectivo.
TURNOS = ("07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:30", "14:00",
          "14:30", "15:00", "15:30", "16:00", "16:30", "17:00")
# Rutas semanales por zona: días (0 = lunes) y franja.
HORARIOS = (([0, 3], "07:00", "09:30"), ([1, 4], "09:00", "11:30"), ([2, 5], "13:30", "16:00"),
            ([0, 2, 4], "15:00", "17:30"), ([1, 3, 5], "07:30", "10:00"))


def sembrar() -> None:
    """Todo en una transacción (los contratos se unen a ella): si algo falla no queda media historia, y la app arranca
    igual, porque la demo nunca debe tumbar la operación."""
    try:
        with transaccion():
            if not directorio.solicitante_por_telefono(_telefono(1, 0)):
                _sembrar(datetime.now(HORA_COLOMBIA))
    except Exception:
        logging.getLogger("ecoconecta").exception("No se pudo sembrar la historia de demostración")


def _sembrar(ahora: datetime) -> None:
    lugares = _lugares()
    equipo = _encargados(lugares)
    vecinos = _vecinos(lugares, ahora)
    _premios()
    _rutas(equipo)
    coordinadores = {u.colectivo: u.id for u in acceso.listar_usuarios() if u.colectivo}
    filas = _historia(vecinos, equipo, coordinadores, ahora) + _agenda(vecinos, equipo, coordinadores, ahora)
    with transaccion() as c:
        for flujo in Flujo:
            propias = [f for f in filas if f["flujo"] == flujo]
            for fila, numero in zip(propias, _consecutivos(c, ts.consecutivos[flujo], len(propias))):
                fila["codigo"] = f"{'ORG' if flujo == Flujo.ORGANICO else 'REC'}-{numero:04d}"
        c.execute(insert(ts.solicitudes), filas)
        _canjes(c, vecinos, _puntos(c, filas), ahora)


def _telefono(serie: int, n: int) -> str:
    return f"+57300000{serie}{n:03d}"


def _consecutivos(c, secuencia, cantidad: int) -> list[int]:
    if not cantidad:
        return []
    return list(c.execute(select(secuencia.next_value()).select_from(func.generate_series(1, cantidad))).scalars())


def _lugares() -> list[tuple]:
    """(zona, conjunto) de cada conjunto activo, o (zona, None) si la zona no tiene conjuntos."""
    lugares = []
    for zona in directorio.zonas():
        if zona.activo:
            lugares += [(zona.id, c.id) for c in zona.conjuntos if c.activo] or [(zona.id, None)]
    return lugares


def _encargados(lugares) -> dict:
    """Suma encargados con nombre a los que ya existan; cada uno cubre su parte del barrio."""
    for colectivo, nombres in ENCARGADOS.items():
        existentes = {e.nombre for e in directorio.encargados(colectivo)}
        for i, nombre in enumerate(nombres):
            parte = [conjunto or zona for zona, conjunto in lugares[i::len(nombres)]]
            if nombre not in existentes:
                directorio.registrar_encargado(directorio.NuevoEncargado(nombre=nombre, colectivo=colectivo,
                                                                         lugares=parte))
    return {col: [e for e in directorio.encargados(col) if e.activo] for col in Colectivo}


def _vecinos(lugares, ahora: datetime) -> list[dict]:
    """Hogares y negocios habilitados hace meses, y unos pocos que se acaban de registrar por WhatsApp."""
    datos = [(f"{NOMBRES[i % len(NOMBRES)]} {APELLIDOS[i * 7 % len(APELLIDOS)]}", "hogar") for i in range(44)]
    datos += [(nombre, "unidad_productiva") for nombre in NEGOCIOS]
    hace = ahora - timedelta(days=DIAS + 10)
    vecinos = [_vecino(1, i, dato, azar.choice(lugares), hace) for i, dato in enumerate(datos)]
    nuevos = [_vecino(2, i, (nombre, "hogar"), azar.choice(lugares), ahora - timedelta(hours=3 * i + 1))
              for i, nombre in enumerate(NUEVOS)]
    with transaccion() as c:
        c.execute(insert(td.solicitantes), vecinos + nuevos)
    return vecinos


def _vecino(serie: int, i: int, dato: tuple, lugar: tuple, autorizo: datetime) -> dict:
    (nombre, tipo), (zona_id, conjunto_id) = dato, lugar
    casa = f"Torre {i % 9 + 1} apto {azar.randint(1, 6)}0{azar.randint(1, 4)}" if i % 2 else f"Casa {i + 3}"
    return {"id": uuid4(), "telefono": _telefono(serie, i), "nombre": nombre, "tipo": tipo, "zona_id": zona_id,
            "conjunto_id": conjunto_id, "direccion": f"Local {i + 1}" if tipo == "unidad_productiva" else casa,
            "estado": "pendiente" if serie == 2 else "habilitado", "autorizo_en": autorizo, "registrado_por": None}


def _premios() -> None:
    existentes = {p.nombre for p in puntos.premios()}
    for nombre, costo in PREMIOS:
        if nombre not in existentes:
            puntos.guardar_premio(puntos.NuevoPremio(nombre=nombre, costo=costo))


def _rutas(equipo: dict) -> None:
    """Una ruta semanal publicada por zona y colectivo: el horario público y la vista de rutas quedan completos."""
    existentes = {r.nombre for r in directorio.rutas(None)}
    zonas = [z for z in directorio.zonas() if z.activo]
    for colectivo, residuo in ((Colectivo.HUERTEROS, "orgánicos"), (Colectivo.RECICLADORES, "reciclables")):
        for i, zona in enumerate(zonas):
            dias, inicio, fin = HORARIOS[(i + (colectivo == Colectivo.RECICLADORES) * 2) % len(HORARIOS)]
            nombre = f"{zona.nombre} · {residuo}"
            if nombre not in existentes and equipo[colectivo]:
                directorio.crear_ruta(directorio.DatosRuta(
                    nombre=nombre, colectivo=colectivo, dias=dias, hora_inicio=inicio, hora_fin=fin,
                    encargado_id=equipo[colectivo][i % len(equipo[colectivo])].id, zona_id=zona.id, publicada=True))


def _historia(vecinos, equipo, coordinadores, ahora: datetime) -> list[dict]:
    """Cada día pasado, unas solicitudes por flujo; cada vez más, porque el piloto crece, y menos el fin de semana."""
    filas = []
    for atras in range(DIAS, 0, -1):
        dia = ahora.date() - timedelta(days=atras)
        ritmo = (0.45 + 0.55 * (DIAS - atras) / DIAS) * (1, 1, 1, 1, 1, 0.75, 0.3)[dia.weekday()]
        for flujo, base in ((Flujo.ORGANICO, 6), (Flujo.RECICLABLE, 5)):
            gente = equipo[COLECTIVO_DEL_FLUJO[flujo]]
            for _ in range(max(0, round(base * ritmo + azar.uniform(-1, 1)))):
                vecino = azar.choice(vecinos)
                lugar = vecino["conjunto_id"] or vecino["zona_id"]
                encargado = azar.choice([e for e in gente if lugar in e.lugares] or gente)
                fila = _programada(vecino, flujo, encargado, coordinadores, (dia, azar.choice(HORAS)))
                filas.append(_cerrar(fila, azar.choices(("recolectada", "rechazada", "cancelada"), (88, 8, 4))[0]))
    return filas


def _agenda(vecinos, equipo, coordinadores, ahora: datetime) -> list[dict]:
    """Hoy lleno de punta a punta, lo de ayer que falta validar, lo programado para mañana y lo que espera asignación.
    Cada solicitud abierta es de un vecino distinto por flujo (una abierta por vecino y flujo)."""
    filas, hoy = [], ahora.date()
    for flujo in Flujo:
        libres = iter(azar.sample(vecinos, len(vecinos)))
        gente = equipo[COLECTIVO_DEL_FLUJO[flujo]]
        planes = [(hoy, hora) for hora in TURNOS] + [(hoy - timedelta(days=1), h) for h in ("08:30", "10:00", "15:30")]
        planes += [(hoy + timedelta(days=1), h) for h in ("07:30", "08:30", "10:00", "14:00", "15:00", "16:30")]
        planes += [(hoy + timedelta(days=2), h) for h in ("08:00", "09:30", "14:30", "16:00")]
        for i, (dia, hora) in enumerate(planes):
            fila = _programada(next(libres), flujo, gente[i % len(gente)], coordinadores, (dia, hora))
            pasada = _momento(dia, hora) < ahora - timedelta(minutes=20)
            estado = azar.choices(("recolectada", "rechazada", "programada"), (6, 1, 3))[0] if pasada else ""
            filas.append(_cerrar(fila, estado) if dia == hoy and estado != "programada" and pasada else fila)
        filas += [_recibida(next(libres), flujo, ahora - timedelta(hours=2 * i + 1)) for i in range(5)]
    return filas


def _momento(dia: date, hora: str) -> datetime:
    return datetime.combine(dia, time.fromisoformat(hora), HORA_COLOMBIA)


def _cambio(momento: datetime, estado: str, por: str, nota: str = "") -> dict:
    return {"fecha": momento.isoformat(), "estado": estado, "por": por, "nota": nota}


def _recibida(vecino: dict, flujo: Flujo, momento: datetime) -> dict:
    """Llegó por WhatsApp y espera encargado y hora."""
    return {"id": uuid4(), "codigo": "", "solicitante_id": vecino["id"], "flujo": flujo.value,
            "zona_id": vecino["zona_id"], "conjunto_id": vecino["conjunto_id"], "direccion": vecino["direccion"],
            "preferencia": "manana" if momento.hour < 12 else "tarde" if momento.hour < 18 else "noche",
            "observaciones": "", "canal": azar.choices(("whatsapp", "asistido"), (85, 15))[0], "estado": "recibida",
            "encargado_id": None, "asignada_por": None, "dia": None, "hora": None, "kg": None, "motivo": "",
            "foto_url": None, "historial": [_cambio(momento, "recibida", "solicitante", "por whatsapp")],
            "recibida": momento}


def _programada(vecino: dict, flujo: Flujo, encargado, coordinadores: dict, cuando: tuple) -> dict:
    """Recibida un par de días antes y programada con encargado, día y hora (RN-02)."""
    dia, hora = cuando
    cita = _momento(dia, hora)
    fila = _recibida(vecino, flujo, cita - timedelta(hours=azar.randint(14, 60)))
    coordinador = coordinadores.get(COLECTIVO_DEL_FLUJO[flujo])
    por, nota = str(coordinador or "coordinacion"), f"encargado {encargado.id} · {dia.isoformat()} {hora}"
    fila["historial"].append(_cambio(fila["recibida"] + timedelta(hours=azar.randint(1, 4)), "programada", por, nota))
    fila.update(estado="programada", encargado_id=encargado.id, dia=dia, hora=time.fromisoformat(hora),
                preferencia="manana" if cita.hour < 12 else "tarde", asignada_por=coordinador)
    return fila


def _cerrar(fila: dict, estado: str) -> dict:
    """La recolección se pesa (o se rechaza) poco después de la cita; una cancelada la cancela el vecino."""
    momento = _momento(fila["dia"], fila["hora"].strftime("%H:%M")) + timedelta(minutes=azar.randint(10, 50))
    por = fila["historial"][-1]["por"]
    if estado == "recolectada":
        rango = KILOS[(Flujo(fila["flujo"]), "unidad_productiva" if "Local" in fila["direccion"] else "hogar")]
        fila["kg"] = Decimal(str(round(azar.uniform(*rango), 1)))
        fila["historial"].append(_cambio(momento, estado, por, f"{fila['kg']} kg"))
    elif estado in ("rechazada", "cancelada"):
        fila["motivo"] = azar.choice(MOTIVOS) if estado == "rechazada" else "El vecino canceló por WhatsApp"
        fila["historial"].append(_cambio(momento, estado, por if estado == "rechazada" else "solicitante",
                                         fila["motivo"]))
    fila["estado"] = estado or fila["estado"]
    return fila


def _puntos(c, filas: list[dict]) -> dict:
    """Lo que ganó cada recolección con la regla vigente, fechado cuando se validó. Devuelve el saldo por vecino."""
    vista = puntos.regla_vigente()
    regla, saldos, movimientos = Regla(vista.version, vista.base, vista.por_kg), defaultdict(int), []
    for fila in (f for f in filas if f["estado"] == "recolectada"):
        valor, explicacion = regla.calcular(Flujo(fila["flujo"]), fila["kg"])
        movimientos.append({"id": uuid4(), "solicitante_id": fila["solicitante_id"], "puntos": valor,
                            "codigo": fila["codigo"], "regla_version": regla.version, "explicacion": explicacion,
                            "fecha": datetime.fromisoformat(fila["historial"][-1]["fecha"])})
        saldos[fila["solicitante_id"]] += valor
    if movimientos:
        c.execute(insert(tp.movimientos), movimientos)
    return saldos


def _canjes(c, vecinos: list[dict], saldos: dict, ahora: datetime) -> None:
    """Canjes entregados estos meses, unos cancelados y los de esta semana por entregar; nadie pide más de lo que
    tiene. El entregado descuenta del libro con el código del canje, como en la huerta (ADR-0008)."""
    premios = [p for p in puntos.premios(solo_activos=True)]
    estados = ["entregado"] * 14 + ["cancelado"] * 3 + ["pedido"] * 7
    ricos = sorted(vecinos, key=lambda v: -saldos.get(v["id"], 0))[:len(estados)]
    canjes, movimientos = [], []
    for vecino, estado, numero in zip(ricos, estados, _consecutivos(c, tp.consecutivo_canje, len(estados))):
        alcanza = [p for p in premios if p.costo <= saldos.get(vecino["id"], 0)]
        if not alcanza:
            continue
        canje = _canje(vecino, azar.choice(alcanza), estado, f"CAN-{numero:04d}", ahora)
        canjes.append(canje)
        if estado == "entregado":
            movimientos.append({"id": uuid4(), "solicitante_id": vecino["id"], "puntos": -canje["costo"],
                                "codigo": canje["codigo"], "regla_version": 1, "fecha": canje["cerrado_en"],
                                "explicacion": f"Canje {canje['codigo']}: {canje['premio']}"})
    for tabla, filas in ((tp.canjes, canjes), (tp.movimientos, movimientos)):
        if filas:
            c.execute(insert(tabla), filas)


def _canje(vecino: dict, premio, estado: str, codigo: str, ahora: datetime) -> dict:
    antes = timedelta(hours=azar.randint(2, 70)) if estado == "pedido" else timedelta(days=azar.randint(6, 80))
    pedido = ahora - antes
    cerrado = None if estado == "pedido" else min(pedido + timedelta(days=azar.randint(1, 3)), ahora)
    return {"id": uuid4(), "codigo": codigo, "solicitante_id": vecino["id"], "premio": premio.nombre,
            "costo": premio.costo, "estado": estado, "pedido_en": pedido, "cerrado_en": cerrado,
            "cerrado_por": None if cerrado is None else "Fundación Santo Domingo"}
