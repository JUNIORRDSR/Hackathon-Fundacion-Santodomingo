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
| Programación | Día, hora y encargado acordados (RN-02) | `programar()` |
| Habilitar | Admitir a un solicitante en el piloto (RN-08) | `habilitar()` |
| Movimiento de puntos | Asiento que suma puntos por una recolección. No se edita ni se borra | `Movimiento` |
| Regla de puntos | Base por recolección válida más un bono por kilo, con versión (RN-06) | `Regla` |
| Contenido | Pieza de educación ambiental o tutorial para una audiencia | `Contenido…` |
| Canal | Por dónde entró la solicitud: WhatsApp, registro asistido o simulador | `Canal` |
| Transporte | Cómo entra y sale un mensaje de WhatsApp (Twilio o Cloud API) | `Transporte` |
| Conversador | El cerebro del bot: menú numerado o LLM | `Conversador` |
| Herramientas | Lo único que el bot puede hacer en nombre de un solicitante | `Herramientas` |

## Términos que no se usan

- **Recolector:** la fundación pidió decir «recicladores» (20/11). El genérico es **Encargado**.
- **Aprovechable:** se dice **reciclable**, como en el reto.
- **En revisión:** no es un estado. Una solicitud recibida ya está en la bandeja.
