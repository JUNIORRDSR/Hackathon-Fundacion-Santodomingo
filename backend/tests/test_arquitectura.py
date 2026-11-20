"""Reglas de arquitectura y de tamaño (ADR-0006). Si una falla, se corrige el código, no la regla."""
import ast
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
APP, PRUEBAS, MODULOS = RAIZ / "app", RAIZ / "tests", RAIZ / "app" / "modulos"
# Por carpeta: líneas por archivo, líneas por función y caracteres por línea (None: sin tope).
LIMITES = {APP: (300, 20, 120), PRUEBAS: (500, 30, None)}
NOMBRES_GENERICOS = ("utils", "util", "helper", "manager", "misc", "common")
TELEFONO_FICTICIO = re.compile(r"\+57300000000\d")


def _archivos(carpeta: Path) -> list[Path]:
    return sorted(carpeta.rglob("*.py"))


def _arbol(archivo: Path) -> ast.Module:
    return ast.parse(archivo.read_text(encoding="utf-8"))


def _nombre(archivo: Path) -> str:
    return archivo.relative_to(RAIZ).as_posix()


def _importados(archivo: Path) -> list[str]:
    destinos = []
    for nodo in ast.walk(_arbol(archivo)):
        if isinstance(nodo, ast.Import):
            destinos += [alias.name for alias in nodo.names]
        elif isinstance(nodo, ast.ImportFrom) and nodo.module:
            destinos += [f"{nodo.module}.{alias.name}" for alias in nodo.names]
    return destinos


def _funciones(archivo: Path) -> list[ast.FunctionDef]:
    return [n for n in ast.walk(_arbol(archivo)) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]


def _cruza_sin_contrato(propio: str, destino: str) -> bool:
    partes = destino.split(".")
    ajeno = partes[:2] == ["app", "modulos"] and len(partes) > 2 and partes[2] != propio
    return ajeno and (len(partes) < 4 or partes[3] != "contrato")


def _sin_violaciones(violaciones: list[str]) -> None:
    assert not violaciones, "\n".join(violaciones)


# ---- Fronteras (ADR-0001) ----

def test_entre_modulos_solo_se_importa_el_contrato():
    _sin_violaciones([f"{_nombre(a)} importa {d}" for a in _archivos(MODULOS) for d in _importados(a)
                      if _cruza_sin_contrato(a.relative_to(MODULOS).parts[0], d)])


def test_el_dominio_solo_usa_la_libreria_estandar_y_el_nucleo_compartido():
    _sin_violaciones([f"{_nombre(a)} importa {d}" for a in MODULOS.rglob("dominio.py") for d in _importados(a)
                      if d.split(".")[0] not in sys.stdlib_module_names and not d.startswith("app.compartido")])


def test_el_nucleo_compartido_no_depende_de_ningun_modulo():
    _sin_violaciones([f"{_nombre(a)} importa {d}" for a in _archivos(APP / "compartido") for d in _importados(a)
                      if d.startswith("app.modulos")])


def test_los_routers_pasan_por_el_contrato():
    _sin_violaciones([f"{_nombre(a)} importa {d}" for a in MODULOS.rglob("api.py") for d in _importados(a)
                      if d.startswith("sqlalchemy") or ".tablas" in d])


def test_cada_modulo_tiene_contrato_y_api():
    modulos = [m for m in MODULOS.iterdir() if m.is_dir() and not m.name.startswith("__")]
    _sin_violaciones([m.name for m in modulos if not (m / "contrato.py").exists() or not (m / "api.py").exists()])


def test_cada_modulo_guarda_en_su_esquema_sin_claves_foraneas_a_otros():
    violaciones = []
    for archivo in MODULOS.rglob("tablas.py"):
        modulo, texto = archivo.parent.name, archivo.read_text(encoding="utf-8")
        violaciones += [f"{modulo}: esquema {e}" for e in re.findall(r'schema="(\w+)"', texto) if e != modulo]
        violaciones += [f"{modulo}: clave foránea a {e}" for e in re.findall(r'ForeignKey\("(\w+)\.', texto)
                        if e != modulo]
    _sin_violaciones(violaciones)


# ---- Tamaños, comentarios y nombres (Clean Code, cap. 2 a 5) ----

def test_tamanos_de_archivos_funciones_y_lineas():
    violaciones = []
    for carpeta, limites in LIMITES.items():
        for archivo in _archivos(carpeta):
            violaciones += _excesos(archivo, *limites)
    _sin_violaciones(violaciones)


def _excesos(archivo: Path, max_archivo: int, max_funcion: int, max_linea: int | None) -> list[str]:
    lineas = archivo.read_text(encoding="utf-8").splitlines()
    excesos = [f"{_nombre(archivo)}: {len(lineas)} líneas"] if len(lineas) > max_archivo else []
    excesos += [f"{_nombre(archivo)}:{f.lineno} {f.name}: {f.end_lineno - f.lineno + 1} líneas"
                for f in _funciones(archivo) if f.end_lineno - f.lineno + 1 > max_funcion]
    if max_linea:
        excesos += [f"{_nombre(archivo)}:{i}: {len(linea)} caracteres"
                    for i, linea in enumerate(lineas, start=1) if len(linea) > max_linea]
    return excesos


def test_cinco_parametros_como_maximo():
    _sin_violaciones([f"{_nombre(a)}:{f.lineno} {f.name}" for a in _archivos(APP) for f in _funciones(a)
                      if len([p for p in f.args.args + f.args.kwonlyargs if p.arg not in ("self", "cls")]) > 5])


def test_comentarios_cortos():
    violaciones = []
    for archivo in _archivos(APP):
        violaciones += _docstrings_largos(archivo) + _comentarios_seguidos(archivo)
    _sin_violaciones(violaciones)


def _docstrings_largos(archivo: Path) -> list[str]:
    nodos = (n for n in ast.walk(_arbol(archivo))
             if isinstance(n, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)))
    return [f"{_nombre(archivo)}: docstring de {len(d.splitlines())} líneas"
            for n in nodos if (d := ast.get_docstring(n)) and len(d.splitlines()) > 3]


def _comentarios_seguidos(archivo: Path) -> list[str]:
    seguidos, violaciones = 0, []
    for numero, linea in enumerate(archivo.read_text(encoding="utf-8").splitlines(), start=1):
        seguidos = seguidos + 1 if linea.lstrip().startswith("#") else 0
        if seguidos == 3:
            violaciones.append(f"{_nombre(archivo)}:{numero}: más de 2 líneas de comentario seguidas")
    return violaciones


def test_nombres_del_dominio_y_no_genericos():
    nombres = [(_nombre(a), a.stem) for a in _archivos(APP)]
    nombres += [(_nombre(a), n.name) for a in _archivos(APP) for n in ast.walk(_arbol(a))
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    _sin_violaciones([f"{lugar}: {nombre}" for lugar, nombre in nombres
                      if any(generico in nombre.lower() for generico in NOMBRES_GENERICOS)])


def test_sin_print():
    _sin_violaciones([f"{_nombre(a)}:{n.lineno}" for a in _archivos(APP) for n in ast.walk(_arbol(a))
                      if isinstance(n, ast.Call) and getattr(n.func, "id", None) == "print"])


FRONTEND = RAIZ.parent / "frontend" / "src"


def test_frontend_tamanos_y_modulo_que_no_conoce_al_host():
    """En el frontend rigen los mismos tamaños, y el módulo de Daniela no importa del host: todo le llega por props."""
    violaciones = []
    for archivo in _archivos_ts():
        lineas = archivo.read_text(encoding="utf-8").splitlines()
        violaciones += [f"{archivo.name}: {len(lineas)} líneas"] if len(lineas) > 300 else []
        violaciones += [f"{archivo.name}:{i}: {len(linea)} caracteres"
                        for i, linea in enumerate(lineas, start=1) if len(linea) > 120]
        violaciones += _imports_al_host(archivo)
    _sin_violaciones(violaciones)


def _archivos_ts() -> list[Path]:
    """components/ui lo escribe el CLI de shadcn, no una persona: no cuenta."""
    if not FRONTEND.exists():
        return []
    return sorted(p for p in FRONTEND.rglob("*.ts*") if "ui" not in p.relative_to(FRONTEND).parts[1:2])


def _imports_al_host(archivo: Path) -> list[str]:
    if archivo.relative_to(FRONTEND).parts[0] != "ecoconecta-coordinacion":
        return []
    rutas = re.findall(r"from '([^']+)'", archivo.read_text(encoding="utf-8"))
    return [f"{archivo.name} importa {r}" for r in rutas if r.startswith("@/") or "/host" in r]


def test_solo_telefonos_ficticios():
    """Ley 1581: ningún teléfono real en el código ni en las pruebas."""
    _sin_violaciones([f"{_nombre(a)}: {t}" for a in _archivos(APP) + _archivos(PRUEBAS)
                      for t in re.findall(r"\+57\d{10}", a.read_text(encoding="utf-8"))
                      if not TELEFONO_FICTICIO.fullmatch(t)])
