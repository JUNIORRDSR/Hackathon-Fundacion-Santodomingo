#Requires -Version 7.2
[CmdletBinding()]
param(
    [uri]$UrlFija,
    [switch]$Compilar
)

$ErrorActionPreference = 'Stop'
$Ruta = '/api/whatsapp/twilio'
$Repo = Split-Path -Parent $PSScriptRoot
$ArchivoEntorno = Join-Path $Repo '.env'

function Invoke-EcoCompose {
    docker compose --progress quiet -f docker-compose.yml -f deploy/whatsapp-local.compose.yml @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose falló en '$($args[0])'."
    }
}

function Get-TunelTemporal {
    $hasta = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $logs = Invoke-EcoCompose logs --no-color --tail 120 whatsapp-tunel-temporal
        $url = [regex]::Matches(($logs -join "`n"), 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($url.Count -gt 0) { return $url[-1].Value + $Ruta }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $hasta)
    throw 'Cloudflare no publicó la dirección temporal. Revisa los logs del servicio whatsapp-tunel-temporal.'
}

function Set-WebhookUrl([string]$Actual, [string]$Url) {
    $patron = [regex]'(?m)^TWILIO_WEBHOOK_URL=[^\r\n]*'
    $coincidencias = $patron.Matches($Actual)
    if ($coincidencias.Count -gt 1) { throw 'TWILIO_WEBHOOK_URL está duplicada en .env.' }

    $linea = "TWILIO_WEBHOOK_URL=$Url"
    if ($coincidencias.Count -eq 1) {
        $nuevo = $patron.Replace($Actual, $linea, 1)
    } else {
        $salto = if ($Actual.Contains("`r`n")) { "`r`n" } else { "`n" }
        $nuevo = $Actual.TrimEnd([char[]]"`r`n") + $salto + $linea + $salto
    }
    if ($Actual -eq $nuevo) { return $false }

    $temporal = [IO.Path]::Combine($Repo, '.env.whatsapp-' + [Guid]::NewGuid().ToString('N'))
    try {
        [IO.File]::WriteAllText($temporal, $nuevo)
        if ([IO.File]::ReadAllText($ArchivoEntorno) -cne $Actual) { throw '.env cambió. Ejecuta el script de nuevo.' }
        [IO.File]::Move($temporal, $ArchivoEntorno, $true)
    } finally {
        if ([IO.File]::Exists($temporal)) { [IO.File]::Delete($temporal) }
    }
    return $true
}

function Test-Webhook([string]$Url, [string]$Token) {
    # Un formulario sin remitente ni SID verifica la firma sin enviar ni registrar un mensaje.
    $campo = 'Probe'
    $valor = 'ecoconecta'
    $clave = [Text.Encoding]::UTF8.GetBytes($Token)
    $datos = [Text.Encoding]::UTF8.GetBytes($Url + $campo + $valor)
    $firma = [Convert]::ToBase64String([Security.Cryptography.HMACSHA1]::HashData($clave, $datos))
    $formulario = @{
        Uri = $Url
        Method = 'Post'
        ContentType = 'application/x-www-form-urlencoded'
        Body = "$campo=$valor"
        SkipHttpErrorCheck = $true
        TimeoutSec = 4
    }
    $hasta = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try {
            $sinFirma = Invoke-WebRequest @formulario
            $firmado = Invoke-WebRequest @formulario -Headers @{ 'X-Twilio-Signature' = $firma }
            if ($sinFirma.StatusCode -eq 403 -and $firmado.StatusCode -eq 400 -and
                $firmado.Content -match 'sin teléfono asociado') {
                return
            }
        } catch {
            # El dominio y el contenedor pueden tardar en quedar disponibles.
        }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $hasta)
    throw 'No se pudo verificar el webhook público. Revisa el túnel y que el dominio apunte a whatsapp-webhook:8080.'
}

Push-Location $Repo
try {
    $original = [IO.File]::ReadAllText($ArchivoEntorno)
    # Carga los valores resueltos por Compose sin mostrar variables ni secretos.
    $config = Invoke-EcoCompose config --format json | ConvertFrom-Json -AsHashtable
    $app = $config.services.app.environment
    if ($app.TRANSPORTE -ne 'twilio' -or -not $app.TWILIO_AUTH_TOKEN) {
        throw 'Configura TRANSPORTE=twilio y las credenciales en el .env de la raíz.'
    }
    if ($app.REINICIAR_BASE) { throw 'Quita REINICIAR_BASE del entorno antes de iniciar la app local.' }

    $tokenFijo = $config.services.'whatsapp-tunel-fijo'.environment.TUNNEL_TOKEN
    if ($tokenFijo -and -not $UrlFija) {
        $UrlFija = [uri]$app.TWILIO_WEBHOOK_URL
        if (-not $UrlFija -or $UrlFija.Host.EndsWith('.trycloudflare.com')) {
            throw 'Indica el dominio del túnel fijo con -UrlFija la primera vez.'
        }
    }
    if ($UrlFija) {
        if (-not $UrlFija.IsAbsoluteUri -or $UrlFija.Scheme -ne 'https' -or -not $UrlFija.IsDefaultPort -or
            $UrlFija.UserInfo -or $UrlFija.Query -or $UrlFija.Fragment -or
            $UrlFija.AbsolutePath -ne $Ruta -or $UrlFija.Host.EndsWith('.trycloudflare.com')) {
            throw "Usa la URL HTTPS pública fija con la ruta $Ruta."
        }
        if (-not $tokenFijo) {
            throw 'Agrega CLOUDFLARE_TUNNEL_TOKEN al .env local con el token del túnel dedicado a EcoConecta.'
        }
        $url = $UrlFija.AbsoluteUri
        Invoke-EcoCompose up -d whatsapp-tunel-fijo
    } else {
        Invoke-EcoCompose up -d whatsapp-tunel-temporal
        $url = Get-TunelTemporal
    }

    $cambioUrl = Set-WebhookUrl $original $url
    if ($Compilar) {
        Invoke-EcoCompose up -d --build app
    } else {
        Invoke-EcoCompose up -d app
    }
    Test-Webhook $url $app.TWILIO_AUTH_TOKEN
    Write-Output "Webhook verificado: $url"
    if ($cambioUrl) {
        Write-Output 'Guarda esta URL con método POST en «When a message comes in» del Sandbox de Twilio.'
    } else {
        Write-Output 'La URL del .env ya coincide. Si es la primera vez, guárdala también en Twilio.'
    }
} finally {
    Pop-Location
}
