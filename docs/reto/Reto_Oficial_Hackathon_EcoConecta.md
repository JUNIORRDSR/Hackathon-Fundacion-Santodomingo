**HACKATHON UNILIBRE | FUNDACIÓN SANTO DOMINGO**

# HACKATHON EcoConecta — Villas de San Pablo

*Plataforma digital para conectar comunidad, huerteros y recicladores en la gestión comunitaria de residuos y la economía circular*

## EL DESAFÍO

Diseñar, desarrollar y desplegar un MVP que facilite el acceso a información ambiental y gestione solicitudes de recolección, conectando cada solicitud con el colectivo responsable — huerteros o recicladores —, permitiendo acordar día y hora, registrar la recolección y reconocer la participación mediante puntos.

Universidad Libre · Facultad de Ingeniería · Ingeniería de Sistemas

En alianza con Fundación Santo Domingo · Villas de San Pablo, Barranquilla

17, 20 y 21 de noviembre de 2026

---

## 1. Presentación del reto

La Fundación Santo Domingo y la Universidad Libre proponen a los 20 equipos de la Hackathon un desafío real de transformación digital en Villas de San Pablo, Barranquilla. El punto de partida no es hipotético: el 17 de noviembre los estudiantes visitaron el territorio y escucharon a los actores vinculados con la gestión comunitaria de residuos.

Este documento convierte los hallazgos del diagnóstico territorial y las condiciones técnicas definidas por la Fundación en un reto común. Todos los grupos trabajan sobre el mismo problema y los mismos no negociables; cada equipo debe proponer e implementar su propia solución.

> **PUNTO DE PARTIDA**
>
> La visita del 17 de noviembre constituye la fase de descubrimiento y análisis de requerimientos. Ahora corresponde traducir lo observado y escuchado en flujos, reglas de negocio, datos, interfaces y una solución funcional, validable y desplegada.

## 2. Contexto territorial y oportunidad

El informe Taller de economía circular – Villas de San Pablo (Fundación Santo Domingo, julio de 2026) documenta dos perspectivas: la gestión de residuos orgánicos vinculada con la huerta comunitaria y la gestión de residuos reciclables en la comunidad. En ambas, la comunicación, la educación ambiental y la coordinación de la recolección son elementos críticos.

### 2.1 Residuos orgánicos y huerta comunitaria

Los huerteros cumplen un papel de liderazgo ambiental. La ruta actual se apoya principalmente en el voz a voz, acuerdos informales, recolección en hogares y negocios cercanos, traslado a la huerta y aprovechamiento mediante clasificación y compostaje para producir abono.

- **Fortalezas:** compromiso de los huerteros, redes de confianza con vecinos y comercios, y comunicación directa.
- **Barreras:** educación ambiental insuficiente, limitaciones de transporte y ausencia de un canal único para informar o solicitar recolección.
- **Acuerdos de la ruta ideal:** recolección diaria para negocios y día de por medio para hogares; reforzar educación ambiental; promover carretilla o motocarro; disponer de un canal único y contenedores para residuos de negocios.

### 2.2 Residuos reciclables y comunidad

La comunidad interactúa con recicladores de oficio, Alcaldía de Barranquilla, Siembra Barranquilla, Asorescatar, punto de recolección comunitario y huerteros. El informe identifica comunicación fragmentada y desconocimiento sobre los actores y las rutas disponibles.

- **Fortalezas:** presencia de actores que promueven educación ambiental, canal de información entre comunidad y huerteros, actividad de la huerta y apoyo institucional.
- **Barreras:** falta de comunicación directa, información fragmentada, desinformación y pocas oportunidades de participación.
- La ruta ideal propone educación ambiental, cronograma de recolección, recolección domiciliaria y comunicación permanente.

### 2.3 Oportunidad

El informe propone integrar tres componentes:

- (1) cronograma y organización de recolección
- (2) plataforma de educación ambiental
- (3) redes sociales y canales de difusión.

La tecnología debe fortalecer el voz a voz y el liderazgo comunitario, no reemplazarlos.

## 3. Enunciado del reto

> **RETO**
>
> ¿Cómo podríamos diseñar e implementar una plataforma digital accesible que permita a hogares y unidades productivas de Villas de San Pablo aprender sobre la adecuada gestión de residuos, solicitar su recolección y comunicarse con el colectivo responsable —huerteros para el flujo orgánico o recicladores para el flujo reciclable—, facilitando la programación, el seguimiento de la atención y el reconocimiento de la participación comunitaria?

No basta con registrar solicitudes. La plataforma debe garantizar que cada solicitud llegue al colectivo correcto, que exista una respuesta de programación por parte del responsable y que se registre la recolección y la asignación de puntos al usuario.

## 4. Actores y perfiles

| Actor / perfil | Necesidad | Interacción esperada |
|---|---|---|
| Hogares / comunidad | Información, horarios y solicitud de recolección. | Consultar contenidos, registrar solicitud y recibir confirmación y estado. |
| Unidades productivas | Acceder a información y solicitar servicio. | Consultar orientación, registrar solicitud y coordinar atención. FSD preseleccionará unidades piloto. |
| Coordinador de huerteros | Gestionar solicitudes de residuos orgánicos. | Revisar, asignar huertero, acordar día/hora y registrar resultado. |
| Huertero | Conocer y atender solicitudes asignadas. | Consultar asignaciones, coordinar con usuario y registrar recolección. |
| Coordinador de recicladores | Gestionar solicitudes de residuos reciclables. | Revisar, asignar reciclador, acordar día/hora y registrar resultado. |
| Reciclador | Atender solicitudes asignadas. | Consultar información operativa y registrar recolección. |
| Administrador | Gestionar operación y contenidos. | Administrar perfiles, contenidos y parámetros autorizados. |

## 5. Alcance funcional mínimo del MVP

### 5.1 Acceso y perfiles

- Diferenciar usuario solicitante, coordinador de huerteros, coordinador de recicladores, recolector y administrador.
- Restringir funciones según perfil; cada actor solo debe consultar la información que necesita para operar.
- Solicitar únicamente datos personales necesarios para atender la solicitud.

### 5.2 Información y educación ambiental

- Publicar material sobre separación y gestión adecuada de residuos, buenas prácticas, funcionamiento de la huerta, horarios y rutas.
- Organizar el contenido para consulta sencilla desde móviles y tabletas.
- Ayudar al usuario a identificar el tipo de residuo y el flujo de atención correspondiente.

### 5.3 Solicitud de recolección

- Permitir solicitudes desde hogares y unidades productivas.
- Capturar como mínimo: contacto, ubicación/dirección, tipo de generador, tipo de residuo o flujo, observaciones y disponibilidad/preferencia horaria.
- Clasificar y enrutar al coordinador correspondiente: huerteros para orgánicos y recicladores para reciclables.
- Generar identificador y estado consultable para cada solicitud.

### 5.4 Gestión, asignación y programación

- Cada coordinador debe contar con una bandeja de solicitudes de su colectivo.
- El coordinador debe asignar la atención a una persona del colectivo.
- El coordinador o responsable debe comunicarse con el usuario y registrar día, hora y persona encargada.
- La programación debe quedar registrada y ser visible para el usuario.
- Mantener estados trazables; por ejemplo: recibida, en revisión, programada, asignada, recolectada o cancelada.

### 5.5 Cierre y puntos

- Después de la recolección, el responsable registra que la actividad fue realizada.
- Asociar la recolección con la solicitud y el usuario.
- Asignar puntos por el material entregado, según una regla parametrizable y documentada.
- Los documentos de FSD no definen equivalencias ni valores de puntos: no presentarlos como reglas oficiales.

### 5.6 Comunicación y panel operativo

- Integrar WhatsApp Business Cloud API como canal permitido para apoyar comunicación y notificaciones.
- Contemplar confirmación de recepción y comunicación de la programación (día, hora y persona encargada).
- Mostrar al coordinador solicitudes pendientes, asignadas, programadas y atendidas.
- Consultar historial y ofrecer resumen básico por flujo, estado y periodo.

## 6. Flujo esperado:

| Etapa | Comportamiento esperado |
|---|---|
| 1. Información | El usuario consulta contenidos sobre separación, aprovechamiento, rutas y horarios. |
| 2. Solicitud | Registra la necesidad e identifica el tipo de residuo. |
| 3. Enrutamiento | El sistema dirige al coordinador de huerteros o de recicladores. |
| 4. Revisión y asignación | El coordinador revisa y asigna la persona que realizará la recolección. |
| 5. Programación | Se acuerda y registra día, hora y persona encargada; el usuario recibe respuesta. |
| 6. Recolección | El huertero o reciclador realiza la actividad y registra el resultado. |
| 7. Reconocimiento | Se registra la entrega y se asignan puntos según la regla parametrizada. |

## 7. Requisitos Funcionales y criterios de aceptación:

| Regla | Criterio verificable |
|---|---|
| RN-01. Separación de flujos | Cada solicitud se clasifica como orgánica o reciclable y llega al colectivo responsable. |
| RN-02. Programación | No se considera programada hasta registrar día, hora y persona encargada. |
| RN-03. Asignación | La atención queda asociada a coordinador y recolector. |
| RN-04. Trazabilidad | Cada solicitud tiene identificador, estado e historial. |
| RN-05. Cierre | Los puntos solo se asignan después de registrar la recolección. |
| RN-06. Puntos | El cálculo es explicable y parametrizable; valores sujetos a validación FSD. |
| RN-07. Privacidad | Contacto y ubicación solo son visibles para perfiles que necesitan atender la solicitud. |
| RN-08. Piloto | Permite configurar usuarios piloto sin asumir que toda la comunidad está habilitada. |

## 8. Condiciones técnicas no negociables:

Los equipos deben respetar las tecnologías y restricciones establecidas por Fundación Santo Domingo. El uso de herramientas no autorizadas puede generar penalización o descalificación.

| Categoría | Tecnologías permitidas |
|---|---|
| Lenguajes | Python, TypeScript, JavaScript, HTML y CSS. |
| Base de datos | PostgreSQL. |
| Mensajería | WhatsApp Business Cloud API. |
| Modelos de IA | OpenAI API, Azure OpenAI API, modelos de Azure AI Foundry y Claude API. |
| Infraestructura / versiones | Docker y Git. |
| Backend Python | FastAPI, Flask, Django, SQLAlchemy, Psycopg, Pydantic y Pandas. |
| Agentes y modelos | LangChain, LangGraph, SDK oficial de OpenAI, SDK oficial de Anthropic y SDK de Azure AI. |
| Frontend | React, Next.js y Vue. |
| Estilos | Tailwind CSS y Bootstrap. |

### 8.1 Prohibiciones

- No se permiten bases de datos distintas de PostgreSQL ni proveedores de modelos o canales de mensajería diferentes de los autorizados.
- No se permiten plataformas no-code o low-code como n8n, Make, Zapier o Power Automate.
- No se deben incorporar servicios que sustituyan las herramientas autorizadas.

### 8.2 Publicación en nube

- La solución debe estar desplegada y accesible en un servicio de nube durante la evaluación.
- El equipo debe declarar proveedor y servicios usados: cómputo, base de datos, almacenamiento y redes, según aplique.
- Entregar diagrama de arquitectura con componentes y comunicaciones.

### 8.3 Repositorio y README

- El código se entrega en repositorio Git en GitHub, con acceso para jurados.
- README: instrucciones para ejecutar localmente con Docker, URL publicada, descripción de infraestructura y variables de entorno necesarias, sin valores.
- No publicar contraseñas, tokens, claves API ni credenciales.

## 9. Uso de inteligencia artificial

La IA está permitida mediante los proveedores y modelos autorizados, pero no es obligatoria. Debe resolver una necesidad concreta y demostrable, no añadirse como elemento decorativo ni desplazar las funciones esenciales.

- Usos posibles: asistente de educación ambiental, clasificación orientativa de consultas o residuos a partir de texto, preguntas frecuentes o apoyo para redactar respuestas.
- El equipo debe explicar modelo, datos procesados, resultado y controles frente a respuestas incorrectas.
- Las decisiones operativas críticas —asignación final, confirmación de horario y cierre— deben permanecer bajo control humano.
- No enviar a un modelo información personal que no sea necesaria.

## 10. Entregables obligatorios

| Entregable | Contenido mínimo |
|---|---|
| Producto funcional | MVP desplegado en nube, accesible por URL y con flujo demostrable de extremo a extremo. |
| Repositorio | GitHub con código fuente y acceso habilitado para jurados. |
| README | Ejecución local con Docker, URL, infraestructura y variables de entorno requeridas sin valores. |
| Arquitectura | Diagrama de componentes, servicios, base de datos e interacciones. |
| Modelo de datos | Estructura PostgreSQL y relaciones principales. |
| Demostración | Solicitud orgánica y reciclable, asignación, programación, recolección y puntos. |
| Sustentación | Problema, usuarios, solución, decisiones técnicas, impacto y limitaciones. |

## 11. Escenario mínimo de demostración

1. Un usuario de unidad productiva registra una solicitud de residuos orgánicos.
2. El sistema la envía al coordinador de huerteros, quien la revisa y asigna un huertero.
3. Se registra y comunica al usuario día, hora y persona encargada.
4. El huertero registra la recolección; el sistema actualiza estado y puntos.
5. Un segundo usuario solicita recolección de residuos reciclables y el sistema la dirige al coordinador de recicladores, demostrando la separación de flujos.

## 12. Cronograma de la experiencia

| Jornada | Propósito | Actividad / resultado |
|---|---|---|
| 17 de noviembre de 2026<br>Visita a Villas de San Pablo | Descubrimiento y análisis de requerimientos | Escucha a población objetivo, observación de dinámicas, identificación de actores, necesidades y barreras. |
| 20 de noviembre de 2026<br>8:00 a. m. – 5:00 p. m. | Diseño y desarrollo | Definición del MVP, UX, arquitectura, construcción, integración, pruebas y despliegue inicial. |
| 21 de noviembre de 2026<br>8:00 a. m. – 12:00 m. | Finalización y evaluación | Estabilización, despliegue final, entrega de repositorio y documentación, demostración, sustentación y selección. |

## 15. Recomendaciones para los equipos

1. Empiecen por mapear actores y flujo de servicio; no programen pantallas sin acordar el proceso.
2. Prioricen el recorrido completo de una solicitud sobre la cantidad de funcionalidades.
3. Construyan primero solicitud, enrutamiento, asignación, programación y cierre; después incorporen contenidos, notificaciones e IA.
4. Diseñen para móvil y tablet, con formularios cortos, textos claros y pocos pasos.
5. Prueben con datos ficticios; no carguen información personal real sin autorización.
6. Mantengan trazabilidad de estados y eviten que una solicitud desaparezca al cambiar de responsable.
7. Verifiquen temprano restricciones técnicas, despliegue e integración de servicios.
8. En la sustentación distingan funciones implementadas, simuladas, pendientes y limitaciones.

## 16. Definición de éxito

> **UNA SOLUCIÓN EXITOSA**
>
> Demuestra de manera sencilla y confiable cómo una persona puede informarse y solicitar una recolección; cómo la solicitud llega al colectivo correcto; cómo el coordinador asigna y acuerda la atención; y cómo queda evidencia de la recolección y del reconocimiento al usuario. La tecnología debe facilitar la coordinación, fortalecer la educación ambiental y aportar a una gestión comunitaria más organizada.

*Nota metodológica: el contexto y las restricciones se derivan de los documentos fuente. El alcance funcional, criterios de aceptación y escenario de demostración se presentan como estructuración académica propuesta para la Hackathon, no como citas literales ni compromisos adicionales atribuidos a la Fundación.*
