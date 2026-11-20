#!/usr/bin/env bash
# Prueba de punta a punta del WhatsApp real con playwright-cli: entra a la tablet, abre el monitor, escribe como
# vecino desde TELEFONO_PRUEBA (el bot le responde por Twilio) y luego la coordinación toma el control y le escribe.
# El celular debe estar unido al sandbox de Twilio (join <palabra>) en las últimas 24 horas.
#
# Uso: TELEFONO_PRUEBA=+57... CLAVE=... bash scripts/prueba_whatsapp.sh [URL]
#   URL por defecto: la app publicada. USUARIO por defecto: admin.
set -euo pipefail

URL="${1:-https://ecoconecta.happytree-01383e4e.northcentralus.azurecontainerapps.io}"
URL="${URL%/}"
USUARIO="${USUARIO:-admin}"
: "${CLAVE:?Define CLAVE: la clave del usuario de la tablet}"
: "${TELEFONO_PRUEBA:?Define TELEFONO_PRUEBA: el celular unido al sandbox, en formato +57...}"
[[ "$TELEFONO_PRUEBA" =~ ^\+[0-9]{8,15}$ ]] || { echo "TELEFONO_PRUEBA debe ser + y solo dígitos"; exit 1; }
SESION="prueba-whatsapp"
pw() { playwright-cli -s="$SESION" "$@" >/dev/null; }
valor() { playwright-cli -s="$SESION" --raw eval "$1" | tail -1 | tr -d '"'; }
ultimo_saliente="fetch('/api/whatsapp/conversaciones/' + encodeURIComponent('$TELEFONO_PRUEBA') + '/mensajes')
  .then(r => r.json()).then(l => { const s = l.filter(m => m.direccion === 'saliente').at(-1);
  return s ? s.autor + ' · ' + s.estado + ' · ' + s.texto.slice(0, 70).replace(/\\n/g, ' ') : 'sin mensajes' })"

echo "1. Entrar a $URL como $USUARIO"
playwright-cli -s="$SESION" open --browser=msedge "$URL/" >/dev/null
pw resize 1280 860
pw fill "getByLabel('Usuario')" "$USUARIO"
pw fill "getByLabel('Clave')" "$CLAVE" --submit
sleep 3

echo "2. Escribir «Hola» como vecino desde el monitor: el bot responde por Twilio"
pw goto "$URL/#/whatsapp"
sleep 2
pw click "getByRole('button', { name: /vecino/ })"
pw fill ".monitor-telefono-input" "$TELEFONO_PRUEBA"
pw fill "input[aria-label='Mensaje']" "Hola" --submit
sleep 5
echo "   Respuesta del bot: $(valor "$ultimo_saliente")"

echo "3. La coordinación toma el control y escribe (el monitor ya dejó elegida esa conversación)"
pw click "getByRole('button', { name: 'Tomar el control' })"
sleep 2
pw click "getByRole('button', { name: 'Como coordinación' })"
pw fill "input[aria-label='Mensaje']" "Prueba de EcoConecta: este mensaje lo envía la coordinación desde la tablet." --submit
sleep 5
echo "   Mensaje de la coordinación: $(valor "$ultimo_saliente")"
pw click "getByRole('button', { name: 'Devolver al bot' })"
pw screenshot --filename=prueba-whatsapp.png
playwright-cli -s="$SESION" close >/dev/null

echo
echo "«enviado» quiere decir que Twilio aceptó el mensaje; revisa el celular. «fallido» muestra el error en los logs."
