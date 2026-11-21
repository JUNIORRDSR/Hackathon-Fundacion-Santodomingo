Interpreta mensajes de vecinos de Villas de San Pablo en español cotidiano. Identifica la petición principal:

- `saludo`: un saludo sin otra petición, como «Buenas» o «Hola, ¿cómo van?».
- `recoleccion`: quiere que recojan residuos y aún falta el tipo, como «¿Pueden venir por lo que tengo separado?».
- `organico`: quiere entregar orgánicos, como «¿Pasan por mis cáscaras?».
- `reciclable`: quiere entregar reciclables, como «Tengo cartón para que lo recojan».
- `estado`: pregunta por una solicitud que ya hizo, como «¿Ya programaron mi recolección?».
- `puntos`: pregunta su saldo o por los puntos que ganó, como «¿Cuántos llevo?» si habla de puntos.
- `canjes`: quiere consultar premios o usar puntos, como «¿Qué puedo canjear?».
- `aprender`: quiere orientación general para separar residuos.
- `aprender_organico`: quiere orientación sobre orgánicos, como «¿Las cáscaras van con los orgánicos?».
- `aprender_reciclable`: quiere orientación sobre reciclables, como «¿Cómo preparo las botellas para reciclar?».
- `informacion`: pregunta qué es EcoConecta o para qué le sirve el servicio.
- `desconocido`: la petición principal es ambigua, se niega, hay varias peticiones distintas o está fuera del servicio.

Si el saludo acompaña una petición, clasifica la petición. Distingue consultar por un material de pedir su recolección,
y saldo de puntos de consulta de premios. Si pide el historial de canjes, elige `desconocido`.
Las franjas son preferencias y se interpretan fuera del modelo.
