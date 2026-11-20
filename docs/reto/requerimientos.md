# Requerimientos del aplicativo

> Extraídos de los audios del 17 de noviembre de 2026. Cuando llegue el documento oficial del reto, se debe contrastar con él. **Prioridad:** **MVP** = se pidió explícitamente y es el núcleo del reto · **Deseable** = se mencionó como idea o valor añadido · **Fase 2** = la fundación lo dejó para después o lo marcó como escalable. **Fuente:** `[audio · minuto]`, ver [00-resumen.md](00-resumen.md).

## Lo que define la fundación y lo que queda abierto

La fundación fue explícita en esto: **"Lo importante aquí es que hay una solicitud de recolección. Parte de su propuesta es cómo se hace esa solicitud: si por texto, por imagen o por una señal de humo."** `[9.44 · 02:44]` Por eso **el canal (app, web o WhatsApp) y la forma de solicitar los decide el equipo**. Lo que no se negocia es el flujo y la facilidad de uso.

## Flujo principal

```
1. Usuario (residente o negocio) separa en orgánico / aprovechable
2. Crea una SOLICITUD de recolección (tipo de residuo, ubicación; opcional: foto, cantidad estimada)
3. El sistema la ENRUTA: orgánico → coord. huerteros · aprovechable → coord. recicladores
4. El coordinador ASIGNA recolector y fecha → el usuario recibe la confirmación ("mañana pasa Rosa")
5. El recolector RECOGE y VALIDA (acepta / rechaza con motivo)
6. Destino: orgánico → huerta (pesaje → compostaje) · aprovechable → punto de acopio
7. Se REGISTRA la cantidad (kg) → se otorgan PUNTOS al usuario
8. Los datos alimentan los INFORMES (fundación, coordinadores, tarifa multiusuario)
```

`[9.24 · 02:29–03:45]`

## Requerimientos funcionales

### Solicitud (usuario final)

| ID    | Requerimiento                                                                                                                                                                                       | Prioridad                               | Fuente                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| RF-01 | Registro e identificación del usuario como **residente** (hogar, torre o apto) o como **unidad productiva** (negocio). Se puede reutilizar la base de datos que ya tiene la fundación | MVP                                     | `[9.07 · 15:28]`, `[9.46 · 01:20]` |
| RF-02 | Crear una **solicitud de recolección** indicando el **tipo de residuo**: **orgánico** o **aprovechable/reciclable**                                                       | MVP                                     | `[9.24 · 02:43]`                      |
| RF-03 | Adjuntar una **foto** de los residuos a la solicitud                                                                                                                                          | MVP (se mencionó como parte del flujo) | `[9.24 · 02:47]`                      |
| RF-04 | Ver el **estado** de la solicitud: pendiente → asignada (quién y cuándo) → recolectada / rechazada (motivo)                                                                               | MVP                                     | `[9.24 · 03:16]`, `[9.44 · 16:12]` |
| RF-05 | **Entrega directa:** el usuario que vive cerca de la huerta lleva él mismo sus orgánicos y queda registrado (sin recolección)                                                              | Deseable                                | `[10.34 · 00:00]`                     |
| RF-06 | Consultar el **saldo de puntos** e historial                                                                                                                                                  | MVP                                     | `[9.24 · 03:21]`                      |

### Coordinación (coordinadores, en tablet)

| ID    | Requerimiento                                                                                                                                        | Prioridad | Fuente                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------- |
| RF-07 | **Bandeja de solicitudes** según el tipo de residuo: huerteros ven las de orgánicos y recicladores las de aprovechables                      | MVP       | `[9.07 · 14:58]`                       |
| RF-08 | **Asignar** cada solicitud a un recolector de su grupo con una **fecha** de recolección. Esto **notifica al usuario**             | MVP       | `[9.24 · 03:07]`                       |
| RF-09 | Gestionar su grupo de recolectores (alta y baja) y **asignarlos por zonas** (etapa, sector, torre). Los recicladores ya trabajan por zona      | MVP       | `[9.44 · 06:45]`, `[9.44 · 08:40]`  |
| RF-10 | Registrar el resultado de cada recolección: **recolectada con peso en kg** o **rechazada con motivo** (por ejemplo, mal separada)       | MVP       | `[9.44 · 16:02]`, `[10.40 · 00:41]` |
| RF-11 | Registrar los **pesajes de orgánicos** que entran a la huerta (hoy en papel), incluidas las entregas directas                                 | MVP       | `[10.40 · 00:41]`                      |
| RF-12 | Funcionar aunque **los recolectores no tengan smartphone**: el coordinador hace todo desde la tablet y contacta a su gente por su propio medio | MVP       | `[9.44 · 17:04]`                       |

### Puntos e incentivos

| ID    | Requerimiento                                                                                                                                                                                  | Prioridad                      | Fuente                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| RF-13 | **Acumular puntos** por residuos entregados. La regla de equivalencia (kg, frecuencia mensual u otra) **está por definir**: la fija la fundación y los equipos pueden proponerla | MVP (con regla configurable)   | `[9.24 · 07:07]`, `[9.44 · 00:00]` |
| RF-14 | **Canje de puntos** en la huerta (plantas, plántulas), mercados, etc.                                                                                                                   | Deseable / Fase 2              | `[9.24 · 03:39]`                      |
| RF-15 | Beneficios concretos: reposición de **bolsas para orgánicos**, entrega de **plántulas** por cantidad de orgánicos                                                              | Deseable                       | `[10.35 · 00:00]`                     |
| RF-16 | **Sanciones o penalizaciones** (por ejemplo, por residuos mal separados), además de premios, al estilo de Puntos Colombia                                                               | Deseable (abierto a propuesta) | `[9.44 · 15:02]`                      |
| RF-17 | **Competencia entre torres:** ranking de reciclaje por torre que digitalice el conteo manual de Víctor. La torre ganadora recibe un premio comunitario                                  | Deseable                       | `[10.24 · 00:00]`                     |

### Informes y métricas (fundación y coordinadores)

| ID | Requerimiento | Prioridad | Fuente |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------- |
| RF-18 | **Informes con filtros**: cuánto se recolectó, cuánto se aprovechó, **por usuario**, por tipo de residuo, por zona o torre, por recolector y por periodo. Ejemplo: "el usuario X aportó X kg" | MVP | `[9.44 · 00:28]` |
| RF-19 | Exportar datos que **soporten la tarifa multiusuario** de Brisas ante la empresa de aseo (kg desviados del relleno sanitario por conjunto) | Deseable | `[9.24 · 04:27]` |
| RF-20 | **KPIs** de desempeño del aplicativo y del programa. No están definidos; el equipo puede proponerlos (solicitudes atendidas, tiempo de respuesta, tasa de rechazo, kg por mes, usuarios activos) | Deseable | `[9.44 · 13:34]` |

### Educación y comunicación

| ID    | Requerimiento                                                                                                                                                                                                                                                                                                                                                          | Prioridad | Fuente                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- |
| RF-21 | **Educación ambiental** dentro del aplicativo: mensajes, flyers y **videos cortos de unos 30 s** sobre cómo separar. Se pidió en el grupo focal con la comunidad. **Ese material no existe todavía:** los talleres actuales son prácticos, sin documentos, sin metodología escrita y sin videos, así que el contenido lo debe crear el equipo | MVP       | `[9.24 · 03:50]`, `[9.44 · 12:45]` |
| RF-22 | **Notificaciones por mensaje (asíncronas)**, no llamadas. Los huerteros prefieren atender cuando pueden                                                                                                                                                                                                                                                         | MVP       | `[10.38 · 02:28]`                     |
| RF-23 | **Solicitudes de la huerta a la comunidad**: por ejemplo, pedir baldes plásticos para propagar esquejes. Hoy se hace por un grupo de WhatsApp de 60 a 70 personas                                                                                                                                                                                               | Deseable  | `[10.38 · 00:00]`                     |

### Fase 2 / escalable

| ID    | Requerimiento                                                                                                                                               | Fuente                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| RF-24 | **Reconocimiento automático del tipo de residuo por foto** (IA o visión). La fundación lo imaginó, pero le puso "un asterisco": no es obligatorio | `[9.44 · 01:42]`, `[9.44 · 02:21]` |
| RF-25 | Identificación de **puntos críticos** (la fundación ya hizo un proyecto con dron que mapeó la basura del barrio)                                  | `[9.44 · 02:05]`                      |
| RF-26 | Ampliar a otros conjuntos y propiedades horizontales como parte del "programa ambiental" que se entrega con cada proyecto de vivienda                       | `[9.07 · 13:37]`                      |

## Requerimientos no funcionales

| ID     | Requerimiento                                                                                                                                                                                                                                                     | Fuente                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| RNF-01 | **Usabilidad extrema:** pocos pasos, lenguaje sencillo, íconos grandes. Debe servir a **adultos mayores** y a personas con **baja destreza digital**. Es el criterio que más repitió la fundación                                           | `[9.44 · 03:09]`, `[9.44 · 04:16]`  |
| RNF-02 | **Conectividad deficiente:** el aplicativo debe tolerar internet inestable (modo sin conexión o reintentos, poco consumo de datos). En el barrio fracasó un call center por esto                                                                          | `[9.07 · 04:37]`                       |
| RNF-03 | **Dispositivos:** los coordinadores usan **tablet**; los usuarios, su propio celular. **Considerar WhatsApp** como canal, porque la comunidad ya lo usa                                                                                         | `[9.44 · 05:08]`, `[10.38 · 01:41]` |
| RNF-04 | **Datos personales:** hay usuarios desconfiados. Hay que pedir los mínimos datos, con consentimiento y finalidad explícitos (en Colombia rige la Ley 1581 de 2012 de habeas data; nota del redactor). El equipo debe proponer cómo crear usuarios        | `[9.46 · 00:52]`                       |
| RNF-05 | **Stack tecnológico:** debe encajar en la infraestructura de la fundación. **Las herramientas ya están definidas y se entregan en el reto.** Se mencionaron **Python** y **PHP** [verificar]. No habrá que aprender un lenguaje nuevo | `[9.44 · 11:00]`                       |
| RNF-06 | **Hosting:** alojarlo en la infraestructura de la fundación tiene restricciones de seguridad (no se puede dar acceso a terceros). **Está por definir dónde vivirá**                                                                               | `[9.44 · 14:32]`                       |
| RNF-07 | **Replicable y configurable:** zonas, conjuntos, grupos, reglas de puntos y premios no deben quedar fijos en el código                                                                                                                                     | `[9.07 · 13:37]`                       |
| RNF-08 | **Lo operará la comunidad**, no la fundación: la administración debe ser sencilla para los coordinadores                                                                                                                                                 | `[9.07 · 14:21]`                       |

## Fuera de alcance (según lo dicho)

- Cómo se comunican internamente los coordinadores con sus recolectores: cada grupo tiene su propia dinámica. `[9.44 · 17:15]`
- La logística de la huerta (compostaje) y del punto de acopio, salvo el registro de pesajes.
