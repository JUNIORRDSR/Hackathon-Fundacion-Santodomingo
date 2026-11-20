# Reto Hackathon Villas de San Pablo: resumen

> Documento base para personas e IAs que trabajen en el proyecto. Se reconstruyó a partir de 13 audios grabados durante la visita de reconocimiento del 17 de noviembre de 2026 (martes). La hackathon se realiza el **viernes 20 y el sábado 21 de noviembre de 2026**. El documento oficial con las especificaciones del reto **aún no se ha entregado**. Cuando llegue, prevalece sobre todo lo que dice esta carpeta.

## El reto en una frase

Construir un **recurso tecnológico** (app, web o WhatsApp; el formato lo propone cada equipo) para que residentes y negocios de **Villas de San Pablo** (Barranquilla) **soliciten la recolección de sus residuos ya separados**. Los **orgánicos** van a los **huerteros** de la huerta comunitaria y los **aprovechables o reciclables** van a los **recicladores**. Un **coordinador** de cada grupo recibe la solicitud y **asigna** a quién la recoge. El usuario **acumula puntos** canjeables y el sistema **genera informes** de lo recolectado.

## Por qué existe

- En el barrio, la mayoría de los residuos que emiten los negocios de comida son **orgánicos**. Hoy no se aprovechan y forman **puntos críticos** (basureros a cielo abierto).
- El 23,9 % de la población señala la gestión de residuos como el principal problema ambiental del barrio.
- El reto es el producto principal del **Piloto de Economía Circular** de la Fundación Santo Domingo (diciembre de 2025 a noviembre de 2027). La comunidad ya recibió capacitaciones, bolsas y canecas. Falta la herramienta.

## Lo esencial del MVP

1. **Solicitar** la recolección de orgánicos o aprovechables de forma muy fácil. Hay usuarios mayores y personas con poca destreza digital.
2. **Enrutar** la solicitud al coordinador correcto: huerteros para orgánicos, recicladores para aprovechables.
3. **Asignar**: el coordinador elige al recolector y la fecha, y el usuario recibe la confirmación.
4. **Validar en la recolección**: el recolector confirma o rechaza indicando el motivo (por ejemplo, residuos mal separados).
5. **Registrar** cantidades (peso) y **sumar puntos** al usuario.
6. **Informes con filtros** para coordinadores y para la fundación: cuánto se recolectó, cuánto se aprovechó y quién aportó.
7. **Educación ambiental**: tips, flyers o videos de unos 30 s sobre cómo separar.

El detalle está en [requerimientos.md](requerimientos.md).

## Índice de esta carpeta

| Archivo | Contenido |
|---|---|
| [fundacion.md](fundacion.md) | Identidad, propósito, líneas y forma de trabajar de la Fundación Santo Domingo |
| [contexto-barrio.md](contexto-barrio.md) | Villas de San Pablo: historia, etapas, equipamientos, población, zonas del piloto |
| [actores.md](actores.md) | Stakeholders: quiénes son, qué hacen hoy y qué necesitan del aplicativo |
| [requerimientos.md](requerimientos.md) | Requerimientos funcionales y no funcionales, priorizados, con su fuente |
| [preguntas-abiertas.md](preguntas-abiertas.md) | Lo que no está claro o no está definido y conviene confirmar con los organizadores |
| [respuestas-organizadores.md](respuestas-organizadores.md) | Preguntas respondidas por los organizadores el 20 de noviembre, primer día de la hackathon |

## Sobre la fuente y su fiabilidad

- **Origen:** notas de voz de WhatsApp grabadas durante la presentación de la fundación y el recorrido por el barrio. Hay ruido, cortes y varias personas hablando. Se transcribieron con Whisper `large-v3`. Las transcripciones crudas están en [../transcripciones/](../transcripciones/).
- **Citas:** las referencias como `[9.24 · 02:47]` indican el audio (hora de grabación) y el minuto dentro de él. Sirven para buscar la frase original en `../transcripciones/2026-11-17_at_9.24.08_AM.txt`. Las que empiezan por `[20/11 · ...]` son de la sesión de preguntas del 20 de noviembre (`2026-11-20_at_9.40.31_AM.txt`).
- **[verificar]** marca un dato que el audio no deja claro (una cifra, un nombre propio). No se debe usar como cierto sin confirmarlo.
- **Correcciones aplicadas por contexto** (Whisper confundió estas palabras):

| En la transcripción | Significa |
|---|---|
| porteros, vuelteros, volteros, guarderos, puertelitos, huesteros | **huerteros** (voluntarios de la huerta comunitaria) |
| Brisa / Establecimiento de San Pablo | **Brisas de San Pablo** (conjunto de la etapa 4, zona del piloto) |
| Villa / Vida / Díaz de San Pablo, Villas | **Villas de San Pablo** |
| jacazón | **hackathon** |
| megavatios, megabarros, de Navarro | **megabarrios** |
| tarifa multiusual / tarjeta de uso | **tarifa multiusuario** (descuento en el servicio de aseo) |
| recurso / recurso tecnológico | el **aplicativo** que se debe construir |
| Tapa 1 | **Etapa 1** |
| Corpos, tituladora | **compost / compostaje**, **trituradora** |
| (Aso) Rescatar | **Asociación de recicladores** del barrio (nombre exacto [verificar]) |
| "somos asistencialistas" | **"no somos asistencialistas"** (el contexto dice que creen en la capacidad de agencia de la comunidad) |
