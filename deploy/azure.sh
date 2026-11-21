#!/usr/bin/env bash
# Despliegue de EcoConecta en Azure (ADR-0005). Lo corre Leonardo con su suscripción de Azure for Students.
# Requisitos: az login y Docker encendido (la imagen se construye en local).
# Uso, desde la raíz del repo: CLAVE_SESION=... CLAVE_DEMO=... CODIGO_REGISTRO=... CLAVE_BD=... bash deploy/azure.sh
# Con Twilio y el bot con LLM, además: TRANSPORTE=twilio CONVERSADOR=llm y sus variables (ver .env.example).
# REINICIAR_BASE=1 borra los datos de la app y la siembra de nuevo (una sola vez por publicación); CARGAR_DEMO=1
# carga después el día de demo ficticio con scripts/dia_de_demo.py.
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

# Twilio (Jorge) y el bot con LLM: se validan antes de tocar Azure.
MODO_TRANSPORTE="${TRANSPORTE:-simulado}"
if [[ -z "${TRANSPORTE:-}" && -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
  MODO_TRANSPORTE=twilio
fi
MODO_CONVERSADOR="${CONVERSADOR:-menu}"
RUTA_WEBHOOK="/api/whatsapp/twilio"
if [[ "$MODO_TRANSPORTE" == twilio || "${CARGAR_DEMO:-}" == 1 ]]; then
  PYTHON="$(command -v python3 || command -v python)" || {
    echo "Se requiere Python 3 para verificar el webhook o cargar la demo." >&2
    exit 1
  }
fi
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
# Una etiqueta distinta también aplica los cambios de secretos al volver a desplegar el mismo commit.
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
IMAGEN="$REGISTRO.azurecr.io/$APP:$(git rev-parse --short HEAD)-$SELLO"
az acr login --name "$REGISTRO"
docker build --tag "$IMAGEN" .
docker push "$IMAGEN"

OPCIONES_APP=(--name "$APP" --resource-group "$GRUPO")
CLAVE_REGISTRO="$(az acr credential show --name "$REGISTRO" --query "passwords[0].value" --output tsv | tr -d '\r')"
APP_EXISTENTE="$(az containerapp list --resource-group "$GRUPO" --query "[?name=='$APP'].name | [0]" --output tsv | tr -d '\r')"
if [[ -n "$APP_EXISTENTE" ]]; then
  INGRESO="$(az containerapp show "${OPCIONES_APP[@]}" \
    --query 'properties.configuration.ingress.external && properties.configuration.ingress.targetPort == `8000`' \
    --output tsv | tr -d '\r')"
  if [[ "$INGRESO" != True && "$INGRESO" != true ]]; then
    az containerapp ingress enable "${OPCIONES_APP[@]}" --type external --target-port 8000 --output none
  fi
  FQDN="$(az containerapp show "${OPCIONES_APP[@]}" \
    --query properties.configuration.ingress.fqdn --output tsv | tr -d '\r')"
else
  DOMINIO_ENTORNO="$(az containerapp env list --resource-group "$GRUPO" \
    --query "[?name=='$ENTORNO_ACA'].properties.defaultDomain | [0]" --output tsv | tr -d '\r')"
  if [[ -z "$DOMINIO_ENTORNO" ]]; then
    DOMINIO_ENTORNO="$(az containerapp env create --name "$ENTORNO_ACA" --resource-group "$GRUPO" \
      --location "$REGION" --query properties.defaultDomain --output tsv | tr -d '\r')"
  fi
  : "${DOMINIO_ENTORNO:?Azure no devolvió el dominio del entorno}"
  FQDN="$APP.$DOMINIO_ENTORNO"
fi
: "${FQDN:?Azure no devolvió el dominio público de la aplicación}"

# Secretos fuera del repo; la app los lee como variables de entorno. Una réplica evita arranques en frío en la demo.
SECRETOS=("clave-sesion=$CLAVE_SESION" "clave-demo=$CLAVE_DEMO" "codigo-registro=$CODIGO_REGISTRO" "url-bd=$URL_BD")
VARIABLES=(ENTORNO=produccion SEMBRAR_DEMO=1 CLAVE_SESION=secretref:clave-sesion CLAVE_DEMO=secretref:clave-demo
  CODIGO_REGISTRO=secretref:codigo-registro DATABASE_URL=secretref:url-bd "TRANSPORTE=$MODO_TRANSPORTE"
  "CONVERSADOR=$MODO_CONVERSADOR")

if [[ "$MODO_TRANSPORTE" == twilio ]]; then
  # La firma de Twilio usa la URL pública de la app, con independencia del túnel local o de la revisión.
  WEBHOOK="https://$FQDN$RUTA_WEBHOOK"
  SECRETOS+=("twilio-token=$TWILIO_AUTH_TOKEN")
  VARIABLES+=("TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID" "TWILIO_WHATSAPP_FROM=$TWILIO_WHATSAPP_FROM"
    "TWILIO_WEBHOOK_URL=$WEBHOOK"
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

# Azure OpenAI: lo usan el bot con LLM (Jorge) y la revisión de fotos (Leonardo), con la misma clave.
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  SECRETOS+=("openai-api-key=$OPENAI_API_KEY")
  VARIABLES+=("OPENAI_BASE_URL=$OPENAI_BASE_URL" OPENAI_API_KEY=secretref:openai-api-key)
  if [[ "$MODO_CONVERSADOR" == llm ]]; then
    VARIABLES+=("CONVERSADOR_MODELO=$CONVERSADOR_MODELO" "CONVERSADOR_RAZONAMIENTO=${CONVERSADOR_RAZONAMIENTO:-}")
  fi
  if [[ -n "${CLASIFICACION_MODELO:-}" ]]; then
    VARIABLES+=("CLASIFICACION_MODELO=$CLASIFICACION_MODELO" "CLASIFICACION_ACTIVA=${CLASIFICACION_ACTIVA:-true}")
  fi
  if [[ -n "${TRANSCRIPCION_MODELO:-}" ]]; then
    VARIABLES+=("TRANSCRIPCION_MODELO=$TRANSCRIPCION_MODELO")  # notas de voz (ADR-0013)
  fi
fi

# La base se reinicia una sola vez por sello: la app lo guarda y no vuelve a borrar si se reinicia (ADR-0012).
if [[ "${REINICIAR_BASE:-}" == 1 ]]; then
  VARIABLES+=("REINICIAR_BASE=$SELLO")
else
  VARIABLES+=(REINICIAR_BASE=)
fi

if [[ -n "$APP_EXISTENTE" ]]; then
  MODO_REVISION="$(az containerapp show "${OPCIONES_APP[@]}" \
    --query properties.configuration.activeRevisionsMode --output tsv | tr -d '\r')"
  if [[ "$MODO_REVISION" != Single ]]; then
    az containerapp revision set-mode "${OPCIONES_APP[@]}" --mode single --output none
  fi
  az containerapp registry set "${OPCIONES_APP[@]}" --server "$REGISTRO.azurecr.io" --username "$REGISTRO" \
    --password "$CLAVE_REGISTRO" --output none
  az containerapp secret set "${OPCIONES_APP[@]}" --secrets "${SECRETOS[@]}" --output none
  REVISION="$(az containerapp update "${OPCIONES_APP[@]}" --image "$IMAGEN" --min-replicas 1 --max-replicas 1 \
    --set-env-vars "${VARIABLES[@]}" --query properties.latestRevisionName --output tsv | tr -d '\r')"
else
  REVISION="$(az containerapp create "${OPCIONES_APP[@]}" --environment "$ENTORNO_ACA" --image "$IMAGEN" \
    --registry-server "$REGISTRO.azurecr.io" --registry-username "$REGISTRO" --registry-password "$CLAVE_REGISTRO" \
    --ingress external --target-port 8000 --revisions-mode single --min-replicas 1 --max-replicas 1 \
    --secrets "${SECRETOS[@]}" --env-vars "${VARIABLES[@]}" --query properties.latestRevisionName --output tsv | tr -d '\r')"
  FQDN_ACTUAL="$(az containerapp show "${OPCIONES_APP[@]}" \
    --query properties.configuration.ingress.fqdn --output tsv | tr -d '\r')"
  if [[ "$FQDN_ACTUAL" != "$FQDN" ]]; then
    echo "Azure asignó un dominio distinto al previsto. Vuelve a ejecutar el despliegue para usar el dominio asignado." >&2
    exit 1
  fi
fi
: "${REVISION:?Azure no devolvió el nombre de la revisión desplegada}"

# Un 200 de la revisión anterior no confirma que la nueva esté atendiendo tráfico.
LISTA=0
for (( intento=0; intento<36; intento++ )); do
  REVISION_LISTA="$(az containerapp show "${OPCIONES_APP[@]}" \
    --query properties.latestReadyRevisionName --output tsv | tr -d '\r')"
  if [[ "$REVISION_LISTA" == "$REVISION" ]] &&
     curl --silent --fail --max-time 10 --output /dev/null "https://$FQDN/api/contenidos/publicos"; then
    LISTA=1
    break
  fi
  sleep 5
done
if [[ "$LISTA" != 1 ]]; then
  echo "La revisión $REVISION aún no responde en https://$FQDN. Revisa Revisions & replicas y los logs en Azure." >&2
  exit 1
fi
echo "EcoConecta disponible en https://$FQDN"

if [[ "$MODO_TRANSPORTE" == twilio ]]; then
  # El formulario vacío comprueba la firma sin crear mensajes, escribir en la base ni contactar a Twilio.
  FIRMA="$("$PYTHON" - "$WEBHOOK" <<'PY'
import base64
import hmac
import os
import sys

firma = hmac.digest(os.environ["TWILIO_AUTH_TOKEN"].encode(), sys.argv[1].encode(), "sha1")
sys.stdout.write(base64.b64encode(firma).decode())
PY
)"
  SONDA=(--silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' --data '')
  SIN_FIRMA="$(curl "${SONDA[@]}" "$WEBHOOK")"
  CON_FIRMA="$(curl "${SONDA[@]}" --header "X-Twilio-Signature: $FIRMA" "$WEBHOOK")"
  if [[ "$SIN_FIRMA" != 403 || "$CON_FIRMA" != 400 ]]; then
    echo "Falló la verificación de $WEBHOOK (sin firma $SIN_FIRMA, con firma $CON_FIRMA)." >&2
    exit 1
  fi
  echo "Webhook verificado en $WEBHOOK. Configura esa URL con POST una vez en el remitente de Twilio."
fi
if [[ "${CARGAR_DEMO:-}" == 1 ]]; then
  CLAVE_DEMO="$CLAVE_DEMO" "$PYTHON" scripts/dia_de_demo.py "https://$FQDN"
fi
