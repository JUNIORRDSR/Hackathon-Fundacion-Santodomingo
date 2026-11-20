#!/usr/bin/env bash
# Despliegue de EcoConecta en Azure Container Apps (ADR-0005). Lo corre Leonardo con su suscripción.
# Requisitos: la CLI de Azure con sesión abierta (az login) y su extensión: az extension add --name containerapp
# Uso, desde la raíz del repo: CLAVE_SESION=... CLAVE_DEMO=... bash deploy/azure.sh
# Sin probar todavía: la primera vez, revisa cada comando con --help.
set -euo pipefail

GRUPO="${GRUPO:-rg-ecoconecta}"
REGION="${REGION:-eastus2}"
APP="${APP:-ecoconecta}"
ENTORNO_ACA="${ENTORNO_ACA:-ecoconecta-env}"
: "${CLAVE_SESION:?Define CLAVE_SESION: una cadena larga y aleatoria}"
: "${CLAVE_DEMO:?Define CLAVE_DEMO: la clave de los usuarios de demostración}"

az group create --name "$GRUPO" --location "$REGION" --output none

# Construye la imagen en Azure (ACR) desde el Dockerfile y crea o actualiza la app con HTTPS público.
az containerapp up --name "$APP" --resource-group "$GRUPO" --location "$REGION" --environment "$ENTORNO_ACA" \
  --source . --ingress external --target-port 8000

# Secretos fuera del repo; la app los lee como variables de entorno.
az containerapp secret set --name "$APP" --resource-group "$GRUPO" \
  --secrets "clave-sesion=$CLAVE_SESION" "clave-demo=$CLAVE_DEMO"

# Mientras los datos vivan en memoria: una sola réplica siempre encendida (si escala a cero, se pierden).
az containerapp update --name "$APP" --resource-group "$GRUPO" --min-replicas 1 --max-replicas 1 \
  --set-env-vars ENTORNO=produccion SEMBRAR_DEMO=1 CLAVE_SESION=secretref:clave-sesion CLAVE_DEMO=secretref:clave-demo

echo "URL: https://$(az containerapp show --name "$APP" --resource-group "$GRUPO" \
  --query properties.configuration.ingress.fqdn --output tsv)"
