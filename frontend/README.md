# Frontend: host de la tablet

Jairo arma la estructura del host; Daniela pone la identidad y las pantallas (ADR-0002). Estas reglas hacen que lo que se
haga hoy encaje sin retrabajo:

- Vite + React + TypeScript + Tailwind, instalable como PWA (manifest y service worker que guarda el armazón).
- Una carpeta por módulo, `src/modulos/<módulo>/`, que exporta sus rutas; el host las registra en el menú.
- Cliente tipado desde el contrato: `npx openapi-typescript http://localhost:8000/openapi.json -o src/api/esquema.d.ts`.
- En desarrollo, el proxy de Vite manda `/api` al backend: misma cookie de sesión y sin CORS.

  ```ts
  // vite.config.ts
  server: { proxy: { "/api": "http://localhost:8000" } }
  ```

- `npm run build` deja `frontend/dist`, que el backend sirve en la misma URL.
- Tablet: horizontal, con la bandeja a la izquierda y el detalle a la derecha; botones de 48 px o más; nada que dependa
  del hover; kilos con `inputMode="decimal"`; fecha y hora con `<input type="date">` y `<input type="time">`.
- Identidad: `Identidad Visual/Manual_Identidad_Visual_EcoConecta_Villas_de_San_Pablo.pdf`.

## Pantallas del MVP y su contrato

| Pantalla | Quién | Endpoints |
|---|---|---|
| Entrar | Todos | `POST /api/acceso/entrar`, `GET /api/acceso/yo`, `POST /api/acceso/salir` |
| Bandeja y detalle | Coordinador | `GET /api/solicitudes?estado=`, `GET /api/solicitudes/{id}`, `GET …/sugerencias`, `POST …/asignacion`, `POST …/programacion`, `POST …/recoleccion`, `POST …/rechazo`, `POST …/cancelacion` |
| Registro asistido | Coordinador | `GET /api/directorio/zonas`, `POST /api/directorio/solicitantes`, `POST /api/solicitudes` |
| Solicitantes por habilitar | Coordinador y administrador | `GET /api/directorio/solicitantes?estado=pendiente`, `POST /api/directorio/solicitantes/{id}/habilitacion` |
| Encargados y zonas | Coordinador y administrador | `GET` y `POST /api/directorio/encargados`, `GET` y `POST /api/directorio/zonas` |
| Ayuda y material para encargados | Coordinador | `GET /api/contenidos?audiencia=coordinador`, `GET /api/contenidos?audiencia=encargado` |
| Contenidos | Administrador | `GET` y `POST /api/contenidos`, `PUT /api/contenidos/{id}` |
| Panel | Coordinador y administrador | `GET /api/reportes/resumen`, `GET /api/reportes/solicitudes.csv` |
| Regla de puntos | Administrador | `GET` y `PUT /api/puntos/regla` |
| Simulador de WhatsApp | Demo | `POST /api/whatsapp/simulador`, `GET /api/whatsapp/simulador/mensajes` |
