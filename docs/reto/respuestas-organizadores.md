# Respuestas de los organizadores (20 de noviembre de 2026)

> Sesión de preguntas del primer día de la hackathon, antes de empezar a desarrollar. Fuente: [../transcripciones/2026-11-20_at_9.40.31_AM.txt](../transcripciones/2026-11-20_at_9.40.31_AM.txt). Las citas usan la forma `[20/11 · mm:ss]`. Las correcciones de Whisper de [00-resumen.md](00-resumen.md) también aplican aquí; además, en este audio "porteros", "puerteros", "guarderos" y "cuartero" son **huerteros**, "megabarco" es **megabarrio** y "tú y yo" o "Twine" es **Twilio**.

## Lo que cambia para el diseño

1. **Solo los dos coordinadores usan tecnología.** Hay una tablet para la coordinación de huerteros y otra para la de recicladores. Los recicladores no manejan información, ni WhatsApp, ni registros: todo lo reportan al coordinador. `[20/11 · 04:14]`
2. **Lo más importante es el flujo de contacto**: solicitante → coordinador → reciclador o huertero → coordinador → solicitante. Los puntos son secundarios. `[20/11 · 03:27]`
3. **La regla de puntos la propone el equipo.** `[20/11 · 01:27]`, `[20/11 · 02:21]`
4. **Hay libertad total para añadir funcionalidades.** La fundación se encarga de que funcionen en la realidad (capacitaciones, cuadernos, Excel). `[20/11 · 14:27]`
5. **No van a responder más preguntas: toca desarrollar.** Lo que se entregue es una propuesta y se ajustará después en el piloto. `[20/11 · 15:17]`

## Preguntas y respuestas

### Puntos e incentivos

**¿Los puntos se dan por frecuencia de solicitudes o por kilos?**
Cualquiera de las dos vale; se puede proponer en las dos vías. A la fundación le importa saber cuánto solicita cada persona y cuánto se recolecta en el barrio, porque uno de sus **indicadores de resultado es toneladas de reciclable recolectadas en el territorio**. En la sala se sugirió proponer las dos reglas y compararlas con una prueba A/B. `[20/11 · 01:27]`, `[20/11 · 01:54]`

**¿Cuántos puntos vale un kilo?**
Lo asigna el equipo dentro de su propuesta. `[20/11 · 02:21]`

**¿Qué se puede canjear?**
Lo ya dicho: los puntos se acumulan para canjes en la huerta o por beneficios en el territorio. Ejemplo de la fundación: un hogar que juntó 20 kg en el mes puede recibir algo. `[20/11 · 00:00]`

**Si el usuario no tiene acceso a la app, ¿cómo ve sus puntos?**
La fundación imagina que, cuando se recoge y se pesa (por ejemplo, en la huerta), **se le notifica a la persona**: "recibimos su residuo, pesó tanto, ganó tantos puntos, lleva tantos acumulados". El canal concreto lo propone el equipo. `[20/11 · 02:29]`, `[20/11 · 03:10]`

### Coordinadores, recicladores y huerteros

**¿Podemos asumir que los recicladores tienen celular e internet?**
No. La comunicación pasa siempre por el coordinador de cada grupo: él recibe la solicitud, la deriva, el reciclador o huertero hace el servicio, le reporta al coordinador y el coordinador le responde al solicitante. Así se reducen los riesgos de que se pierda la información o de que alguien no sepa registrarla. Muchos recicladores son adultos mayores y **algunos no saben leer ni escribir**. `[20/11 · 04:14]`, `[20/11 · 05:26]`

**¿Cómo registran hoy y cómo se comunican internamente?**
La persona de reciclaje (se oyó "Lilian" [verificar]) lleva un **cuaderno**: se sienta con los recicladores y anota cuánto recoge cada uno. Los **15 recicladores** trabajan por **zonas, días y horarios** fijos (por ejemplo, dos en una manzana y uno en la manzana 3) y el coordinador los ve casi a diario, así que la comunicación interna no es problema. Si un reciclador falta, otro compañero lo suple. La fundación no quiere cambiar lo que ya funciona porque eso genera riesgos en temas comunitarios. `[20/11 · 05:14]`, `[20/11 · 06:37]`, `[20/11 · 07:21]`

**¿Se puede proponer cómo mejorar ese registro?**
Sí. Si el equipo cree que hace falta optimizar la sistematización de la coordinadora (por ejemplo, para saber cuánto recogió cada reciclador), puede incluirlo como recomendación. `[20/11 · 13:51]`

**¿Quiénes son los coordinadores?**
Se oyó: **"Vivi"**, coordinadora de los recicladores, y **"Kedi y el señor Luis"**, coordinación de los huerteros [verificar los nombres y si son una o dos personas]. Ellos reciben lo que el equipo proponga, registran la información y la bajan a recicladores y huerteros. No estuvieron en la sesión a propósito. `[20/11 · 12:47]`, `[20/11 · 08:50]`

**Terminología:** la fundación pidió decir **recicladores**, no "recolectores". `[20/11 · 12:33]`

### Alcance y tecnología

**¿Estamos limitados a las funcionalidades pedidas o podemos añadir otras?**
Se puede añadir todo lo que el equipo considere útil. La fundación reconoce que sabe poco de tecnología y pide que el equipo proponga; si eso implica capacitar a los coordinadores o darles un cuaderno o un Excel, ellos lo hacen. Frase textual: "sueñen y háganlo realidad". `[20/11 · 09:15]`, `[20/11 · 14:09]`

**¿Se pueden usar modelos de machine learning?**
Sí. Se puede añadir **MLflow** al stack definido para gestionar esos modelos. `[20/11 · 00:31]`

**WhatsApp: crear la cuenta de Meta Business y verificar un número tarda como una semana. ¿Qué hacemos?**
Usar un **proveedor oficial de la API de WhatsApp como Twilio**, que permite probar con un número de desarrollador sin pagar. No usar herramientas no oficiales que automatizan WhatsApp Web desde el navegador. `[20/11 · 10:28]`, `[20/11 · 11:28]`, `[20/11 · 12:00]`

### Calendario

- **Diciembre de 2026:** piloto con el equipo ganador, la fundación y el apoyo de la facultad. Ahí se harán ajustes.
- **2027:** el aplicativo queda funcionando. Antes se verifica que cumpla los requisitos.

`[20/11 · 16:00]`

## Lo que no se respondió

- Criterios de evaluación y formato de entrega.
- Dónde se aloja el sistema.
- Cómo se registran los usuarios y si se usa la base de datos de la fundación.
- Sanciones por residuos mal separados.
