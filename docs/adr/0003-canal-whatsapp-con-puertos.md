# ADR-0003 · WhatsApp con dos puertos: Transporte y Conversador

- **Estado:** aceptada · 2026-11-20
- **Modificada por:** [ADR-0016](0016-agente-conversacional-con-herramientas.md)

## Contexto

El solicitante no entra a la webapp: todo pasa por WhatsApp. El reto exige WhatsApp Business Cloud API, y los
organizadores aceptaron un proveedor oficial como Twilio porque verificar con Meta tarda una semana (20/11). Jorge hace
la integración con la API y Leonardo un LLM para que el bot no sea un menú. El §9 exige control humano en asignación,
horario y cierre, y no mandar al modelo datos personales innecesarios.

## Decisión

- Tres entradas a un mismo contrato, `solicitudes.registrar`: WhatsApp, registro asistido desde la tablet y simulador.
  El núcleo no sabe de dónde viene una solicitud.
- `whatsapp/contrato.py` define dos puertos:
  - **Transporte** (Jorge): cómo entra y sale un mensaje. Por defecto, `TransporteSimulado`; Twilio Sandbox o Cloud API
    entran con `TRANSPORTE=twilio`.
  - **Conversador** (Leonardo): el cerebro del bot. Por defecto, `ConversadorMenu`; el LLM entra con `CONVERSADOR=llm`.
- El conversador solo actúa con **Herramientas**, que el sistema ata a la identidad del solicitante: pedir recolección,
  ver mis solicitudes, ver mis puntos, aprender y cancelar. No puede asignar, programar ni cerrar.
- Al conversador le llegan el nombre o alias y el texto; nunca el teléfono ni la dirección. Las herramientas devuelven
  solicitudes resumidas, sin datos personales.
- Si el conversador falla, responde el menú: la conversación no se cae.
- El registro y la autorización de datos (Ley 1581) son deterministas y no pasan por el conversador.
- Los avisos (recibida, programada, resultado con puntos, rechazo con pieza educativa, cancelación y habilitación) los
  manda el sistema con plantillas fijas, no el LLM.

## Consecuencias

- El LLM y la API se integran sin tocar el núcleo. Si el LLM falla en la demo, se vuelve al menú cambiando una variable.
- El simulador sirve para desarrollar sin credenciales y como plan B de la demo.
- Quien integre el LLM documenta modelo, datos procesados, resultado y controles, como pide el §9.
