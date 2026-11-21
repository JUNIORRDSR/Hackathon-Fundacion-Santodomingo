# ADR-0014 · Directorio del territorio: zonas, conjuntos y registro desde la tableta

- **Estado:** aceptada · 2026-11-21 (diseño aprobado pieza por pieza con Jairo; falta construirla)

## Contexto

El reto pide que zonas, conjuntos, grupos, reglas y premios no queden fijos en el código (RNF-07), que los encargados
se asignen por zonas (RF-09) y que los datos sirvan para la tarifa multiusuario por conjunto (RF-19). La fundación
preselecciona unidades productivas piloto (reto §4, RN-08).

Hoy hay 4 zonas planas sembradas por código («Brisas de San Pablo», «Corredor comercial», «Etapa 1», «Etapa 2»), sin
pantalla para crearlas; la torre y el apartamento van como texto en la dirección. Vecinos y negocios solo entran por
WhatsApp, y Registros solo muestra a los pendientes de aceptar.

## Decisión

1. **Lugares en dos niveles:** zona (Etapa 1 a 4, Corredor comercial) y conjunto o sector (Brisas de San Pablo,
   Mirasol, Álamos, Manzana 19, Sector Salón Comunal…), según `docs/reto/contexto-barrio.md`. Torre, apartamento, casa
   o local van en la dirección. Nueva tabla `directorio.conjuntos` (zona, nombre, activo); `zonas` gana `activo`.
   Ningún lugar se borra: se desactiva, porque solicitudes e historial lo nombran.
2. **El lugar de un vecino o negocio** es un conjunto, o una zona que no tiene conjuntos (el Corredor comercial). Cada
   solicitud guarda la zona y el conjunto del momento, para que el historial no cambie si el vecino se muda.
3. **Registros con tres pestañas:** Por aceptar · Vecinos y negocios (tabla con filtros por tipo, zona y conjunto, y
   botón para registrar) · Lugares (crear y renombrar zonas y conjuntos). Registran la coordinación y el administrador.
4. **Registro desde la tableta:** tipo (hogar o negocio), nombre, WhatsApp, zona y conjunto, dirección y la casilla
   «El vecino autorizó el uso de sus datos». La autorización queda firmada: quién registró y cuándo (Ley 1581 admite
   la autorización verbal con constancia). Queda habilitado de una vez, como un piloto, y el bot le escribe la
   bienvenida que ya envía al habilitar más el aviso de privacidad. El código de la bolsa sigue llegando con cada pedido.
5. **El bot pregunta el lugar una sola vez:** «¿En qué conjunto o sector vives?», con una lista numerada de conjuntos y
   de zonas sin conjuntos; la zona se deduce.
6. **Los encargados cubren conjuntos** (y zonas sin conjuntos). En el formulario, marcar una zona marca sus conjuntos.
   La sugerencia al asignar compara el conjunto de la solicitud.
7. **El CSV del mes suma la columna de conjunto:** de ahí salen los kilos por conjunto para la tarifa multiusuario.
8. **Semillas** con los lugares reales del reto; las personas siguen siendo ficticias.

## Consecuencias

- No hay informes ni competencia por torre (RF-17 queda fuera); un tercer nivel se puede sumar después sin rehacer esto.
- Cambian tablas existentes: publicar exige `REINICIAR_BASE=1` (ADR-0012), porque `create_all` no agrega columnas.

## Alternativas descartadas

- Tres niveles (zona, conjunto, torre) o un árbol libre: más precisos, pero más preguntas para quien usa la tableta.
- Una página «Directorio» aparte de Registros: dos lugares del menú para lo mismo (personas y territorio).
- Que solo el administrador registre: la comunidad opera el sistema (RNF-08).
- Que el bot pida la autorización y deje al vecino pendiente: más sólido, pero en el sandbox de Twilio el número debe
  haberse unido antes, y la demostración se cae.
- Encargados por zona: el reciclador de Brisas quedaría cubriendo toda la Etapa 4.
