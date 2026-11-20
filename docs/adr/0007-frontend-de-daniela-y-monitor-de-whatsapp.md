# ADR-0007 · El frontend de Daniela es la base y el bot se puede intervenir

- **Estado:** aceptada · 2026-11-20 · reemplaza la parte de frontend de ADR-0002

## Contexto

Daniela entregó el frontend de coordinación (React 19, Tailwind 4, identidad de EcoConecta) como un módulo con su propio
contrato (`CoordinatorRepository`) y datos simulados. El host provisional del esqueleto duplicaba pantallas. El
simulador de WhatsApp tiene que convertirse en una forma de ver lo que hace el bot y de intervenir.

## Decisión

- La app de Daniela es `frontend/` y el host provisional sale. Lo que solo tenía el host (login, registro asistido,
  por habilitar, panel y simulador) pasa a su estructura y a su estilo.
- Su `CoordinatorRepository` se conecta a la API con su adaptador HTTP; los decodificadores traducen la vista del
  backend a sus tipos.
- El lenguaje sigue el glosario: `reciclable` en código y API; en pantalla puede decir «Reciclables (aprovechables)».
- Asignar es una sola acción con encargado, día y hora opcional. Sin hora la solicitud queda ASIGNADA con su día; con
  hora queda PROGRAMADA y solo entonces se avisa al vecino (RN-02). El resultado se registra desde las dos.
- Monitor de WhatsApp: también se guardan los mensajes que llegan. La coordinación puede tomar el control de una
  conversación: el bot deja de responder a ese número y lo que escribe la coordinación sale por el mismo transporte,
  hasta que la devuelve al bot. Los avisos automáticos siguen saliendo.
- Los componentes de chat son los de shadcn/ui (MessageScroller, Message, Bubble, Marker).
- Prettier, con ancho 120, formatea el frontend para cumplir ADR-0006.

## Consecuencias

- Un solo frontend y un solo estilo.
- Hay columnas nuevas (foto de la solicitud, mensajes entrantes, control). Como no hay Alembic, una base local creada
  antes se recrea con `docker compose down -v`.
