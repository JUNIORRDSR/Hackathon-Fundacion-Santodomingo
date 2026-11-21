# Glosario (lenguaje ubicuo)

Manda sobre el código: si un término cambia aquí, se cambia en el código el mismo día. Código, API y pantallas van en
español; el inglés queda solo para los tipos del framework.

| Término | Qué es | En el código |
|---|---|---|
| Solicitud | Pedido de recolección que hace un solicitante para un flujo. Es la entidad central | `Solicitud` |
| Recolección | Resultado de una solicitud: se recogió (con kilos o sin pesar) o se rechazó | `registrar_recoleccion`, `rechazar` |
| Flujo | Orgánico o reciclable. Decide el colectivo (RN-01) | `Flujo` |
| Colectivo | Huerteros (orgánicos) o recicladores (reciclables) | `Colectivo` |
| Solicitante | Hogar o unidad productiva que pide. Se identifica por su WhatsApp; no entra a la webapp | `Solicitante…` |
| Tipo de generador | Hogar o unidad productiva | `TipoGenerador` |
| Encargado | Persona del colectivo que recoge: huertero o reciclador. No tiene cuenta; el coordinador registra en su nombre. Es el «recolector» del reto. En pantalla siempre dice «Huertero» o «Reciclador» | `Encargado…` |
| Coordinador | Coordina un colectivo desde la tablet y solo ve la bandeja de su colectivo | `Rol.COORDINADOR` |
| Administrador | La fundación: usuarios, zonas, encargados, contenidos y regla de puntos. Ve todo | `Rol.ADMINISTRADOR` |
| Bandeja | Solicitudes de un colectivo, por estado | `bandeja()` |
| Zona | Sector del barrio, como Brisas de San Pablo o el Corredor comercial. Los encargados cubren zonas | `Zona…` |
| Franja | Preferencia horaria del solicitante: mañana, tarde o noche | `Franja` |
| Asignación | Encargado y día; con hora queda programada y se avisa al vecino (RN-02, ADR-0007) | `asignar()` |
| Monitor | Pantalla de WhatsApp donde la coordinación ve lo que conversa el bot | `monitor.py` |
| Tomar el control | La coordinación responde en una conversación y el bot calla hasta que se la devuelve | `tomar_control()` |
| Habilitar | Admitir a un solicitante en el piloto (RN-08) | `habilitar()` |
| Movimiento de puntos | Asiento que suma puntos por una recolección. No se edita ni se borra | `Movimiento` |
| Regla de puntos | Base por recolección válida más un bono por kilo, con versión (RN-06) | `Regla` |
| Contenido | Pieza de educación ambiental o tutorial para una audiencia | `Contenido…` |
| Canal | Por dónde entró la solicitud: WhatsApp, registro asistido o simulador | `Canal` |
| Transporte | Cómo entra y sale un mensaje de WhatsApp (Twilio o Cloud API) | `Transporte` |
| Conversador | El cerebro del bot: menú numerado o LLM | `Conversador` |
| Herramientas | Lo único que el bot puede hacer en nombre de un solicitante | `Herramientas` |
| Código | Identifica una solicitud (ORG-0042, REC-0017). La persona lo escribe en la bolsa y la coordinación lo busca al pesar | `codigo` |
| Etiqueta | Sticker con el QR del hogar o negocio (`EC1:<id>`). Al pesar, la coordinación lo escanea y llega a su solicitud abierta (ADR-0015) | `EtiquetaVista`, `Lectura` |
| Código del hogar | Número corto y fijo de cada hogar (1008), con dígito verificador. Se escribe en un papel en la bolsa cuando no hay sticker | `codigo`, `numero` |
| Canje | El vecino cambia puntos por un premio: lo pide por WhatsApp (código CAN-0001) y la huerta lo entrega (ADR-0008) | `canjes.py` |
| Premio | Lo que se puede canjear, con su costo en puntos. Lo edita la administración | `PremioVista` |
| Puntos apartados | Los de un canje pedido y aún no entregado: no se pueden volver a usar | `disponible()` |
| Revisión de foto | El bot mira la foto de lo que la persona va a entregar y le dice si está bien separado. Es orientativa: no bloquea ni da puntos | `evaluar`, `EvaluacionFoto` |
| Veredicto | Resultado de la revisión: bien separado, mal separado o no concluyente | `Veredicto` |
| Problema de separación | Lo que la revisión le explica a la persona, como comida entre los reciclables | `Problema` |
| Ordinario | Lo que no se recoge en ningún flujo: papel higiénico, servilletas usadas, pañales | `Problema.ORDINARIO_MEZCLADO` |
| Nota de voz | Audio que manda un vecino habilitado: se vuelve texto y el bot responde como si lo hubiera escrito | `voz.responder` |
| Salvaguardas | Límites a lo que entra y sale de los modelos: filtros de Azure y reglas del código (ADR-0013) | `adjuntos.py` |

## Términos que no se usan

- **Recolector:** la fundación pidió decir «recicladores» (20/11). El genérico es **Encargado**. Las pantallas de
  Daniela aún dicen «Recolectores» para la lista de encargados: se cambia allí, no en el código.
- **Aprovechable:** se dice **reciclable**, como en el reto. La pantalla puede aclarar «Reciclables (aprovechables)».
- **En revisión:** no es un estado. Una solicitud recibida ya está en la bandeja.
