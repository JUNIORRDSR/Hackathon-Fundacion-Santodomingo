# ADR-0015 · Etiqueta QR y código por hogar para registrar la bolsa al pesar

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
- **Sin sticker, un código escrito.** Si no alcanza el material para los QR, cada hogar escribe en un papel pegado a
  la bolsa su código: un número corto y fijo, por ejemplo `1008`. Es el número del hogar, que empieza en 100, más un
  dígito verificador de Luhn. Un dígito mal copiado, o casi cualquier par de dígitos seguidos al revés, se rechaza
  en vez de caer en otro hogar. El número vive en la tabla `etiquetas.codigos` y se asigna la primera vez que se
  piden las etiquetas o se lee el hogar, con un candado de Postgres para que no queden huecos.
- **Módulo `etiquetas` (Leonardo).** Compone `directorio` y `solicitudes` por sus contratos; lo único propio es el
  número de cada hogar.
  `GET /api/etiquetas` lista las de los hogares habilitados, con su QR y su código, para imprimirlas.
  `GET /api/etiquetas/lectura?contenido=` recibe el QR o el código escrito y devuelve el hogar y sus solicitudes
  abiertas del colectivo de quien escanea. El administrador las ve todas.
- **El registro no cambia.** La pantalla **Escanear** usa los mismos endpoints de asignación, recolección y rechazo, con
  sus reglas (RN-02, RN-05): bien separada es una recolección con kilos, y mal separada, un rechazo con motivo. Si la
  solicitud sigue recibida, pregunta quién trajo la bolsa y la asigna para hoy antes de registrar.
- **La cámara decodifica en el navegador** con `jsQR`, porque el `BarcodeDetector` nativo no existe en Windows ni en
  iPad. El backend solo valida el contenido. Sin cámara o sin HTTPS, se escribe el código del hogar o el de la
  solicitud.
- **Los stickers se imprimen desde la misma pantalla** (`qrcode-generator`, en el navegador): el QR, el código, el
  nombre o alias, la zona y la mariposa de Villas de San Pablo. En hoja normal sirven como papel con el código.

## Consecuencias

- Un sticker perdido se reimprime igual, porque el contenido no cambia. Por lo mismo, no se puede revocar uno; si hiciera
  falta, una versión `EC2` puede llevar una firma.
- El código es consecutivo: quien escriba el de otro hogar le da los puntos a ese hogar, no a sí mismo. La tarjeta
  muestra el nombre antes de registrar.
- El vecino todavía no recibe su código por WhatsApp: lo ve la coordinación en **Etiquetas** y se lo entrega. Si hace
  falta, el aviso de habilitación puede incluirlo con `etiquetas.codigo()`.
- El código corto sigue vigente: los avisos de WhatsApp lo envían y la búsqueda por código no cambia.
- `jsQR` y `qrcode-generator` se cargan solo al abrir esas vistas, así que el resto de la tablet no pesa más.
