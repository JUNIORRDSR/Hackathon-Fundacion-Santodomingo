# EcoConecta · Coordinación y capacitación

La app de la tablet de coordinación y la capacitación pública, en React, TypeScript, Tailwind CSS y Vite. La base es
el módulo de Daniela (`src/ecoconecta-coordinacion`); el host (`src/host` y `src/main.tsx`) le pone la sesión, la API y
las pantallas que faltaban ([ADR-0007](../docs/adr/0007-frontend-de-daniela-y-monitor-de-whatsapp.md)).

## Ejecutar

Con Node.js 22.12 o superior y el backend corriendo en el puerto 8000 (`docker compose up -d` en la raíz):

```sh
cd frontend
npm ci
npm run dev        # Vite reenvía /api al backend
npm run check      # tipos
npm run build      # sitio estático en dist/, el que sirve la imagen de Docker
npx prettier --write "src/**/*.{ts,tsx}"
```

Usuarios de la demo: `huerteros`, `recicladores` y `admin`, todos con la clave `ecoconecta-demo`. En **Crear cuenta**
se crea otra coordinación con el código de la fundación (`villas-2026` en local, ADR-0009). Las animaciones
(logo, transiciones y pastillas) son de Daniela y respetan `prefers-reduced-motion`. El coordinador ve
solo su colectivo; el administrador cambia de equipo con el selector junto a su nombre.

## Probar la demo

1. En **Inicio**, abre **Ver pendientes**. Busca por código, nombre o ubicación y abre el detalle de una solicitud.
2. Asigna un encargado y un día. Con hora, la solicitud queda programada y el vecino recibe el aviso por WhatsApp; sin
   hora queda asignada y aparece en **Recolecciones sin hora**.
3. En **Recolecciones**, busca el código escrito en la bolsa, abre la recolección y registra los kilos, o un rechazo con su motivo. Una solicitud pendiente o asignada se puede
   cancelar con motivo.
4. En **Recolectores**, agrega o edita encargados, sus zonas del catálogo y si están activos.
5. **Registros**: quienes se registraron por WhatsApp y esperan habilitación. **Canjes**: el vecino muestra su código
   CAN, se entrega el premio y se descuentan los puntos; abajo, el catálogo de premios (lo edita la administración).
6. **WhatsApp** (botón flotante abajo a la derecha): el monitor del bot. Simula un vecino, mira lo que responde el bot, toma el control para responder tú y
   devuélvelo al bot.
7. **Capacitación** y su vista pública `#/capacitacion?publica=1`, que funciona sin sesión.

Los datos son ficticios. Las fechas y horas se muestran en hora de Colombia.

## Cómo está armado

- `src/ecoconecta-coordinacion/`: el módulo de Daniela. `types.ts` define las entidades y el contrato
  `CoordinatorRepository`; no importa nada del host (lo vigila `backend/tests/test_arquitectura.py`) y todo le llega
  por props: coordinador, repositorio, rutas, recursos de capacitación y `extraPages`.
- `src/host/repositorio.ts`: cumple `CoordinatorRepository` contra la API y traduce estados (recibida → pendiente,
  asignada y programada → asignada). `src/host/api.ts` hace las llamadas con la cookie de sesión.
- `src/host/paginas/`: entrar, registros por habilitar, canjes con su catálogo de premios y el monitor de WhatsApp.
  Sus estilos están en `src/host/host.css`, con los tokens del módulo de Daniela.
- `src/components/ui/`: componentes de shadcn (chat: `MessageScroller`, `Message`, `Bubble`, `Marker`). Los escribe
  el CLI (`npx shadcn@latest add …`), no se editan a mano, y sus estilos (`src/shadcn.css`) solo aplican dentro de
  un contenedor `.shadcn` para no pisar los de Daniela.
- `createMockRepository(storage?)` sigue en el módulo para trabajar sin backend: basta pasarlo en lugar de
  `crearRepositorio()` en `main.tsx`.

## Pendientes

Sustituir las guías de ejemplo por el material y el video de la fundación. Las entregas directas en la huerta quedan
para otra vuelta.

## Identidad visual

La interfaz usa Inter local. Los controles seleccionados y las tarjetas destacadas usan Verde bosque (`#063B2E`) y los detalles usan acentos amarillos y dorados. El encabezado muestra la [variante en verde bosque del logo de EcoConecta](identidad-visual/Logo%20EcoConecta%20-%20Verde%20bosque.png), creada con ImageGen a partir del logo original. El pie muestra los originales de Villas de San Pablo y Fundación Santo Domingo.

<details>
<summary>Indicación usada para adaptar el logo</summary>

> Edit the attached original EcoConecta logo, a supplied brand asset. Make a faithful COLOR-ONLY variant of this very wide, original horizontal logo lockup. Preserve the original vector-like silhouettes, typography and EXACT written words 'EcoConecta' and 'Villas de San Pablo'. Preserve their placement, proportions, italic bold glyph shapes, spelling and capitalization. Keep all original motifs and their positions exactly: monarca butterfly at upper left with its original white spots, two circular arrows, leaf integrated in the Eco lettering and its three small rays, upper-right radial community mark with its existing number and shape of spokes, original small neighborhood rooftops and leaf at bottom right, and the underline and the rounded subtitle ribbon. Change only the palette and surface finish. Recolor the bright medium greens predominantly to deep forest green #063B2E and a muted secondary forest green #2D6552. 'Conecta' stays dark forest green #063B2E and 'Eco' can use #2D6552 for a recognizable subtle contrast. The spoke mark should be forest green #2D6552 with no bright cyan. Keep small deliberately restrained warm accents: recolor the orange wings to soft matte muted golden ochre #C89635 and #D6A946, retaining dark forest outline #063B2E and tiny ivory spots #F6F8F4. Recolor the subtitle's chunky original rounded banner to muted warm yellow #E5CF81 and keep its exact words dark forest green #063B2E. Flat, clean sharply-defined graphic fills suited to a modern dashboard on a very light gray-green background, no metallic gloss, no glow, no shadow, no highlights, no texture or gradients. Finish as a clean image asset on a TRUE TRANSPARENT alpha background, keeping clear space around every edge of the full mark. No additional objects, captions, changes to the logo layout, borders, containers, retypesetting, simplification, added decoration or cropping of any part of the logo. Maintain the visibly very wide approximately 3:1 silhouette of the original art.

</details>
