#!/usr/bin/env bash
# Despliegue de EcoConecta en Azure (ADR-0005). Lo corre Leonardo con su suscripción. Sin probar todavía: la primera
# vez, revisa cada comando con --help. Requisitos: az login y az extension add --name containerapp
# Uso, desde la raíz del repo: CLAVE_SESION=... CLAVE_DEMO=... CLAVE_BD=... bash deploy/azure.sh
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

MODO_TRANSPORTE="${TRANSPORTE:-simulado}"
if [[ -z "${TRANSPORTE:-}" && -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
  MODO_TRANSPORTE=twilio
fi
MODO_CONVERSADOR="${CONVERSADOR:-menu}"
if [[ "$MODO_TRANSPORTE" == twilio ]]; then
  : "${TWILIO_ACCOUNT_SID:?Define TWILIO_ACCOUNT_SID}"
  : "${TWILIO_AUTH_TOKEN:?Define TWILIO_AUTH_TOKEN}"
  : "${TWILIO_WHATSAPP_FROM:?Define TWILIO_WHATSAPP_FROM}"
fi
if [[ "$MODO_CONVERSADOR" == llm ]]; then
  : "${OPENAI_BASE_URL:?Define el endpoint de Azure OpenAI en OPENAI_BASE_URL}"
  : "${OPENAI_API_KEY:?Define OPENAI_API_KEY}"
  : "${CONVERSADOR_MODELO:?Define el nombre del despliegue en CONVERSADOR_MODELO}"
fi

az group create --name "$GRUPO" --location "$REGION" --output none

# PostgreSQL gestionado. 0.0.0.0 abre el firewall solo a los servicios de Azure.
az postgres flexible-server create --resource-group "$GRUPO" --name "$SERVIDOR_BD" --location "$REGION" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user ecoconecta --admin-password "$CLAVE_BD" --database-name ecoconecta --public-access 0.0.0.0 --yes
URL_BD="postgresql+psycopg://ecoconecta:$CLAVE_BD@$SERVIDOR_BD.postgres.database.azure.com:5432/ecoconecta?sslmode=require"

# Construye la imagen en Azure (ACR) desde el Dockerfile y crea o actualiza la app con HTTPS público.
az containerapp up --name "$APP" --resource-group "$GRUPO" --location "$REGION" --environment "$ENTORNO_ACA" \
  --source . --ingress external --target-port 8000

FQDN="$(az containerapp show --name "$APP" --resource-group "$GRUPO" \
  --query properties.configuration.ingress.fqdn --output tsv)"
SECRETOS=("clave-sesion=$CLAVE_SESION" "clave-demo=$CLAVE_DEMO" "codigo-registro=$CODIGO_REGISTRO" "url-bd=$URL_BD")
VARIABLES=(ENTORNO=produccion SEMBRAR_DEMO=1 CLAVE_SESION=secretref:clave-sesion CLAVE_DEMO=secretref:clave-demo
  CODIGO_REGISTRO=secretref:codigo-registro DATABASE_URL=secretref:url-bd "TRANSPORTE=$MODO_TRANSPORTE" "CONVERSADOR=$MODO_CONVERSADOR")

if [[ "$MODO_TRANSPORTE" == twilio ]]; then
  SECRETOS+=("twilio-token=$TWILIO_AUTH_TOKEN")
  VARIABLES+=("TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID" "TWILIO_WHATSAPP_FROM=$TWILIO_WHATSAPP_FROM"
    "TWILIO_WEBHOOK_URL=${TWILIO_WEBHOOK_URL:-https://$FQDN/api/whatsapp/twilio}"
    "TWILIO_RESPUESTA_TWIML=${TWILIO_RESPUESTA_TWIML:-0}"
    TWILIO_AUTH_TOKEN=secretref:twilio-token)
  if [[ -n "${WHATSAPP_CONTACT_ALIASES:-}" ]]; then
    SECRETOS+=("whatsapp-alias=$WHATSAPP_CONTACT_ALIASES")
    VARIABLES+=(WHATSAPP_CONTACT_ALIASES=secretref:whatsapp-alias)
  fi
  if [[ -n "${WHATSAPP_PILOT_NUMBERS:-}" ]]; then
    SECRETOS+=("whatsapp-piloto=$WHATSAPP_PILOT_NUMBERS")
    VARIABLES+=(WHATSAPP_PILOT_NUMBERS=secretref:whatsapp-piloto)
  fi
fi

if [[ "$MODO_CONVERSADOR" == llm ]]; then
  SECRETOS+=("openai-api-key=$OPENAI_API_KEY")
  VARIABLES+=("OPENAI_BASE_URL=$OPENAI_BASE_URL" "CONVERSADOR_MODELO=$CONVERSADOR_MODELO"
    "CONVERSADOR_RAZONAMIENTO=${CONVERSADOR_RAZONAMIENTO:-}"
    OPENAI_API_KEY=secretref:openai-api-key)
fi

az containerapp secret set --name "$APP" --resource-group "$GRUPO" --secrets "${SECRETOS[@]}" --output none
az containerapp update --name "$APP" --resource-group "$GRUPO" --min-replicas 1 --max-replicas 1 \
  --set-env-vars "${VARIABLES[@]}" --output none
echo "URL: https://$FQDN"
