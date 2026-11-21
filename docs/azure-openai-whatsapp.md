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

Para un despliegue de GPT-5 o GPT-5 mini, añade `CONVERSADOR_RAZONAMIENTO=minimal`: el agente pide razonamiento
mínimo y recibe el razonamiento cifrado para la siguiente ronda (`store: false`). Para GPT-4.1 mini deja esa variable
vacía. Cada turno tiene hasta 12,5 s, el plazo de Twilio, y cada llamada a Azure hasta 8 s.

Ejecuta `docker compose up --build` y usa el [simulador](../README.md#probar-el-bot-sin-whatsapp). Completa el
registro y habilita al solicitante desde la coordinación antes de probar frases como «¿cuántos puntos llevo?»,
«recojan mis reciclables por la tarde» o «¿en qué va mi premio?». Para desactivar Azure, cambia `CONVERSADOR=menu` y
vuelve a arrancar el backend. En Azure Container Apps, usa un secreto referenciado por la variable `OPENAI_API_KEY`.
[Secretos de Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)

## El agente: conversación, memoria, conocimiento y herramientas

Con `CONVERSADOR=llm` responde un agente ([ADR-0016](adr/0016-agente-conversacional-con-herramientas.md)): el modelo
lee la conversación y escribe la respuesta, y actúa con herramientas que el backend ata al vecino que escribe. Puede
contar el estado, los kilos y los puntos de cada recolección, el saldo y los premios, el estado de un canje, pedir o
cancelar una recolección, canjear, cambiar el nombre con el que llamamos al vecino y mandar un cartel ilustrado. La
coordinación conserva la asignación, la programación y el cierre.

| Lo que ofrece Foundry | Cómo se resuelve aquí |
|---|---|
| Instrucciones del agente | [`agente/instrucciones.md`](../backend/app/modulos/whatsapp/agente/instrucciones.md): tono, formato, alcance y límites |
| Knowledge | [`agente/conocimiento.md`](../backend/app/modulos/whatsapp/agente/conocimiento.md) y las guías publicadas en **Contenidos** (PostgreSQL) |
| Memoria corta | Los 14 mensajes más recientes del chat (24 h), de `whatsapp.mensajes`, y el paso pendiente en `whatsapp.conversaciones` |
| Herramientas | [`agente/herramientas.py`](../backend/app/modulos/whatsapp/agente/herramientas.py): un catálogo cerrado con esquemas estrictos |
| Guardarraíles | La política `ecoconecta-salvaguardas` (Prompt Shields) y los controles del código descritos abajo |

Monta archivos UTF-8 y apunta `WHATSAPP_AGENT_PROMPT_FILE` y `WHATSAPP_AGENT_KNOWLEDGE_FILE` a sus rutas dentro del
contenedor para cambiar las instrucciones o el conocimiento sin publicar una imagen: el backend aplica una edición
válida sin reiniciar y conserva la anterior si la nueva está vacía o pasa de 32 KB. Los avisos (recibida,
programada, puntos, rechazo) siguen en [`respuestas.json`](../backend/app/modulos/whatsapp/respuestas.json), igual que
las respuestas del diálogo local que contesta cuando Azure tarda o falla.

Foundry Agent Service permite definir un *prompt agent* en el portal y llamarlo por la misma API Responses. Se
descartó por ahora porque pide el endpoint del proyecto con Entra ID y suma latencia frente al plazo de Twilio. Foundry
IQ (Azure AI Search) tiene sentido cuando haya muchas guías para indexar.
[Llamada a funciones en Foundry](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/function-calling)

## Salvaguardas

El despliegue de texto tiene aplicada `ecoconecta-salvaguardas`. Si Prompt Shields frena un mensaje, el vecino recibe
una respuesta fija. En el código:

- La identidad del vecino la pone el backend y las herramientas no devuelven teléfonos ni direcciones.
- Los números largos y los correos se enmascaran antes de salir.
- Canjear y cancelar exigen que el vecino confirme en un mensaje posterior.
- El nombre editable solo admite letras.
- Cada turno tiene tope de rondas, de tiempo y de largo.

[Política del proyecto](adr/0013-voz-y-salvaguardas.md) · [Prompt Shields de Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/content-filter-prompt-shields)
