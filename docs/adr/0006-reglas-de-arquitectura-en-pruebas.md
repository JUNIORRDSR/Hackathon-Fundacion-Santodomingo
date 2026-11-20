# ADR-0006 · Las reglas de arquitectura y de tamaño se comprueban con pruebas

- **Estado:** aceptada · 2026-11-20

## Contexto

Cuatro personas escriben en el mismo backend en un día. Con la prisa, una regla que solo está escrita se olvida. Jairo
pidió que la suite no deje equivocarse. Los límites de tamaño son los de MaestraSuite (Martin, *Clean Code*, cap. 3 y 5).

## Decisión

`backend/tests/test_arquitectura.py` rompe la suite si se incumple alguna de estas reglas:

| Regla | Por qué |
|---|---|
| Entre módulos solo se importa `contrato.py` | Cada pieza se reemplaza sin tocar a las demás (ADR-0001) |
| `dominio.py` solo usa la librería estándar y `app/compartido` | Las reglas del negocio no dependen de frameworks |
| `app/compartido` no importa ningún módulo | El núcleo compartido no depende de nadie |
| `api.py` no importa SQLAlchemy ni `tablas.py` | Los routers pasan por el contrato |
| Cada módulo tiene `contrato.py` y `api.py` | Todos los módulos se leen igual |
| Cada `tablas.py` usa el esquema de su módulo y no tiene claves foráneas a otros | Un esquema por módulo |
| En `app/`: archivo de 300 líneas, función de 20 y línea de 120 caracteres como máximo; en `tests/`: 500 y 30 | La meta es un archivo de unas 200 líneas y funciones de 3 a 8 |
| Como máximo 5 parámetros por función | Más parámetros piden un objeto |
| Docstring de 3 líneas y 2 líneas seguidas de comentario como máximo | El comentario dice el porqué, no el qué |
| Sin nombres genéricos (`utils`, `helper`, `manager`, `misc`, `common`) | El nombre sale del dominio |
| Sin `print` en `app/` | Se usa `logging` |
| En el código y las pruebas, solo teléfonos ficticios (`+57300000000x`) | Ley 1581 |

## Consecuencias

- Si una regla falla, se corrige el código, no la regla. Cambiar una regla pide un ADR nuevo.
- Las funciones largas se parten por responsabilidad: el bot quedó en `bot.py` (entrada y salida), `menu.py`
  (conversador por defecto), `registro.py` (alta con autorización) y `avisos.py` (plantillas tras cada evento).
