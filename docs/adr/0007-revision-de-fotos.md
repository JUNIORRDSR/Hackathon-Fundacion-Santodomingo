# ADR-0007 · Revisión orientativa de fotos de residuos

- **Estado:** aceptada · 2026-11-20

## Contexto

La fundación imaginó reconocer el residuo por foto, pero lo dejó como opcional (RF-24), y el reto pide construir primero
la ruta crítica (§15.3). Si el solicitante manda por WhatsApp la foto de lo que va a entregar, puede saber antes de la
recolección si está bien separado y aprender en ese momento, en lugar de enterarse con un rechazo. El §8.1 solo permite
modelos de OpenAI, Azure OpenAI, Azure AI Foundry y Claude, y el §9 pide explicar modelo, datos, resultado y controles.

## Decisión

- Módulo `clasificacion` con `evaluar(foto, flujo) -> EvaluacionFoto`: un veredicto (`bien_separado`, `mal_separado` o
  `no_concluyente`) y los problemas que vio, como `organico_en_reciclables` o `envases_sucios`.
- **Modelo:** un despliegue con visión de Azure OpenAI (por ejemplo `gpt-5-mini`) por la API v1 (Responses), con salida
  JSON de esquema estricto y razonamiento mínimo. Se llama con `urllib`, sin dependencias nuevas. El mismo código sirve
  con la API de OpenAI si se quita `OPENAI_BASE_URL`.
- **Datos procesados:** la foto y el flujo que la persona dijo que va a entregar. Nunca el teléfono, el nombre ni la
  dirección. El proveedor no guarda la respuesta (`store: false`).
- **Resultado:** un texto fijo por problema, no texto libre del modelo (como los avisos, ADR-0003), y la pieza educativa
  del flujo (`contenidos.para_rechazo`).
- **Por WhatsApp:** si un solicitante habilitado manda una foto y `CLASIFICACION_ACTIVA=true`, `bot._responder` la revisa
  antes del conversador (`whatsapp/fotos.py`). La credencial de Twilio solo viaja a `api.twilio.com` y no sigue la
  redirección hacia el almacenamiento de Twilio.
- **Plan B de la demo:** `POST /api/clasificacion/evaluar`, con sesión, revisa una foto desde `/docs`.

## Controles

- Es orientativo: no bloquea, no cambia el estado de la solicitud y no suma ni resta puntos. Quien valida es el
  encargado al recoger (RF-10), y el pedido sigue aunque la foto salga mal separada.
- Ante la duda (`foto_no_valida`) o un error, responde `no_concluyente`. Nunca lanza ni tumba la conversación.
- Si el modelo se contradice (dice «bien separado» y lista problemas), mandan los problemas.
- La respuesta solo puede tomar los valores del esquema. La llamada tiene un límite de 12 s (Twilio espera 15) y la foto,
  de 5 MB.
- Cada revisión queda en el log con el veredicto, los problemas y el modelo, sin datos personales.

## Consecuencias

- Se apaga cambiando `CLASIFICACION_ACTIVA`, sin tocar el código.
- La evaluación no se guarda en la base, así que todavía no se compara, solicitud por solicitud, con lo que registró el
  encargado. Si hace falta, se agrega una tabla en el esquema `clasificacion` con el ID de la solicitud.
- Qué orgánicos recibe la huerta (carne, huesos, lácteos) está por validar con ella; las reglas están en
  `clasificacion/dominio.py`.
- Las piezas educativas son por flujo. Si contenidos agrega un tema por problema, la respuesta puede ser más precisa.
