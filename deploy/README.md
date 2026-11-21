# Despliegue y pruebas de WhatsApp

Usen **Azure Container Apps para las pruebas compartidas** y **Docker local para desarrollar**. Cada Sandbox de Twilio
tiene un destino para los mensajes entrantes. Para probar WhatsApp en paralelo contra una base local e independiente,
usen un Sandbox o remitente de prueba separado del que apunta a Azure.

## Azure Container Apps

1. En la suscripción del equipo, con `az login` y Docker activo, define las variables indicadas al inicio de
   [`azure.sh`](azure.sh). Para WhatsApp real, define `TRANSPORTE=twilio` junto con `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN` y `TWILIO_WHATSAPP_FROM`. Para el Sandbox clásico usa `TWILIO_RESPUESTA_TWIML=1`.
2. Desde la raíz, ejecuta `bash deploy/azure.sh`. Para la verificación de Twilio, necesitas Python 3. El script genera
   `TWILIO_WEBHOOK_URL` a partir del hostname público de la Container App y la ruta `/api/whatsapp/twilio`. Así, la
   URL de ngrok que usas en local queda fuera del despliegue. El script mantiene una réplica activa y comprueba la firma.
3. En la consola clásica de Twilio, guarda la URL que imprime el script en **Sandbox settings → When a message comes
   in** con método **POST**. Para un remitente registrado, guárdala en su configuración de mensajes entrantes.

Al publicar otra revisión de la misma Container App, Twilio sigue llamando a la misma dirección. El equipo puede enviar
un `Hola` desde un celular vinculado y ver el mensaje en el monitor de Azure. [Ingreso en Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview) · [Webhook del Sandbox](https://www.twilio.com/docs/whatsapp/sandbox#webhook-url)

## Docker local para cada integrante

Para probar el monitor y el bot sin credenciales externas, deja `TRANSPORTE=simulado` y `CONVERSADOR=menu` en el `.env`
de la raíz o usa los valores por defecto de un checkout nuevo. Desde la raíz ejecuta:

```sh
docker compose -f docker-compose.yml -f deploy/whatsapp-local.compose.yml up -d --build
```

Entra a [EcoConecta local](http://localhost:8000/#/whatsapp) con `admin` y `ecoconecta-demo` si usas la clave por
defecto. En **Como vecino (prueba)** escribe `Hola`. Cada instalación conserva su PostgreSQL en el volumen `datos`.

## WhatsApp real contra Docker con URL fija

Si el checkout todavía no tiene `.env`, copia [`.env.example`](../.env.example) como `.env` en la raíz.

1. Crea una cuenta en [ngrok](https://dashboard.ngrok.com/). Copia el hostname que te asignó en **Domains** a
   `NGROK_DOMAIN` y tu Authtoken a `NGROK_AUTHTOKEN` en el `.env` local. El hostname se mantiene al reiniciar el
   túnel y el plan gratuito lo incluye. [Dominios de ngrok](https://ngrok.com/docs/gateway/domains#dev-domains)
2. En el mismo `.env`, define `TRANSPORTE=twilio` y las variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y
   `TWILIO_WHATSAPP_FROM` de tu Sandbox o remitente de desarrollo. Para el Sandbox clásico usa `TWILIO_RESPUESTA_TWIML=1`.
   En Windows, con PowerShell 7.2 o posterior, ejecuta:

   ```powershell
   pwsh -File deploy/whatsapp-local.ps1 -Compilar
   ```

   El script configura la URL del webhook en `.env`, arranca los contenedores y envía una comprobación técnica que
   valida la firma sin escribir en WhatsApp. En macOS o Linux puedes usar el mismo script con `pwsh`, o definir
   `TWILIO_WEBHOOK_URL=https://<NGROK_DOMAIN>/api/whatsapp/twilio` en `.env` sustituyendo `<NGROK_DOMAIN>` por tu
   hostname y ejecutar:

   ```sh
   docker compose -f docker-compose.yml -f deploy/whatsapp-local.compose.yml up -d --build app whatsapp-tunel-ngrok
   ```

3. Guarda en Twilio la URL que imprime el script, incluido `/api/whatsapp/twilio`, con método **POST**. La raíz del
   dominio devuelve `404`. Vincula el celular si usas el Sandbox y envía `Hola`. El monitor continúa en
   [localhost](http://localhost:8000/#/whatsapp).

Después de reiniciar el equipo, abre Docker Desktop y ejecuta el script de nuevo. Omite `-Compilar` si ya tienes la
imagen y el código sigue igual. Twilio conserva la URL guardada y Docker conserva los datos en el volumen `datos`.
Con el equipo apagado, las pruebas compartidas siguen disponibles en Azure si el Sandbox o remitente apunta allí.

Para verificar el túnel mientras la app está activa, ejecuta `pwsh -File deploy/whatsapp-local.ps1 -Comprobar`.
Envía una sonda firmada sin remitente ni mensaje y conserva los contenedores y el `.env`. Para diagnosticar una
entrega desde WhatsApp, revisa `docker compose logs --tail 50 app`. El registro `whatsapp.webhook` distingue la firma,
el acceso al piloto y el procesamiento del turno.

Con `NGROK_DOMAIN` configurado, el script reserva esa instalación para ngrok. En un entorno sin ngrok, si ya tienes
dominio propio en Cloudflare, puedes usar el mismo proxy con un túnel administrado. Configura el servicio
HTTP `http://whatsapp-webhook:8080` en Cloudflare, guarda `CLOUDFLARE_TUNNEL_TOKEN` y `CLOUDFLARE_TUNNEL_HOSTNAME`
en `.env`, y ejecuta `pwsh -File deploy/whatsapp-local.ps1 -Cloudflare -Compilar`. Para una prueba puntual, `-Temporal`
usa un Quick Tunnel de Cloudflare cuya URL cambia al recrearlo. [Túneles de Cloudflare](https://developers.cloudflare.com/tunnel/concepts/)
