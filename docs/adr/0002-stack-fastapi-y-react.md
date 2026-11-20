# ADR-0002 · FastAPI + Pydantic en el backend, React como PWA en el frontend

- **Estado:** aceptada · 2026-11-20

## Contexto

El §8 del reto limita la tecnología: Python con FastAPI, Flask o Django; SQLAlchemy, Psycopg y Pydantic; PostgreSQL;
React, Next.js o Vue; Tailwind o Bootstrap. El equipo necesita los contratos a la vista desde el primer momento. El
dispositivo principal es una tablet.

## Decisión

- Backend: Python 3.11, FastAPI y Pydantic v2; SQLAlchemy 2 y psycopg 3 cuando entre Postgres. Los DTOs de Pydantic son
  el contrato, y FastAPI los publica solos como OpenAPI en `/docs`.
- Frontend: Vite + React + TypeScript + Tailwind, instalable como PWA para que la tablet la abra a pantalla completa. El
  cliente tipado se genera del OpenAPI. Lo sirve el mismo contenedor desde `frontend/dist`.
- Reglas de tablet: horizontal con bandeja a la izquierda y detalle a la derecha, botones de 48 px o más, nada que
  dependa del hover, teclado numérico para los kilos y selectores nativos para fecha y hora.

## Alternativas descartadas

- Flask: para publicar OpenAPI necesita una librería que no está en la lista permitida.
- Django: trae el panel de administración, pero su ORM no es SQLAlchemy y pesa más para un día.
