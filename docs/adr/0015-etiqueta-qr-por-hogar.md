# ADR-0015 · Etiqueta QR por hogar para registrar la bolsa al pesar

- **Estado:** aceptada · 2026-11-20

## Contexto

Al pesar en la huerta o el acopio, la coordinación busca el código que el vecino escribió a mano en la bolsa (ORG-0042).
La letra se borra o no se entiende, y teclear el código bolsa por bolsa es lento cuando llegan muchas juntas. Los
requerimientos piden que el coordinador escanee un sticker con QR pegado en la bolsa y registre ahí el resultado: el peso
y si estaba bien o mal separada.

## Decisión

- **Un QR por hogar o negocio, no por solicitud.** El sticker se imprime una vez y sirve para todas sus bolsas. Su
  contenido es `EC1:<id del solicitante>`: no lleva nombre, teléfono ni dirección, así que quien encuentre la bolsa no lee
  nada personal (Ley 1581). El prefijo tiene versión por si el formato cambia.
- **Módulo `etiquetas` (Leonardo), sin tablas propias.** Compone `directorio` y `solicitudes` por sus contratos.
  `GET /api/etiquetas` lista las de los hogares habilitados para imprimirlas, y `GET /api/etiquetas/lectura?contenido=`
  devuelve el hogar y sus solicitudes abiertas del colectivo de quien escanea. El administrador las ve todas.
- **El registro no cambia.** La pantalla **Escanear** usa los mismos endpoints de asignación, recolección y rechazo, con
  sus reglas (RN-02, RN-05): bien separada es una recolección con kilos, y mal separada, un rechazo con motivo. Si la
  solicitud sigue recibida, pregunta quién trajo la bolsa y la asigna para hoy antes de registrar.
- **La cámara decodifica en el navegador** con `jsQR`, porque el `BarcodeDetector` nativo no existe en Windows ni en
  iPad. El backend solo valida el contenido. Sin cámara o sin HTTPS, se escribe el código de la bolsa, como antes.
- **Los stickers se imprimen desde la misma pantalla** (`qrcode-generator`, en el navegador): el QR, el nombre o alias,
  la zona y la mariposa de Villas de San Pablo.

## Consecuencias

- Un sticker perdido se reimprime igual, porque el contenido no cambia. Por lo mismo, no se puede revocar uno; si hiciera
  falta, una versión `EC2` puede llevar una firma.
- El código corto sigue vigente: los avisos de WhatsApp lo envían y la búsqueda por código no cambia.
- `jsQR` y `qrcode-generator` se cargan solo al abrir esas vistas, así que el resto de la tablet no pesa más.
