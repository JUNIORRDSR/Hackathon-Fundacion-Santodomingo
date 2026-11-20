# EcoConecta · Coordinación y capacitación

Demo independiente del panel de coordinación y capacitación de EcoConecta, en React, TypeScript, Tailwind CSS y Vite.

## Ejecutar

Con Node.js 22.12 o superior (también compatible con Node.js 20.19 hasta el final de la serie 20):

```sh
cd frontend/ecoconecta-coordinacion
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

Vite muestra la dirección local. `check` comprueba los tipos y `build` genera el sitio estático en `dist/`. La demo usa navegación por hash, compatible con alojamiento estático.

## Probar la demo

1. En **Inicio**, abre **Ver pendientes**. Busca por código, nombre o ubicación y abre el detalle de una solicitud.
2. Selecciona un recolector activo y una fecha. Puedes añadir una hora de Barranquilla. La asignación confirmada aparece en **Recolecciones** y en la planificación de **Inicio**. Si la dejas vacía, aparece en **Recolecciones sin hora**.
3. Abre una recolección programada y guarda un peso positivo en kg. Con otra, registra un rechazo y su motivo. Ambos se consultan desde **Resultados** y desde la solicitud original.
4. En **Recolectores**, agrega o edita integrantes, zonas y disponibilidad. Los integrantes inactivos conservan su historial y dejan de estar disponibles para nuevas asignaciones.
5. Usa el selector junto al nombre de coordinación para probar **Huerteros** (orgánicos) o **Recicladores** (aprovechables).
6. En **Capacitación**, abre una guía o usa **Abrir vista pública**. La dirección `#/capacitacion?publica=1` funciona sin identidad de coordinación.

Los nombres, solicitudes, pesajes y resultados iniciales son ficticios. Los cambios se guardan en `localStorage` con la clave `ecoconecta-coordinacion-demo-v1`. Si el almacenamiento no está disponible para lectura, la demo conserva los cambios en memoria durante la sesión. Si el navegador rechaza una escritura, el formulario conserva sus valores y permite reintentar. Para restaurar los datos iniciales, borra esa clave y recarga la página.

Las fechas de ejemplo se calculan en hora de Colombia la primera vez que se crean los datos. Los formularios usan fechas de calendario y admiten pesos con coma o punto decimal.

Desde **Inicio** puedes seleccionar el día, filtrar por recolector y abrir una recolección desde **Cronograma** o **Agenda**. En pantallas pequeñas, la agenda es la vista inicial. El cronograma marca la hora de inicio y muestra la hora actual de Barranquilla en la fecha de hoy cuando está dentro del rango visible.

## Integrar en el frontend principal

El punto de entrada es `src/ecoconecta-coordinacion/index.ts`. El host define las rutas mediante `location` y `href`, provee el coordinador de la sesión y conserva la responsabilidad por autenticación y enrutamiento. Toda autorización debe validarse en el servidor.

```tsx
import { CoordinatorModule, PublicTrainingModule } from './src/ecoconecta-coordinacion'

// En la ruta privada del host
<CoordinatorModule
  coordinator={coordinator}
  repository={repository}
  location={{ page: 'solicitudes', filter: 'pendiente' }}
  href={hostLink}
  trainingResources={resources}
  publicTrainingHref="/capacitacion"
/>

// En la ruta pública del host
<PublicTrainingModule resources={resources} href={hostLink} />
```

- `types.ts` define las entidades y el contrato `CoordinatorRepository`. La interfaz reside en `components/` y `pages/`. Los datos de ejemplo están en `mocks/`. Los estilos usan Tailwind y tokens CSS bajo `.eco-app`. El módulo importa los logotipos originales de `identidad-visual/`. Conserva esa ruta o actualiza las importaciones al moverlo.
- `createMockRepository(storage?)` permite probar la demo. El host puede inyectar su propio repositorio o usar `createApiRepository` con rutas, funciones de decodificación y, si se necesita, un `fetcher` para aplicar el esquema de la sesión.
- El adaptador HTTP provisional usa GET para listados, POST para asignar, registrar resultados y crear recolectores, y PATCH para editar. La respuesta de cada escritura debe incluir el registro confirmado. Los decodificadores reciben JSON como `unknown` y son el lugar para validar y mapear los campos y estados del backend a los tipos del módulo. Si se acuerdan otros verbos o formatos, adapta el repositorio.
- `Assignment.hora` es opcional y usa el formato local `HH:mm`. Alinea este campo con el backend al conectar el cronograma. Las asignaciones que solo tienen fecha siguen disponibles en la agenda.
- Cada formulario bloquea múltiples envíos mientras se guarda. Para reintentos tras una respuesta perdida, el backend debe soportar escrituras idempotentes. Si admite una cabecera de idempotencia, configura `idempotencyHeader` (por ejemplo, `Idempotency-Key`) para reutilizar la misma clave al repetir una escritura sin confirmación en la misma instancia.
- La capacitación recibe recursos como propiedades. Para publicar el video, agrega la URL y, cuando esté disponible, los subtítulos en WebVTT y una transcripción. El reproductor usa controles nativos y no precarga el video. El contenido incluido está identificado como ejemplo.

## Pendientes de integración

Confirmar los contratos y la sesión del host, y sustituir las guías de ejemplo por el material y el video de la fundación. El pesaje de entregas directas a la huerta queda condicionado a que el backend exponga ese flujo.

La interfaz usa Inter local y conserva los tres logotipos originales. Los controles seleccionados y las tarjetas destacadas usan Verde bosque (`#063B2E`) sobre una base clara. Los iconos y los indicadores pequeños llevan acentos amarillos y dorados.
