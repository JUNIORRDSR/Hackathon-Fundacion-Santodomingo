#!/usr/bin/env bash
# Despliegue de EcoConecta en Azure (ADR-0005). Lo corre Leonardo con su suscripción. Sin probar todavía: la primera
# vez, revisa cada comando con --help. Requisitos: az login y Docker encendido (la imagen se construye en local)
# Uso, desde la raíz del repo: CLAVE_SESION=... CLAVE_DEMO=... CODIGO_REGISTRO=... CLAVE_BD=... bash deploy/azure.sh
set -euo pipefail

GRUPO="${GRUPO:-rg-ecoconecta}"
# Azure for Students solo deja crear recursos en unas regiones (Directiva > Asignaciones). La de Leonardo admite esta.
REGION="${REGION:-northcentralus}"
APP="${APP:-ecoconecta}"
ENTORNO_ACA="${ENTORNO_ACA:-ecoconecta-env}"
SERVIDOR_BD="${SERVIDOR_BD:-ecoconecta-pg}"  # debe ser único en todo Azure
: "${CLAVE_SESION:?Define CLAVE_SESION: una cadena larga y aleatoria}"
: "${CLAVE_DEMO:?Define CLAVE_DEMO: la clave de los usuarios de demostración}"
: "${CODIGO_REGISTRO:?Define CODIGO_REGISTRO: el código que la fundación da a quien crea una cuenta}"
: "${CLAVE_BD:?Define CLAVE_BD: la clave de PostgreSQL, sin @ : / ni # porque va dentro de la URL}"

# Una suscripción nueva no tiene registrados estos proveedores de recursos.
for proveedor in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL; do
  az provider register --namespace "$proveedor" --wait --output none
done
az extension add --name containerapp --upgrade --yes --output none
az group create --name "$GRUPO" --location "$REGION" --output none

# PostgreSQL gestionado, solo la primera vez. 0.0.0.0 abre el firewall solo a los servicios de Azure.
if ! az postgres flexible-server show --resource-group "$GRUPO" --name "$SERVIDOR_BD" --output none 2>/dev/null; then
  az postgres flexible-server create --resource-group "$GRUPO" --name "$SERVIDOR_BD" --location "$REGION" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user ecoconecta --admin-password "$CLAVE_BD" --public-access 0.0.0.0 --yes --output none
  # Desde la CLI 2.93, --database-name en create solo aplica a clústeres elásticos: la base se crea aparte.
  az postgres flexible-server db create --resource-group "$GRUPO" --server-name "$SERVIDOR_BD" --name ecoconecta \
    --output none
fi
URL_BD="postgresql+psycopg://ecoconecta:$CLAVE_BD@$SERVIDOR_BD.postgres.database.azure.com:5432/ecoconecta?sslmode=require"

# Azure for Students no permite ACR Tasks (construir en la nube): la imagen se construye con el Docker local y se
# sube al registro del grupo, que se crea si no existe.
REGISTRO="${REGISTRO:-$(az acr list --resource-group "$GRUPO" --query "[0].name" --output tsv | tr -d '\r')}"
if [[ -z "$REGISTRO" ]]; then
  REGISTRO="ecoconecta$RANDOM$RANDOM"
  az acr create --resource-group "$GRUPO" --name "$REGISTRO" --sku Basic --location "$REGION" --output none
fi
az acr update --name "$REGISTRO" --admin-enabled true --output none
IMAGEN="$REGISTRO.azurecr.io/$APP:$(git rev-parse --short HEAD)"
az acr login --name "$REGISTRO"
docker build --tag "$IMAGEN" .
docker push "$IMAGEN"

# Crea o actualiza la app con HTTPS público a partir de esa imagen.
CLAVE_REGISTRO="$(az acr credential show --name "$REGISTRO" --query "passwords[0].value" --output tsv | tr -d '\r')"
az containerapp up --name "$APP" --resource-group "$GRUPO" --location "$REGION" --environment "$ENTORNO_ACA" \
  --image "$IMAGEN" --registry-server "$REGISTRO.azurecr.io" --registry-username "$REGISTRO" \
  --registry-password "$CLAVE_REGISTRO" --ingress external --target-port 8000

# Secretos fuera del repo; la app los lee como variables de entorno. Una réplica evita arranques en frío en la demo.
az containerapp secret set --name "$APP" --resource-group "$GRUPO" \
  --secrets "clave-sesion=$CLAVE_SESION" "clave-demo=$CLAVE_DEMO" "codigo-registro=$CODIGO_REGISTRO" "url-bd=$URL_BD"
az containerapp update --name "$APP" --resource-group "$GRUPO" --min-replicas 1 --max-replicas 1 \
  --set-env-vars ENTORNO=produccion SEMBRAR_DEMO=1 CLAVE_SESION=secretref:clave-sesion \
  CLAVE_DEMO=secretref:clave-demo CODIGO_REGISTRO=secretref:codigo-registro DATABASE_URL=secretref:url-bd

# WhatsApp real (opcional): con TWILIO_AUTH_TOKEN definido, la app usa Twilio en lugar del simulador.
if [[ -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
  az containerapp secret set --name "$APP" --resource-group "$GRUPO" --secrets "twilio-token=$TWILIO_AUTH_TOKEN"
  az containerapp update --name "$APP" --resource-group "$GRUPO" --set-env-vars TRANSPORTE=twilio \
    TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" TWILIO_WHATSAPP_FROM="$TWILIO_WHATSAPP_FROM" \
    TWILIO_AUTH_TOKEN=secretref:twilio-token
fi

# Modelo de Azure OpenAI (opcional, ADR-0011): con OPENAI_API_KEY definido, se revisan las fotos de WhatsApp.
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  az containerapp secret set --name "$APP" --resource-group "$GRUPO" --secrets "openai-key=$OPENAI_API_KEY"
  az containerapp update --name "$APP" --resource-group "$GRUPO" --set-env-vars OPENAI_API_KEY=secretref:openai-key \
    OPENAI_BASE_URL="$OPENAI_BASE_URL" CLASIFICACION_MODELO="$CLASIFICACION_MODELO" \
    CLASIFICACION_ACTIVA="${CLASIFICACION_ACTIVA:-true}"
fi

echo "URL: https://$(az containerapp show --name "$APP" --resource-group "$GRUPO" \
  --query properties.configuration.ingress.fqdn --output tsv)"
