# ADR-0014 · Fotos y audios en el monitor, y la IA a pedido de la coordinación

- **Estado:** aceptada · 2026-11-20

## Contexto

Las fotos y las notas de voz se quedan en Twilio: a nuestra base solo llega el enlace (`media_url`), y Twilio puede
exigir su credencial para abrirlo. El monitor (ADR-0007) solo mostraba texto, así que la coordinación no veía lo que
mandó el vecino. Para la demo, la coordinación debe ver la foto y, si tomó el control, decidir si responde ella o la IA.

## Decisión

- `GET /api/whatsapp/adjunto?url=…`, con sesión: el backend trae la foto o el audio de Twilio con la credencial, que no
  sale del servidor, y se lo entrega a la tablet. Solo descarga de Twilio por HTTPS o de un `data:` (sin SSRF) y solo
  sirve imágenes y audios, con `nosniff` (sin XSS desde nuestro dominio).
- El monitor muestra la foto, o el audio para escuchar, dentro de la burbuja del vecino. El detalle de la solicitud usa
  la misma ruta para su foto.
- Con el bot al mando todo sigue igual: la IA revisa sola (ADR-0011). Con el control tomado, el bot calla y la foto trae
  el botón «Clasificar con IA» (`POST /api/whatsapp/mensajes/{id}/clasificacion`): la revisión le llega al vecino como
  respuesta del bot y queda en el hilo.

## Consecuencias

- Las fotos no se copian: siguen en Twilio. Si se borran allá o cambia la cuenta, el monitor ya no las muestra. Para el
  piloto queda Azure Blob Storage con una política de retención, si hace falta no depender de Twilio.
- Cada vez que la tablet abre una foto, el backend la descarga de nuevo; el navegador la guarda una hora en caché
  privada.
- Las notas de voz se escuchan en el monitor. Su transcripción ya aparece como eco del bot cuando el bot tiene el control.
