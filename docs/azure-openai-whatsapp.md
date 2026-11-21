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

Para una instalación local de simulación, guarda estos valores en su `.env`.

```dotenv
TRANSPORTE=simulado
CONVERSADOR=llm
OPENAI_BASE_URL=https://<recurso>.openai.azure.com/openai/v1
OPENAI_API_KEY=
CONVERSADOR_MODELO=
```

Para un despliegue de GPT-5 o GPT-5 mini, añade `CONVERSADOR_RAZONAMIENTO=minimal`. El bot usa hasta 128 tokens
de salida y espera hasta 3 segundos en la conexión con Azure. Para GPT-4.1 mini deja esa variable vacía.

Ejecuta `docker compose up --build` y usa el [simulador](../README.md#probar-el-bot-sin-whatsapp). Completa el
registro y habilita al solicitante desde la coordinación antes de probar una frase como «quiero que recojan
mis orgánicos». El bot debe preguntar en qué franja prefieres la recolección. Para desactivar Azure,
cambia `CONVERSADOR=menu` y vuelve a arrancar el backend. En Azure Container Apps, usa un secreto
referenciado por la variable `OPENAI_API_KEY`. [Secretos de Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)

## Conversación, memoria y conocimiento

Con `CONVERSADOR=llm`, el vecino puede saludar, pedir una recolección con sus palabras, indicar una franja como
«por la tarde» o preguntar por su saldo. El diálogo pide el dato pendiente y usa los contratos del backend para consultar
solicitudes, puntos y contenidos. La coordinación conserva la asignación, la programación y el cierre.

| Archivo | Qué puedes ajustar |
|---|---|
| [`agente/politica.md`](../backend/app/modulos/whatsapp/agente/politica.md) | Criterios y ejemplos que guían la interpretación del mensaje |
| [`agente/conocimiento.json`](../backend/app/modulos/whatsapp/agente/conocimiento.json) | Información aprobada sobre EcoConecta y su funcionamiento |
| [`respuestas.json`](../backend/app/modulos/whatsapp/respuestas.json) | Las frases y preguntas que recibe el vecino |
| [`agente/dialogo.py`](../backend/app/modulos/whatsapp/agente/dialogo.py) | Las transiciones, las confirmaciones y las acciones permitidas |

Puedes montar archivos UTF-8 y apuntar `WHATSAPP_AGENT_PROMPT_FILE`, `WHATSAPP_AGENT_KNOWLEDGE_FILE` y
`WHATSAPP_REPLIES_FILE` a sus rutas dentro del contenedor. El backend aplica ediciones válidas sin reiniciar. Publica las
guías de separación desde el módulo **Contenidos** para que el agente lea el catálogo vigente en PostgreSQL.

El backend conserva el paso pendiente de cada chat en `whatsapp.conversaciones.memoria` durante 30 minutos de inactividad.
El registro solicita autorización y admite respuestas como «sí, autorizo», «hogar» o «por la tarde». Usa los contratos existentes
para consultar datos vigentes del vecino autenticado por el canal. Azure recibe una versión filtrada del mensaje actual
y devuelve una etiqueta de un esquema cerrado. La llamada usa `store: false` y un tiempo de espera corto. El diálogo
local puede resolver pasos comunes cuando Azure tarda o falla. [Azure OpenAI Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)

Foundry Memory es una opción en vista previa para recordar información entre sesiones. Foundry IQ permite indexar guías
aprobadas con Azure AI Search cuando el volumen de documentos lo justifique. Para este MVP, la memoria operativa, los
contenidos y los datos de negocio viven en el backend y PostgreSQL. [Foundry Memory](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-memory) · [Foundry IQ](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq)

## Salvaguardas

El despliegue de texto tiene aplicada `ecoconecta-salvaguardas`. El código reduce los datos enviados al modelo, rechaza
intentos explícitos de cambiar instrucciones y valida su etiqueta. La sesión del vecino y las operaciones sobre
solicitudes y puntos se validan en el backend. Las políticas de Azure son una capa adicional a esas autorizaciones.
[Política del proyecto](adr/0013-voz-y-salvaguardas.md) · [Prompt Shields de Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/content-filter-prompt-shields)
