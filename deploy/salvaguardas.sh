#!/usr/bin/env bash
# Salvaguardas de Azure para los modelos (ADR-0013): crea la política de contenido ecoconecta-salvaguardas sobre
# Microsoft.DefaultV2, con Prompt Shields, y la asigna a los despliegues de texto e imagen. Whisper no la admite.
# Uso: GRUPO_IA=Hackathon CUENTA=agentic-vision DESPLIEGUES="gpt-5-mini" bash deploy/salvaguardas.sh
set -euo pipefail

GRUPO_IA="${GRUPO_IA:-Hackathon}"
CUENTA="${CUENTA:-agentic-vision}"
DESPLIEGUES="${DESPLIEGUES:-gpt-5-mini}"
VERSION="api-version=2024-10-01"
PYTHON="$(command -v python3 || command -v python)"
SUSCRIPCION="$(az account show --query id --output tsv | tr -d '\r')"
URL="https://management.azure.com/subscriptions/$SUSCRIPCION/resourceGroups/$GRUPO_IA"
URL="$URL/providers/Microsoft.CognitiveServices/accounts/$CUENTA"

az rest --method put --url "$URL/raiPolicies/ecoconecta-salvaguardas?$VERSION" \
  --body "@$(dirname "$0")/politica-salvaguardas.json" --output none
for despliegue in $DESPLIEGUES; do
  # El despliegue se reescribe con el mismo modelo y la misma capacidad: solo cambia la política.
  cuerpo="$(az rest --method get --url "$URL/deployments/$despliegue?$VERSION" | "$PYTHON" -c '
import json, sys
d = json.load(sys.stdin); p = d["properties"]
print(json.dumps({"sku": d["sku"], "properties": {"model": p["model"], "raiPolicyName": "ecoconecta-salvaguardas",
      "versionUpgradeOption": p.get("versionUpgradeOption", "OnceNewDefaultVersionAvailable")}}))')"
  az rest --method put --url "$URL/deployments/$despliegue?$VERSION" --body "$cuerpo" --output none
  echo "$CUENTA/$despliegue: ecoconecta-salvaguardas"
done
