# EcoConecta por WhatsApp

Módulo TypeScript para que hogares y unidades productivas de Villas de San Pablo soliciten una recolección por WhatsApp. El módulo indica al backend qué coordinación recibe la solicitud: huerteros para orgánicos y recicladores para reciclables. El backend registra la solicitud y devuelve su identificador.

- [Dominio](src/domain) define los pasos de la conversación y el enrutamiento.
- [Aplicación](src/application) coordina los mensajes, las solicitudes y las respuestas mediante interfaces.
- [Infraestructura](src/infrastructure) conecta Twilio, el backend HTTP, el almacenamiento y las reglas editables.

## Ejecutar en local

Ejecuta estos comandos desde `modules/whatsapp-recoleccion` con Node.js 24 y npm.

```powershell
Copy-Item .env.example .env
npm ci
npm test
```

`npm test` compila y ejecuta las pruebas. Completa `.env` según el modo que quieras probar y ejecuta `npm start`. El servicio expone `GET /health` y recibe mensajes en `POST /webhooks/twilio/whatsapp`. Guarda las credenciales en `.env` o en los secretos de tu despliegue.

| Variable | Qué configurar |
| --- | --- |
| `WHATSAPP_MODE` | `demo` para simular el backend con datos en memoria. `api` para registrar solicitudes en el backend y guardar el estado del canal en PostgreSQL. |
| `TWILIO_AUTH_TOKEN` | Auth Token de la cuenta que emite el webhook. El módulo verifica `X-Twilio-Signature` con ese valor. |
| `TWILIO_WEBHOOK_URL` | URL completa y exacta del webhook, con `/webhooks/twilio/whatsapp`, HTTPS y sin parámetros de consulta. HTTP se admite para pruebas en loopback. |
| `HOST` | Dirección de escucha. Por defecto, `127.0.0.1`. |
| `PORT` | Puerto de escucha. Por defecto, `3000`. |
| `WHATSAPP_RULES_FILE` | Ruta opcional al archivo de respuestas. Por defecto, `config/replies.es.json`. |
| `WHATSAPP_PILOT_NUMBERS` | Números habilitados para el piloto, en formato E.164 y separados por comas. Si se omite, se aceptan los remitentes de WhatsApp que llegan por el webhook firmado. |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL, requerida en modo `api`. El módulo inicializa sus propias tablas. |
| `COLLECTION_API_URL` | URL completa del endpoint de alta por `POST`, requerida en modo `api`. |
| `COLLECTION_API_TOKEN` | Token Bearer del backend de recolección, requerido en modo `api`. |

Con Docker, compila la imagen desde la carpeta del módulo y publica el puerto en loopback.

```powershell
docker build -t ecoconecta-whatsapp .
docker run --rm --env-file .env -e HOST=0.0.0.0 -p 127.0.0.1:3000:3000 ecoconecta-whatsapp
```

Para editar las respuestas con el contenedor en marcha, monta el directorio `config` y apunta el módulo al archivo montado.

```powershell
docker run --rm --env-file .env -e HOST=0.0.0.0 -p 127.0.0.1:3000:3000 `
  --mount "type=bind,src=$($PWD.Path)/config,dst=/ecoconecta-config,readonly" `
  -e WHATSAPP_RULES_FILE=/ecoconecta-config/replies.es.json ecoconecta-whatsapp
```

Para el modo `api`, la base de datos y el backend deben ser accesibles desde el contenedor.

## Probar con WhatsApp

1. Activa el Sandbox de WhatsApp en la consola clásica de Twilio. Une tu teléfono con el código `join` o el QR que muestra Twilio. [Sandbox de Twilio](https://www.twilio.com/docs/whatsapp/sandbox#how-to-activate-and-join-the-sandbox)
2. Publica el puerto local con un túnel HTTPS o usa la URL HTTPS de tu despliegue. Configura esa URL completa en `TWILIO_WEBHOOK_URL` y en el campo **When a message comes in** del Sandbox, con método `POST`. [Configuración del webhook del Sandbox](https://www.twilio.com/docs/whatsapp/sandbox#webhook-url)
3. Inicia el módulo con `WHATSAPP_MODE=demo`. Desde el teléfono unido al Sandbox, escribe `MENU` y completa el flujo con una dirección ficticia.

| Paso | Respuesta de ejemplo |
| --- | --- |
| Tipo de residuo | `1` para orgánico o `2` para reciclable |
| Tipo de generador | `1` para hogar o `2` para unidad productiva |
| Dirección | `Torre ficticia 12, apartamento 401` |
| Disponibilidad | `Mañana en la tarde` |
| Observaciones | `Dos bolsas separadas` o `ninguna` |
| Confirmación | `SI` para enviar o `CANCELAR` para descartar |

`MENU` repite la pregunta del borrador en curso o muestra el menú inicial. `ESTADO` muestra el último comprobante que recibió ese número. En modo `demo`, la referencia es simulada y se pierde al reiniciar el proceso. En modo `api`, el módulo guarda el borrador y el último comprobante en PostgreSQL. La programación, la asignación, el estado operativo y el cierre corresponden al sistema de recolección. El canal recibe mensajes de texto y responde al remitente durante la conversación. Para mensajes iniciados por el negocio fuera de la ventana de atención, Twilio requiere una plantilla aprobada. [Ventana de atención y plantillas de WhatsApp](https://www.twilio.com/docs/whatsapp/sandbox#business-initiated-messages-and-templates)

En la sesión del 20 de noviembre, los organizadores recomendaron probar WhatsApp mediante un proveedor oficial de la API como Twilio. [Respuestas de los organizadores](../../docs/reto/respuestas-organizadores.md#alcance-y-tecnología)

## Cambiar las respuestas

Edita [`config/replies.es.json`](config/replies.es.json) o el archivo indicado por `WHATSAPP_RULES_FILE`. Conserva las claves y los marcadores que aparecen en la versión original. `maxCharacters` define el límite por respuesta, contando los valores que sustituyen los marcadores. El módulo aplica los cambios válidos al responder el siguiente mensaje, incluso durante una conversación. Si una edición invalida el archivo, sigue usando la última configuración válida. Los comandos, las opciones numéricas y el enrutamiento se definen en el flujo TypeScript.

## Contrato para el backend de recolección

El módulo envía JSON por `POST` a `COLLECTION_API_URL`, con `Authorization: Bearer <COLLECTION_API_TOKEN>` e `Idempotency-Key` igual a `requestId`. `requestId` es un identificador opaco generado a partir del primer mensaje de la solicitud. El tiempo de espera es de 4 segundos. El backend debe reconocer la misma clave en los reintentos y devolver la respuesta original para evitar una solicitud duplicada. Si la API falla, el chat conserva el borrador para reintentar con `SÍ`.

```json
{
  "requestId": "SM0123456789abcdef0123456789abcdef",
  "contactPhone": "+573000000000",
  "wasteType": "organico",
  "generatorType": "hogar",
  "address": "Torre ficticia 12, apartamento 401",
  "availability": "Mañana en la tarde",
  "notes": "Dos bolsas separadas",
  "coordinator": "huerteros",
  "source": "whatsapp"
}
```

`wasteType` admite `organico` o `reciclable`. `generatorType` admite `hogar` o `unidad_productiva`. `coordinator` es `huerteros` para orgánicos y `recicladores` para reciclables. `notes` es una cadena vacía cuando el usuario responde `ninguna`. Una solicitud aceptada requiere una respuesta HTTP `2xx` con el estado `recibida` y un identificador de hasta 80 caracteres formado por letras ASCII, números, guiones o guiones bajos.

```json
{
  "id": "REC-1042",
  "status": "recibida"
}
```

## Trabajar con GitHub Flow

Abre una rama corta `codex/feat/...` o `codex/fix/...` desde `main` para cada cambio. Ejecuta `npm test` y `npm run build` desde el módulo. Envía la rama en un pull request hacia `main` con los cambios de comportamiento, las variables nuevas y la prueba realizada. Integra el cambio después de la revisión y la aprobación del equipo.
