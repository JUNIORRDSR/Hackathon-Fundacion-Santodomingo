# ADR-0013 · Notas de voz y salvaguardas de los agentes de IA

- **Estado:** aceptada · 2026-11-20

## Contexto

Muchos vecinos son adultos mayores o leen poco (RNF-01), y grabar una nota de voz les cuesta menos que escribir.
Hasta ahora una nota de voz se trataba como si fuera una foto. Además, el bot tiene dos usos de IA que reciben
contenido de cualquier persona: la revisión de fotos (ADR-0011) y el conversador con LLM de Jorge (ADR-0003). El §9
pide acotarlos, explicar sus controles y no mandar al modelo datos personales innecesarios.

## Decisión

- **Notas de voz:** Whisper de Azure OpenAI (despliegue `whisper` del recurso `agentic-vision`) por la API v1, en
  español y con el vocabulario del barrio. El texto sigue al conversador como si la persona lo hubiera escrito; el bot
  le muestra lo que entendió y «Tres.» se vuelve «3» para el menú. Se activa con `TRANSCRIPCION_MODELO`.
- **Adjuntos:** `whatsapp/adjuntos.py` descarga primero y reparte por el tipo real del archivo: imágenes a revisión,
  audios a transcripción y lo demás al conversador, como antes. La foto sigue quedando con el pedido.

## Salvaguardas

**En Azure** (`deploy/salvaguardas.sh`, política en `deploy/politica-salvaguardas.json`):

- Política `ecoconecta-salvaguardas` sobre `Microsoft.DefaultV2` en los despliegues de texto e imagen de los dos
  recursos (`agentic-vision` y `ecoconecta-whatsapp-ai`). Whisper no la admite.
- Mantiene los filtros de odio, contenido sexual, violencia y autolesiones en nivel medio, a la entrada y a la salida.
- Agrega Prompt Shields contra jailbreak y contra ataques indirectos (instrucciones escondidas en contenido externo,
  como el texto de una foto), material protegido y groserías en lo que responde el modelo. No filtra las groserías
  del vecino: una queja también es un mensaje.
- Comprobado el 20/11: un intento de jailbreak recibe un 400 `ContentFiltered`, y el bot responde sin caerse.

**En el código:**

- La voz solo se transcribe para vecinos habilitados: antes de autorizar sus datos (Ley 1581) no se envía a nadie.
- Los adjuntos solo se descargan de Twilio por HTTPS o de un `data:` del simulador. El servidor no visita direcciones
  que elija quien escribe (sin SSRF), y la credencial de Twilio no sigue la redirección.
- Cada número puede mandar 6 adjuntos cada 10 minutos. Eso cuida la cuota (Whisper: 3 por minuto) y el costo.
- Topes: 5 MB por foto (la API corta en 413 sin leerla entera), 16 MB por audio, 500 caracteres de transcripción y
  10 a 12 s de espera por llamada.
- El modelo de fotos ignora las instrucciones escritas dentro de la imagen y solo puede responder los valores del
  esquema. Lo que lee el vecino son textos fijos.
- Ante cualquier falla, una respuesta fija («no pudimos entender tu nota de voz»), nunca un error ni la caída de la
  conversación.
- El conversador de Jorge ya filtra las palabras contra un vocabulario del dominio, solo elige entre intenciones
  permitidas, usa `store: false` y vuelve al menú si algo falla.

## Consecuencias

- Con 3 transcripciones por minuto alcanza para la demo, no para el piloto: hay que pedir más cuota.
- El límite por número vive en la memoria del proceso porque hay una sola réplica. Con más réplicas pasa a una tabla.
- La política de contenido vive en Azure; `deploy/salvaguardas.sh` la recrea y la asigna en cualquier recurso.
