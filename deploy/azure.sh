#!/usr/bin/env bash
# Despliegue de EcoConecta en Azure (ADR-0005). Lo corre Leonardo con su suscripción. Sin probar todavía: la primera
# vez, revisa cada comando con --help. Requisitos: az login y az extension add --name containerapp
# Uso, desde la raíz del repo: CLAVE_SESION=... CLAVE_DEMO=... CODIGO_REGISTRO=... CLAVE_BD=... bash deploy/azure.sh
set -euo pipefail

GRUPO="${GRUPO:-rg-ecoconecta}"
REGION="${REGION:-eastus2}"
APP="${APP:-ecoconecta}"
ENTORNO_ACA="${ENTORNO_ACA:-ecoconecta-env}"
SERVIDOR_BD="${SERVIDOR_BD:-ecoconecta-pg}"  # debe ser único en todo Azure
: "${CLAVE_SESION:?Define CLAVE_SESION: una cadena larga y aleatoria}"
: "${CLAVE_DEMO:?Define CLAVE_DEMO: la clave de los usuarios de demostración}"
: "${CODIGO_REGISTRO:?Define CODIGO_REGISTRO: el código que la fundación da a quien crea una cuenta}"
: "${CLAVE_BD:?Define CLAVE_BD: la clave de PostgreSQL, sin @ : / ni # porque va dentro de la URL}"

az group create --name "$GRUPO" --location "$REGION" --output none

# PostgreSQL gestionado. 0.0.0.0 abre el firewall solo a los servicios de Azure.
az postgres flexible-server create --resource-group "$GRUPO" --name "$SERVIDOR_BD" --location "$REGION" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user ecoconecta --admin-password "$CLAVE_BD" --database-name ecoconecta --public-access 0.0.0.0 --yes
URL_BD="postgresql+psycopg://ecoconecta:$CLAVE_BD@$SERVIDOR_BD.postgres.database.azure.com:5432/ecoconecta?sslmode=require"

# Construye la imagen en Azure (ACR) desde el Dockerfile y crea o actualiza la app con HTTPS público.
az containerapp up --name "$APP" --resource-group "$GRUPO" --location "$REGION" --environment "$ENTORNO_ACA" \
  --source . --ingress external --target-port 8000

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

echo "URL: https://$(az containerapp show --name "$APP" --resource-group "$GRUPO" \
  --query properties.configuration.ingress.fqdn --output tsv)"
