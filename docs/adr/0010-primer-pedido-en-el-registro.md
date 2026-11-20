# ADR-0010 · El primer pedido se deja al registrarse y entra al aceptar al vecino

- **Estado:** aceptada · 2026-11-20

## Contexto

Un vecino nuevo se registraba por WhatsApp, quedaba pendiente (RN-08) y, cuando la coordinación lo habilitaba, tenía
que volver a escribir para pedir. En la demo el ciclo se cortaba ahí y la tablet no avisaba de los registros nuevos.

## Decisión

- Al final del registro el bot pregunta qué quiere entregar primero (orgánicos o reciclables) y en qué franja. Ese
  pedido queda en espera en la memoria de la conversación, no en Solicitudes: hasta que lo acepten no hay solicitud.
- Al aceptarlo en **Registros** (evento `SolicitanteHabilitado`), el aviso de bienvenida sale y el pedido en espera entra
  como solicitud. El aviso de «recibida» le da el código para escribir en la bolsa. El pedido sale de la memoria, así
  que no entra dos veces.
- La tablet muestra en el menú cuántos vecinos esperan que los acepten (se refresca cada 8 s y al aceptar).
- El detalle de la solicitud muestra la franja que prefirió el vecino, para elegir la hora.

## Alternativas descartadas

- Crear la solicitud al registrarse y ocultarla: rompe RN-08 (sin habilitar no hay solicitud) y ensucia los reportes.
- Pedir de nuevo tras la habilitación: es el corte del flujo que se quería quitar.
