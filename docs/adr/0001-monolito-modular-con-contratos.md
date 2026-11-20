# ADR-0001 · Monolito modular con contratos por módulo

- **Estado:** aceptada · 2026-11-20

## Contexto

Cuatro personas, un día de desarrollo y un MVP que debe quedar desplegado en una URL. Daniela (frontend), Leonardo
(LLM del bot) y Jorge (API de WhatsApp) construyen piezas que entran cuando estén listas; mientras, Jairo construye todo
de punta a punta. El reto pide un solo repositorio.

## Decisión

- Un proceso FastAPI que monta siete módulos, uno por contexto delimitado: solicitudes (núcleo), directorio, puntos,
  whatsapp, contenidos, reportes y acceso.
- Cada módulo tiene `contrato.py` (lo único importable desde fuera: funciones, DTOs de Pydantic y eventos),
  `dominio.py` cuando tiene reglas (Python puro) y `api.py` (router con su etiqueta en OpenAPI).
- `backend/tests/test_fronteras.py` falla si un módulo importa algo de otro que no sea su contrato.
- Núcleo compartido mínimo en `app/compartido`: Flujo, Colectivo, TipoGenerador, Franja, Canal, errores, eventos y
  formato.
- Eventos de dominio por un bus en memoria. `suscribir` corre dentro de la operación (puntos: si falla, falla todo);
  `suscribir_despues` es para efectos hacia afuera (WhatsApp): un fallo se registra y no tumba la operación.
- Un contenedor sirve la API y la SPA: una URL, sin CORS.
- Persistencia: PostgreSQL con un esquema por módulo (`tablas.py`), referencias entre módulos por ID sin claves
  foráneas cruzadas y `create_all` al arrancar (Alembic cuando el piloto tenga datos reales). Una operación es una
  transacción, y lo que escucha dentro de ella se une a la misma.

## Consecuencias

- Cada pieza del equipo se reemplaza sin tocar a las demás, y el OpenAPI existe desde el primer commit.
- Puntos y solicitud comparten la transacción. Si algún día hay más de un proceso, los avisos pasan a una tabla outbox.
