# ADR-0008 · El vecino pide el canje por WhatsApp y la huerta lo entrega

- **Estado:** aceptada · 2026-11-20

## Contexto

El flujo que se presenta es: el vecino pide, el colectivo recoge, la coordinación registra la recolección, el vecino
recibe sus puntos y los canjea. Hasta hoy el bot solo decía qué se podía canjear con un texto fijo, y nada descontaba
puntos.

## Decisión

- **Catálogo de premios** en el módulo de puntos: nombre, costo en puntos y si está activo. Lo edita la
  administración. Arranca con premios de ejemplo marcados como tales hasta que la fundación fije los valores.
- **El vecino pide el canje por WhatsApp** (opción 4 del menú): ve su saldo y los premios, elige uno y recibe un código
  (`CAN-0001`). Los puntos quedan **apartados**: el disponible es el saldo menos los canjes por entregar, así que no se
  puede pedir dos veces con los mismos puntos.
- **La huerta lo entrega**: en la tablet, la pantalla Canjes muestra los pedidos; la coordinación busca el código,
  entrega y confirma. Al confirmar se escribe un movimiento negativo en el libro de puntos con el código del canje, y el
  vecino recibe el aviso con su saldo nuevo. El libro sigue siendo la única fuente del saldo y solo crece.
- La coordinación puede cancelar un canje por entregar; los puntos apartados vuelven a estar disponibles.
- El contenido de propósito `canje` deja de ser la lista de premios; la semilla «Qué puedes canjear» se retira.

## Alternativas descartadas

- Descontar al pedir: si el vecino no va a la huerta, habría que devolver puntos con otro movimiento.
- Canje solo en la huerta: no muestra el ciclo completo por WhatsApp, que es lo que se presenta.
