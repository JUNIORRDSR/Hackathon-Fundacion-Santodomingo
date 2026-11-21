# ADR-0005 · Despliegue en Azure Container Apps

- **Estado:** aceptada · 2026-11-20

## Contexto

El §8.2 pide la solución en la nube y declarar cómputo, base de datos, almacenamiento y redes. El webhook de WhatsApp
necesita HTTPS. Leonardo despliega con su suscripción.

## Decisión

- Cómputo: una Azure Container App con la imagen única (API y SPA), ingreso externo y HTTPS incluido. Su URL es también
  la del webhook.
- Base de datos: Azure Database for PostgreSQL Flexible Server, nivel Burstable B1ms, con SSL obligatorio.
- Imagen: se construye con el Docker local a partir del `Dockerfile` y se sube a Azure Container Registry. Azure for
  Students no permite construirla en la nube (ACR Tasks: `TasksOperationsNotAllowed`).
- Región: North Central US, una de las que admite la suscripción de estudiante (Directiva > Asignaciones).
- Secretos (clave de sesión, clave de demo, Twilio y base de datos) en los secretos de la Container App, nunca en el
  repo.
- Sin Blob Storage: los contenidos son URLs públicas.
- `deploy/azure.sh` deja los comandos listos.
