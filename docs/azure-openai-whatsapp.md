# Azure OpenAI para el bot de EcoConecta

En Azure, el **grupo de recursos** agrupa los servicios del equipo. El **recurso Foundry** proporciona el endpoint
y las claves. El **despliegue** define qué modelo responde y tiene un nombre propio que el backend envía en cada
petición. En términos de GCP, el despliegue cumple aquí el papel de la configuración del modelo que invoca la app.

## Configurar Foundry

1. En el Portal de Azure, abre el recurso Foundry del grupo de la hackathon. En **Keys and Endpoint**, selecciona
   **Azure OpenAI** y copia el endpoint. Guarda una de las dos claves del recurso directamente en tu `.env` local.
   [Administración de claves y endpoints](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle)
2. Desde **Overview**, abre **Go to Foundry portal**. En **Build → Models → Deployments** busca un despliegue
   de texto existente. Si la lista está vacía, **Deploy** permite elegir un modelo compatible con Responses y
   salidas estructuradas. Revisa la disponibilidad, el tipo de despliegue y la cuota de tu suscripción antes
   de crearlo. Copia el **nombre del despliegue** que aparece en esa lista.
   [Desplegar un modelo](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/deploy-foundry-models)
   · [Modelos compatibles con salidas estructuradas](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs#supported-models)

Para probar el LLM sin enviar mensajes a Twilio, guarda estos valores en el `.env` de la raíz.

```dotenv
TRANSPORTE=simulado
CONVERSADOR=llm
OPENAI_BASE_URL=https://<recurso>.openai.azure.com/openai/v1
OPENAI_API_KEY=
CONVERSADOR_MODELO=
```

Ejecuta `docker compose up --build` y usa el [simulador](../README.md#probar-el-bot-sin-whatsapp). Completa el
registro y habilita al solicitante desde la coordinación antes de probar una frase como «quiero que recojan
mis orgánicos». El bot debe preguntar en qué franja prefieres la recolección. Para desactivar Azure,
cambia `CONVERSADOR=menu` y vuelve a arrancar el backend. En Azure Container Apps, usa un secreto
referenciado por la variable `OPENAI_API_KEY`. [Secretos de Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)

## Qué decide el modelo

El conversador usa Azure OpenAI Responses v1 para seleccionar una de las intenciones permitidas.
Recibe palabras del mensaje actual filtradas contra un vocabulario del dominio. El backend mantiene
el registro, el consentimiento, los datos del solicitante, las franjas, el estado y los avisos.
La clasificación abre un paso del menú o consulta información permitida. La creación de la solicitud
requiere una selección posterior de franja. La coordinación conserva la asignación, la programación
y el cierre.

La petición usa salida estructurada, `store: false`, límite de tokens y un tiempo de espera corto.
Si falta la configuración, falla Azure o no se reconoce la intención, el flujo usa el menú.
[Azure OpenAI Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)
