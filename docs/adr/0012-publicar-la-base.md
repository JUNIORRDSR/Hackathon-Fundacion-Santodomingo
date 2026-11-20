# ADR-0012 · Publicar la base: reinicio una sola vez por publicación y día de demo

- **Estado:** aceptada · 2026-11-20

## Contexto

La app crea sus tablas con `create_all` al arrancar (ADR-0001): crea las que faltan, pero no agrega columnas a las que
ya existen. La base de producción se creó con una versión vieja; al publicar `main` la app nueva fallaría contra ese
esquema. Lo que hay en producción es de prueba, y la base de Azure solo acepta conexiones de servicios de Azure.

## Decisión

- `deploy/azure.sh` con `REINICIAR_BASE=1` entrega a la app un sello con la fecha de la publicación. Al arrancar, si el
  sello no está en `public.reinicios`, la app borra los esquemas de sus módulos, los crea de nuevo, siembra usuarios,
  zonas, contenidos y premios y guarda el sello. Reiniciar la app no vuelve a borrar: el sello ya está.
- Con `CARGAR_DEMO=1`, el script espera a que la versión nueva responda y carga `scripts/dia_de_demo.py`: un día normal
  ficticio (Ley 1581), sin copiar ninguna base local.
- Lo hace la propia app, dentro de Azure: no hay que abrir el firewall de PostgreSQL a ningún equipo.

## Alternativas descartadas

- Migraciones con `ALTER TABLE` (o Alembic): conservan datos, pero no se sabe con exactitud qué versión está
  publicada y hoy no hay datos que valga la pena conservar.
- Copiar la base local con `pg_dump`: lleva las pruebas del día, con riesgo de datos personales en producción.
- Borrar desde el equipo de Leonardo: exige abrir el firewall a su IP.
