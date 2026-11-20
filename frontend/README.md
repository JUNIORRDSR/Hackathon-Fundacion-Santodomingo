# Frontend: host de la tablet

Host en React para la coordinación (ADR-0002). Jairo armó la estructura y unas pantallas que funcionan, sin diseño;
Daniela pone la identidad de EcoConecta y mejora las pantallas sin cambiar la estructura.

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173; /api va al backend en el puerto 8000
npm run contrato   # regenera src/api/esquema.d.ts desde el OpenAPI, con el backend arriba
npm run build      # comprueba los tipos y deja dist/, que el backend sirve en la misma URL
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/host/` | El host: sesión, marco con el menú y registro de las rutas (`rutas.ts`) |
| `src/api/` | `cliente.ts` (llamadas con la cookie de sesión) y `esquema.d.ts` (tipos generados del contrato; no se edita) |
| `src/modulos/<módulo>/` | Las pantallas de cada módulo y su `rutas.tsx` |

`backend/tests/test_arquitectura.py` comprueba que un módulo no importe a otro (solo comparten `host/` y `api/`) y que
ningún archivo pase de 300 líneas ni ninguna línea de 120 caracteres.

## Tablet

Horizontal, con la bandeja a la izquierda y el detalle a la derecha; botones de 48 px o más (clase `.boton`); nada que
dependa del hover; kilos con `inputMode="decimal"`; fecha y hora con `<input type="date">` y `<input type="time">`. Es
una PWA: se instala desde el navegador y abre a pantalla completa. Identidad: `docs/Identidad Visual/`.

## Pantallas y su contrato

| Pantalla | Estado | Quién | Endpoints |
|---|---|---|---|
| Entrar | Hecha | Todos | `POST /api/acceso/entrar`, `GET /api/acceso/yo`, `POST /api/acceso/salir` |
| Bandeja y detalle | Hecha | Coordinador | `GET /api/solicitudes?estado=`, `GET /api/solicitudes/codigo/{codigo}`, `GET /api/solicitudes/{id}`, `GET …/sugerencias`, `POST …/asignacion`, `POST …/programacion`, `POST …/recoleccion`, `POST …/rechazo`, `POST …/cancelacion` |
| Registro asistido | Hecha | Coordinador | `GET /api/directorio/zonas`, `POST /api/directorio/solicitantes`, `POST /api/solicitudes` |
| Por habilitar | Hecha | Coordinador y administrador | `GET /api/directorio/solicitantes?estado=pendiente`, `POST /api/directorio/solicitantes/{id}/habilitacion` |
| Panel | Hecha | Coordinador y administrador | `GET /api/reportes/resumen`, `GET /api/reportes/solicitudes.csv` |
| Ayuda | Hecha | Coordinador | `GET /api/contenidos?audiencia=coordinador`, `GET /api/contenidos?audiencia=encargado` |
| Simulador de WhatsApp | Hecha | Demo | `POST /api/whatsapp/simulador`, `GET /api/whatsapp/simulador/mensajes` |
| Encargados y zonas | Pendiente | Coordinador y administrador | `GET` y `POST /api/directorio/encargados`, `GET` y `POST /api/directorio/zonas` |
| Contenidos | Pendiente | Administrador | `GET` y `POST /api/contenidos`, `PUT /api/contenidos/{id}` |
| Regla de puntos | Pendiente | Administrador | `GET` y `PUT /api/puntos/regla` |
