# EcoConecta · Villas de San Pablo

MVP del reto de la Hackathon de la Universidad Libre y la Fundación Santo Domingo. Hogares y negocios piden por WhatsApp
la recolección de sus orgánicos o reciclables. La coordinación de huerteros o de recicladores la asigna y programa desde
una tablet, y cada recolección suma puntos.

- Arquitectura: [docs/arquitectura.md](docs/arquitectura.md)
- Decisiones: [docs/adr/](docs/adr/)
- Lenguaje del dominio: [docs/GLOSARIO.md](docs/GLOSARIO.md)
- Modelo de datos: [docs/modelo-de-datos.md](docs/modelo-de-datos.md)
- El reto y la visita: [docs/reto/](docs/reto/)

## Ejecutar en local con Docker

```bash
docker compose up --build
```

Abre http://localhost:8000/docs: cada etiqueta es un módulo y su contrato. Los usuarios de demostración son ficticios:
`huerteros`, `recicladores` y `admin`, con la clave `ecoconecta-demo`.

## Backend sin Docker

```bash
docker compose up -d db          # PostgreSQL en el puerto 5440
cd backend
python -m venv .venv
.venv\Scripts\activate          # en Linux o macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
pytest
```

`pytest` también corre las reglas de arquitectura y de tamaño: si una falla, se corrige el código, no la regla
([ADR-0006](docs/adr/0006-reglas-de-arquitectura-en-pruebas.md)).

## Probar el bot sin WhatsApp

1. `POST /api/acceso/entrar` con `{"usuario": "admin", "clave": "ecoconecta-demo"}`.
2. `POST /api/whatsapp/simulador` con `{"telefono": "+573000000001", "texto": "Hola"}`, y sigue la conversación.
3. `GET /api/whatsapp/simulador/mensajes` muestra todo lo que el sistema envió, avisos incluidos.

## WhatsApp real con el sandbox de Twilio

1. En la consola de Twilio, abre el sandbox de WhatsApp y anota el número y la palabra para unirse.
2. Arranca la app con `TRANSPORTE=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y
   `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (o el número del sandbox). En `TWILIO_WEBHOOK_URL` configura
   la URL HTTPS pública exacta, incluida la ruta `/api/whatsapp/twilio`.
3. Guarda esa misma URL con método `POST` en «When a message comes in» del Sandbox.
4. Cada celular de la demo manda primero `join <palabra>` al número del sandbox.

El webhook comprueba la firma de Twilio y procesa cada identificador de mensaje una sola vez. Opcionalmente,
`WHATSAPP_PILOT_NUMBERS` limita los remitentes antes de que entren al bot. Si Twilio muestra un BSUID en
**Sandbox Participants**, configura `WHATSAPP_CONTACT_ALIASES=CO.identificador=+573000000001` con el teléfono
verificado del participante. Para el envío, la primera asociación de cada teléfono tiene prioridad.

El [prototipo TypeScript](modules/whatsapp-recoleccion/README.md) conserva su propia demo. El webhook integrado
en el monolito usa el registro, las solicitudes y los avisos del backend común.

## Azure OpenAI para WhatsApp

El conversador opcional entiende frases como «quiero que recojan mis orgánicos» o «cuántos puntos tengo».
El flujo y las respuestas del sistema se aplican con las mismas reglas del menú. Consulta la
[guía de Foundry y la prueba local](docs/azure-openai-whatsapp.md).

Para editar textos en ejecución, apunta `WHATSAPP_REPLIES_FILE` a un JSON UTF-8 editable con claves del
[catálogo de WhatsApp](backend/app/modulos/whatsapp/respuestas.json). Puedes sobrescribir una parte del catálogo
conservando sus marcadores. Un cambio válido se aplica sin reiniciar. En Docker, monta el directorio que contiene
el archivo y usa la ruta del contenedor.

## Cómo entra cada pieza del equipo

| Pieza | Dónde | Cómo se activa |
|---|---|---|
| Frontend (Daniela) | `frontend/` | Ver [frontend/README.md](frontend/README.md) |
| Bot con LLM (Leonardo) | `backend/app/modulos/whatsapp/conversador_llm.py`: clase `ConversadorLLM` que cumple `Conversador` y expone `desde_entorno()` | `CONVERSADOR=llm` |
| API de WhatsApp (Jorge) | `backend/app/modulos/whatsapp/transporte_twilio.py`: clase `TransporteTwilio` que cumple `Transporte` y expone `desde_entorno()`, y un webhook que llama a `bot.recibir` | `TRANSPORTE=twilio` |
| Despliegue (Leonardo) | `deploy/azure.sh` | Ver [ADR-0005](docs/adr/0005-despliegue-en-azure.md) |

Los contratos de esas piezas están en `backend/app/modulos/whatsapp/contrato.py`.

## Infraestructura

| Recurso | Servicio |
|---|---|
| Cómputo | Azure Container Apps: una app con la imagen única (API y SPA) y HTTPS |
| Base de datos | Azure Database for PostgreSQL Flexible Server, con un esquema por módulo |
| Almacenamiento | Ninguno propio: los contenidos son URLs públicas |
| Redes | Ingreso HTTPS público de Container Apps, que es también la URL del webhook de WhatsApp |

URL publicada: pendiente.

## Variables de entorno

Los nombres están en [.env.example](.env.example); los valores nunca van al repo.

| Variable | Para qué |
|---|---|
| `ENTORNO` | `local` o `produccion`; en producción la cookie de sesión va solo por HTTPS |
| `DATABASE_URL` | Conexión a PostgreSQL; en local, si falta, usa la base de `docker-compose.yml` |
| `CLAVE_SESION` | Firma la cookie de sesión |
| `CLAVE_DEMO` | Clave de los usuarios de demostración |
| `SEMBRAR_DEMO` | `1` carga zonas, encargados, usuarios y contenidos ficticios |
| `TRANSPORTE` | `simulado` o `twilio` |
| `CONVERSADOR` | `menu` o `llm` |
