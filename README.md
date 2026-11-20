# EcoConecta · Villas de San Pablo

MVP del reto de la Hackathon de la Universidad Libre y la Fundación Santo Domingo. Hogares y negocios piden por WhatsApp
la recolección de sus orgánicos o reciclables. La coordinación de huerteros o de recicladores la asigna y programa desde
una tablet, y cada recolección suma puntos.

- Arquitectura: [docs/arquitectura.md](docs/arquitectura.md)
- Decisiones: [docs/adr/](docs/adr/)
- Lenguaje del dominio: [docs/GLOSARIO.md](docs/GLOSARIO.md)
- El reto y la visita: [docs/reto/](docs/reto/)

## Ejecutar en local con Docker

```bash
docker compose up --build
```

Abre http://localhost:8000/docs: cada etiqueta es un módulo y su contrato. Los usuarios de demostración son ficticios:
`huerteros`, `recicladores` y `admin`, con la clave `ecoconecta-demo`.

## Backend sin Docker

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # en Linux o macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
pytest
```

## Probar el bot sin WhatsApp

1. `POST /api/acceso/entrar` con `{"usuario": "admin", "clave": "ecoconecta-demo"}`.
2. `POST /api/whatsapp/simulador` con `{"telefono": "+573000000001", "texto": "Hola"}`, y sigue la conversación.
3. `GET /api/whatsapp/simulador/mensajes` muestra todo lo que el sistema envió, avisos incluidos.

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
| Base de datos | Azure Database for PostgreSQL Flexible Server cuando entre Postgres; hoy, en memoria |
| Almacenamiento | Ninguno propio: los contenidos son URLs públicas |
| Redes | Ingreso HTTPS público de Container Apps, que es también la URL del webhook de WhatsApp |

URL publicada: pendiente.

## Variables de entorno

Los nombres están en [.env.example](.env.example); los valores nunca van al repo.

| Variable | Para qué |
|---|---|
| `ENTORNO` | `local` o `produccion`; en producción la cookie de sesión va solo por HTTPS |
| `CLAVE_SESION` | Firma la cookie de sesión |
| `CLAVE_DEMO` | Clave de los usuarios de demostración |
| `SEMBRAR_DEMO` | `1` carga zonas, encargados, usuarios y contenidos ficticios |
| `TRANSPORTE` | `simulado` o `twilio` |
| `CONVERSADOR` | `menu` o `llm` |
