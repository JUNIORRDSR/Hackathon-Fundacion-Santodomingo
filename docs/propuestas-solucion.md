# Propuestas de solución: lluvia de ideas

> Documento de trabajo del equipo. Las ideas salieron mientras esperábamos el documento oficial del reto. **Nada de esto está decidido.** Son opciones para discutir y elegir. El contexto del reto, los actores y los requerimientos están en [reto/](reto/). En particular: [requerimientos.md](reto/requerimientos.md) (RF y RNF) y [actores.md](reto/actores.md).
>
> **Restricciones que condicionan todo:**
> - Hay usuarios mayores o con poca destreza digital ("que sea fácil para la persona final").
> - Los recolectores (recicladores y huerteros) **no tienen smartphone ni datos**.
> - Solo los coordinadores tienen **tablet**.
> - El internet del barrio es inestable.
> - El aplicativo lo **opera la comunidad**, no la fundación.
> - El piloto debe funcionar alrededor de un **80 %**.

---

## 1. El problema de la validación: el "recibo inverso"

### La idea del equipo
1. Al hacer la solicitud, la app le genera un código al usuario.
2. El reciclador anota ese código en papel cuando recoge.
3. Mientras tanto, la solicitud queda "por evaluar".
4. Al final del día, el reciclador entrega sus hojas al coordinador, que valida y digita los códigos.
5. Si la recolección fue satisfactoria, el usuario recibe sus puntos.

### Lo que funciona
- El código solo lo conoce el solicitante. Si el reciclador lo tiene anotado, queda probado que hizo la visita.
- Respeta que los recicladores están acostumbrados al papel.

### Sus debilidades

| Problema | Por qué pesa |
|---|---|
| El coordinador se convierte en digitador | Es el cuello de botella y hace que el sistema no escale |
| La hoja se pierde o no se entiende | Escanear la hoja solo traslada el error de digitación al escaneo |
| El punto llega tarde ("por evaluar" hasta la noche) | Un premio diferido motiva mucho menos, y la comunidad necesita estímulo para separar |
| La calidad se juzga de memoria al final del día | Nadie recuerda bien cómo estaban 15 bolsas horas después |
| Copiar 6 dígitos a mano en la calle | Habrá errores, sobre todo con recicladores mayores |
| No registra el peso | Sin kilos no hay informes (RF-18) ni soporte para la tarifa multiusuario |

**Causa común:** el reciclador queda en medio de la cadena de datos sin tener un dispositivo.

### El principio que lo resuelve

> **El código tiene que viajar hacia quien tiene el celular, no hacia quien tiene el papel.**
> Cada dato se registra donde ya existe un dispositivo: el celular del **solicitante** (que hizo la solicitud) o la **tablet de la coordinadora**, que está junto a la **báscula** en el punto de acopio o en la huerta.

| Qué pasa | Quién tiene dispositivo ahí | Cómo se registra |
|---|---|---|
| Se hace la solicitud | El solicitante | En la app |
| Se recogen los residuos | El solicitante, si está presente | Escanea un código que le entrega el reciclador |
| Se verifica cantidad y calidad | La coordinadora con tablet y báscula | Escanea y pesa |
| Se otorgan los puntos | Nadie hace nada | Se calculan solos a partir de lo anterior |

---

## 2. Nueve propuestas de solución completas

Cada una cubre el ciclo entero: cómo se pide, cómo se valida sin dispositivo, cómo se incentiva y cómo se educa. No compiten entre sí: resuelven capas distintas y **se pueden combinar** (ver la sección 3).

### 2.1 "La boleta": el reciclador valida arrancando un papel, sin escribir nada
El usuario pide la recolección con un toque y el sistema se la **asigna automáticamente al reciclador de su zona** (por ejemplo, Víctor en Brisas). La coordinadora solo corrige casos puntuales.

Víctor lleva un **talonario de boletas impresas** por la fundación, cada una con un QR y un código corto de 4 dígitos. El talonario está registrado a su nombre. Al recoger, **revisa la bolsa**, porque nadie conoce mejor los materiales que un reciclador:
- Si está bien separada, **arranca una boleta y se la entrega**, o la deja en la puerta.
- Si está mal separada, deja una **tarjeta amarilla con dibujos de los errores más comunes** (sirve como educación).

El usuario escanea la boleta o digita el código y **en ese momento** se cierra el servicio y le llegan los puntos.

**Por qué funciona:**
- El reciclador no escribe ni carga datos, y no depende de la coordinadora.
- Una boleta perdida no borra nada: solo queda un punto sin cobrar.
- Arrancar una boleta de un talonario es un gesto que cualquier persona mayor ya conoce.

**Control:** al final del día la coordinadora compara las boletas canjeadas de cada reciclador con los kilos que él entregó en el punto de acopio.

### 2.2 "La rifa verde": cada bolsa bien separada es una boleta para la rifa del mes
Se monta sobre la boleta. En lugar de una economía de puntos que exige presupuesto, equivalencias y catálogo de premios, **cada boleta validada es una participación en una rifa mensual** de un mercado, una nevera o lo que consiga un patrocinador. El sorteo se hace en vivo en la huerta.

- Los premios inciertos motivan más que los puntos pequeños y seguros, cuestan mucho menos que premiar cada kilo y las rifas son parte de la cultura de barrio en Colombia.
- Se puede sumar una **rifa por torre** con premio colectivo, como la silla de ruedas o la camilla que ya se planean.

⚠️ **Legal:** en Colombia los sorteos promocionales los regula **Coljuegos** (Ley 643 de 2001). Hay que confirmar con la fundación cómo encuadrarlo.

### 2.3 "La bolsa con identidad": se valida en la báscula, no en la calle
Cada hogar recibe con su kit un **rollo de stickers con su QR** (y un código corto como `T34-402` por si hay que escribirlo a mano). **El sticker es su cuenta:** no hace falta registrarse con datos personales.

1. El usuario pide la recolección y pega un sticker en la bolsa.
2. El reciclador solo la transporta.
3. En el acopio o en la huerta, donde ya hay báscula, la coordinadora **escanea los stickers en lote**, pesa y marca "bien separada" o "mal separada". Los puntos se acreditan al escanear.

- **Ventajas:** captura el peso de cada hogar (para informes y tarifa multiusuario), funciona para quien no tiene celular y es muy difícil hacer trampa.
- **Desventajas:** la carga de trabajo vuelve a la coordinadora y la validación llega horas después de la recolección.
- Se puede complementar con un **carnet plastificado con QR para cada reciclador**: si el usuario está en casa, lo escanea y queda registrado "Víctor recogió tu bolsa".

### 2.4 "La libreta verde": un banco de residuos con cuenta de ahorro
Viene de los bancos de residuos de Indonesia (más de 11.000) y de Wecyclers en Lagos. Cada hogar tiene una **cuenta, como en un banco**, y lo que entrega se registra como **"ahorro verde" en pesos equivalentes** según el precio del material.

- En la app se ve como un extracto. Para quien no tiene celular hay una **libreta física** que se actualiza en cada entrega en la huerta.
- El ahorro se retira en plántulas, compost, bolsas o productos.
- Es la propuesta que mejor habla el idioma de la fundación: **reciclar se vuelve ahorro familiar, es decir, movilidad social**.
- **Lo difícil:** fijar los precios y respaldar ese ahorro con algo real.

### 2.5 "El mercado de la huerta": un día de trueque al mes
Inspirado en **Câmbio Verde** de Curitiba, que en 2023 cambió más de 2.800 toneladas de reciclables por 890 toneladas de alimentos. Una vez al mes la huerta abre un **mercado donde lo acumulado se cambia por hortalizas, plántulas y compost**, con una tabla pública del tipo "X kg = 1 atado de cebollín".

- El mercado también sirve como evento educativo, jornada para inscribir a nuevos usuarios y entrega de kits.
- La app se encarga de las solicitudes y de llevar la cuenta de lo acumulado. El canje es presencial y comunitario.
- Cierra el ciclo de forma literal: **tu cáscara vuelve como comida**.
- **Requiere** el permiso de la Alcaldía y que la huerta tenga producción suficiente.

### 2.6 "El embajador de torre": la torre es la unidad, no el apartamento
En Brisas el trabajo ya se organiza por torre. Un **vecino voluntario por torre**, con smartphone, registra lo que deja cada apartamento en el cuarto de basura y avisa a la coordinadora cuando hay volumen suficiente.

- **La solicitud es de la torre, no de cada familia.** El reciclador hace un solo viaje.
- Los puntos se dan a cada apartamento y también a la torre.
- El **ranking entre torres** es público y se imprime en la cartelera de la portería, lo que digitaliza la libreta que hoy lleva Víctor.
- Valida quien tiene el dispositivo (el embajador). Se apoya en la presión social y en la organización que ya existe. Para replicarlo basta con nombrar un embajador por torre.

### 2.7 "Negocio Circular": a los restaurantes no les interesan las plántulas, les interesan los clientes
Para el corredor comercial no funciona una solicitud cada vez. Lo que sirve es una **ruta fija** (por ejemplo, lunes a sábado a las 10 p. m.) con un botón de "hoy no". Un huertero recoge y **la báscula de la huerta registra los kilos de cada negocio**.

- El incentivo no son puntos sino **reputación**: un **sello "Negocio Circular"** para la vitrina, que se renueva cada mes si el negocio mantiene buena separación.
- Aparición en un **mapa del corredor** visible para los vecinos ("este restaurante convirtió 120 kg en compost este mes").
- Conecta con la línea de desarrollo económico de la fundación. Los negocios son la mayor fuente de orgánicos y de puntos críticos.

### 2.8 "Sin datos, sin app": funciona con llamada perdida y SMS
Para quien tiene un celular básico o no tiene datos. Un **celular Android viejo con SIM, en el punto de acopio, funciona como pasarela de mensajes de texto**.

- El usuario pide con una **llamada perdida** o un SMS con "1" (orgánico) o "2" (aprovechable). El sistema lo identifica por su número.
- Recibe la confirmación y los puntos por SMS, como en Wecyclers.
- Los recicladores que tengan un celular básico pueden confirmar con "OK 4821", parecido a como Coliba (Ghana) usa USSD con sus recolectores.
- Funciona aunque el internet se caiga. La demo de pedir con una llamada perdida desde un celular de teclas en pleno pitch es difícil de olvidar.

### 2.9 "Todo por WhatsApp": cero instalación
Toda la parte del usuario funciona por **WhatsApp**, que la comunidad ya usa (el grupo de la huerta tiene entre 60 y 70 personas).

- El usuario envía "1" o "2", o una **nota de voz** que se transcribe.
- Los puntos y los consejos de separación le llegan como mensajes.
- La coordinadora trabaja en un panel web desde su tablet.
- No hay app que descargar ni contraseña que olvidar. Es la opción con menos fricción para el usuario.
- **Punto débil:** la API de WhatsApp Business requiere verificación de Meta. Para la demo habría que usar un entorno de prueba.

---

## 3. Combinación recomendada

| Capa | Recomendación | Por qué |
|---|---|---|
| **Cómo se pide** | PWA con un botón grande, más WhatsApp (2.9) o llamada perdida (2.8) como alternativas | Nadie queda por fuera, sin importar el celular que tenga |
| **Cómo valida el reciclador** | **La boleta (2.1)** | Valida quien sabe de materiales, sin escribir nada, con puntos inmediatos y sin cargar a la coordinadora |
| **Cómo se mide** | Báscula por reciclador y por día en el acopio y la huerta (versión ligera de 2.3) | Sirve para auditar las boletas, para los informes y para la tarifa multiusuario |
| **Incentivo para hogares** | Rifa verde (2.2) + mercado de la huerta (2.5) | Barato, cultural, cierra el ciclo y es un evento educativo |
| **Incentivo para negocios** | Negocio Circular (2.7) | Reputación en lugar de premios |
| **Organización en Brisas** | Ranking por torre (2.6) | Ya existe; solo hay que digitalizarlo |

**Mensaje para el pitch:** *"El reciclador valida con una boleta, el vecino gana una rifa y la cáscara vuelve como comida."* Son tres objetos físicos (la boleta, la tarjeta amarilla y el sello) que se pueden repartir al jurado durante la demo.

---

## 4. Diseño de incentivos

- **Premiar la separación y la constancia, no los kilos.** Si los puntos dependen del peso, se premia generar más basura. Mejor puntos (o boletas) por bolsa bien separada, más bonos por semanas seguidas participando. El peso se registra igual, para los informes. En los negocios sí conviene medir kilos, porque son pocos, grandes y la huerta necesita saber su capacidad.
- **Cerrar el ciclo:** canje por plántulas y compost de la propia huerta y por bolsas para orgánicos (lo pidieron en el recorrido). *"Tu cáscara de hoy vuelve a tu casa como una planta."*
- **Competencia entre torres:** incentivo social que no cuesta nada y que la fundación ya está aplicando.
- **El rechazo como momento educativo**, no como castigo seco: "Tu bolsa tenía plástico con los orgánicos 👉 mira este video de 30 s".

---

## 5. Componente educativo y de concientización

El contenido que pidió la comunidad (flyers, videos de unos 30 s) **no existe**: los talleres actuales son prácticos, sin material (RF-21). Propuesta:

1. **Educar en el momento justo, no en una sección aparte:**
   - Antes de la primera solicitud: una tarjeta de 15 s con "qué va en cada bolsa".
   - Al elegir el tipo de residuo: íconos con ejemplos del barrio (cáscaras de plátano, arepa, cartón de huevos).
   - Cuando una bolsa se rechaza: el aviso dice qué estaba mal y trae un video de 30 s sobre eso.
2. **Medir la concientización:** el porcentaje de bolsas bien separadas por torre, por negocio y por semana. Si sube después de un taller, queda demostrado que el taller funcionó. Hoy la fundación no tiene ese indicador y le sirve para el monitoreo de 2027.
3. **El contenido es un entregable:** 3 o 4 piezas (qué va en orgánicos, qué va en aprovechables, cómo preparar el material, el viaje de la cáscara). Aquí sí sirven los gráficos y videos hechos con IA, siempre que usen ejemplos y lugares de Villas.
4. **Llegar a quien no tiene la app:** las mismas piezas se reenvían al grupo de WhatsApp de la huerta y se imprimen en la cartelera de cada torre.

### Recorrido guiado de primer uso (onboarding)
- Es fácil de implementar con una librería ligera como [driver.js](https://driverjs.com): una o dos horas.
- **3 pasos como máximo**, letra grande, una idea por paso: *Pide · Pega · Gana*.
- Mejor que el recorrido sea **la primera solicitud real**, guiada paso a paso, que una explicación de la pantalla.
- Que cada paso **se escuche** además de leerse (síntesis de voz del navegador), con un botón "Ver de nuevo" siempre visible.
- Variantes: el guía es el reciclador de tu zona con su foto y su voz; minijuego de 30 s para arrastrar residuos a la bolsa correcta; el recorrido reaparece en miniatura cuando te rechazan una bolsa.

---

## 6. El factor WOW para ganar

**Lección de la hackathon anterior:** hacer muchos entregables (SRS, despliegue en la nube, página promocional, videos con IA) se lee como "producto genérico bien pulido". Los jurados de una organización premian tres cosas: **sentirse escuchados**, **evidencia con la gente real** y **saber qué pasa el lunes siguiente** (quién lo opera, cuánto cuesta, cómo se escala).

### Pieza 1: "Funciona aunque no tengas celular", demostrado en vivo con tres dispositivos
1. "Doña Carmen, 68 años, Torre 34" (un jurado) pide la recolección con un toque o por voz: *"Tengo dos bolsas de orgánicos"*.
2. La tablet de la coordinadora suena frente a todos: la solicitud quedó asignada a Víctor para mañana.
3. Se entrega la boleta o se escanea la bolsa, y en el celular de Doña Carmen aparecen los puntos.
4. Opcional: se pone el celular en **modo avión**, se escanea, se reconecta y todo se sincroniza. *"En Villas el internet se cae; ya lo vimos con el call center."*

**Implementación:** la voz sale de la API de reconocimiento de voz del navegador (sin servidor, sin costo). Para clasificar basta con palabras clave. El "tiempo real" se logra consultando cada 3 s, sin websockets.

### Pieza 2: hablar el idioma de la fundación, movilidad social en pesos
Un panel de **"Impacto que se queda en el barrio"**:
- Pesos que ganan los recicladores por el material vendido.
- Ahorro estimado en la tarifa de aseo, con un botón **"Generar soporte para la tarifa multiusuario"** (el segundo producto del proyecto, que casi nadie va a recordar). En propiedad horizontal la tarifa se calcula con aforos de lo que realmente se presenta (Res. CRA 233/2002).
- Kilos que no llegaron al relleno sanitario y compost producido.
- Para el director: *"Esto convierte el programa ambiental que ustedes entregan al vender cada lote en un producto medible. Mañana se replica en Ciudad del Bicentenario cambiando una configuración."*
- Además, los registros de toneladas aprovechadas le sirven a la asociación de recicladores en su proceso de formalización (Decreto 596 de 2016).

### Pieza 3: diseñado *con* ellos, no *para* ellos
Si la hackathon es en el barrio o cerca, **probar el prototipo con Víctor o con la coordinadora de la huerta** el viernes, con permiso, y grabar 20 s de su opinión. *"Doña ___ validó 10 bolsas en 40 segundos"* vale más que cualquier diagrama. Encaja con el principio de la fundación: capacidad de agencia, no asistencialismo.

**Complemento barato:** un botón que **imprime el cartel semanal del ranking entre torres** para la portería.

### Cómo encaja con el 80 % de funcionamiento
- **Primero el flujo central, sólido de punta a punta:** solicitar, asignar por zona, validar, sumar puntos, generar informe.
- **Los WOW son pequeños a propósito.** Si falta tiempo, el orden de recorte es: modo avión, después el cartel, después el panel en pesos. **La demo en vivo con la boleta o la bolsa no se recorta.**
- **Plan B:** un video grabado del flujo por si falla el wifi del lugar.

### Estructura del pitch (unos 5 minutos)
1. **Una persona, no una estadística (30 s):** Víctor y su cuaderno, o Doña Carmen con sus cáscaras.
2. **"Ustedes nos dijeron…" (30 s):** su propia frase, *"que sea fácil para la persona final"*.
3. **Demo en vivo con tres dispositivos (2 min).**
4. **Impacto en pesos y tarifa multiusuario (1 min).**
5. **El lunes siguiente (40 s):** costo mensual, quién lo opera, kit físico, manual de una página para la coordinadora, plan de réplica.
6. **Cierre:** *"Tu cáscara de hoy vuelve a tu casa como una planta."*

---

## 7. Otras decisiones que más pesan

- **Canal:** web instalable en el celular (PWA) más WhatsApp como puerta de entrada. No obliga a descargar nada (los celulares baratos tienen poco espacio) y funciona sin conexión.
- **Registro por hogar, no por persona:** "Torre 34 – Apto 402", activado con el QR del kit y un PIN. Solo los datos mínimos, por la desconfianza de los adultos mayores (Ley 1581 de 2012).
- **Funcionar sin conexión:** la app y la tablet guardan los escaneos y los sincronizan cuando hay señal.
- **Asignación automática por zona:** la coordinadora solo corrige excepciones.
- **Stack:** esperar el documento oficial. Las herramientas ya están definidas por la fundación (se mencionaron Python y PHP, sin confirmar).

---

## 8. Supuestos que hay que confirmar con los actores

- ¿El punto de acopio tiene **báscula**? (La huerta sí la tiene.)
- En Brisas, ¿las bolsas se dejan en el **cuarto de basura de la torre** o se entregan en la puerta?
- ¿La fundación puede **imprimir y repartir** boletas, stickers y carnets junto con las bolsas?
- ¿Cuántas bolsas por día recibirían la huerta y el acopio? ¿Cuál es la capacidad máxima de la huerta para orgánicos?
- ¿La rifa es viable legalmente (Coljuegos)? ¿Hay patrocinadores?
- ¿La Alcaldía permitiría el mercado de trueque en la huerta?
- **Criterios de evaluación de la hackathon:** si traen rúbrica, se reordena todo según el peso de cada criterio.

---

## Referentes consultados

- [Wecyclers (Lagos) – Afrik21](https://afrik21.africa/en/nigeria-lagos-wecyclers-transforms-waste-into-credits-for-mobile-phones) · [MIT Solve](https://solve.mit.edu/solutions/9090): puntos por SMS según peso y calidad, canje en eventos periódicos.
- [Câmbio Verde (Curitiba) – Prefeitura](https://www.curitiba.pr.gov.br/noticias/cambio-verde-troca-reciclaveis-por-890-toneladas-de-hortifruti-em-curitiba-em-2023-saiba-como-funciona/72350): 4 kg de reciclables = 1 kg de frutas y verduras.
- [Bancos de residuos (Indonesia) – World Bank](https://blogs.worldbank.org/eastasiapacific/waste-not-want-not-waste-banks-indonesia) · [Inside Indonesia](https://www.insideindonesia.org/java-s-waste-banks): libreta de ahorro con kg y valor en dinero.
- [Coliba (Ghana) – GSMA](https://www.gsma.com/mobilefordevelopment/wp-content/uploads/2019/11/Coliba-Using-mobile-to-create-a-formalised-plastic-recycling-economy-in-Africa.pdf): solicitudes por web, app o SMS; USSD para recolectores con celular básico.
- [Amazóniko (Bogotá) – El Espectador](https://www.elespectador.com/economia/emprendimiento-y-liderazgo/amazoniko-el-administrador-que-creo-una-plataforma-de-reciclaje-colaborativo-en-colombia/) · [VITIA – La FM](https://www.lafm.com.co/colombia/lanzan-aplicacion-vitia-para-fomentar-el-reciclaje-en-colombia): referentes colombianos que suponen recolector con smartphone o vehículo propio.
- [Decreto 596 de 2016 – MinVivienda](https://www.minvivienda.gov.co/node/24563): formalización de recicladores de oficio.
- [Cartilla multiusuarios – CRA](https://www.cra.gov.co/sites/default/files/documents/2017-12/cartilla_multiusuarios.pdf): tarifa de aseo en propiedad horizontal por aforo.
