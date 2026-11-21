#Requires -Version 7.2
[CmdletBinding(DefaultParameterSetName = 'Ngrok')]
param(
    [Parameter(ParameterSetName = 'Cloudflare')]
    [uri]$UrlFija,
    [Parameter(ParameterSetName = 'Cloudflare')]
    [switch]$Cloudflare,
    [Parameter(Mandatory, ParameterSetName = 'Temporal')]
    [switch]$Temporal,
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

function Set-ValorEntorno([string]$Actual, [string]$Nombre, [string]$Valor) {
    $patron = [regex]('(?m)^[ \t]*(?:export[ \t]+)?' + [regex]::Escape($Nombre) + '[ \t]*=[^\r\n]*')
    $coincidencias = $patron.Matches($Actual)
    if ($coincidencias.Count -gt 1) { throw "$Nombre está duplicada en .env." }

    $linea = "$Nombre=$Valor"
    if ($coincidencias.Count -eq 1) {
        return $patron.Replace($Actual, $linea, 1)
    }
    $salto = if ($Actual.Contains("`r`n")) { "`r`n" } else { "`n" }
    return $Actual.TrimEnd([char[]]"`r`n") + $salto + $linea + $salto
}

function Write-Entorno([string]$Actual, [string]$Nuevo) {
    if ($Actual -ceq $Nuevo) { return }

    $temporal = [IO.Path]::Combine($Repo, '.env.whatsapp-' + [Guid]::NewGuid().ToString('N'))
    try {
        [IO.File]::WriteAllText($temporal, $Nuevo)
        if ([IO.File]::ReadAllText($ArchivoEntorno) -cne $Actual) { throw '.env cambió. Ejecuta el script de nuevo.' }
        [IO.File]::Move($temporal, $ArchivoEntorno, $true)
    } finally {
        if ([IO.File]::Exists($temporal)) { [IO.File]::Delete($temporal) }
    }
}

function Get-UrlFija([string]$Dominio, [string]$Variable) {
    if ($Dominio -notmatch '^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$') {
        throw "Configura $Variable en .env con el dominio público del túnel, sin https:// ni ruta."
    }
    return [uri]("https://$Dominio$Ruta")
}

function Test-ProxyWebhook([string]$Url, [string]$Servicio) {
    # El proxy devuelve 405 antes de consultar la app. Verifica el túnel con el .env intacto.
    $consulta = @{
        Uri = $Url
        Method = 'Options'
        TimeoutSec = 4
        SkipHttpErrorCheck = $true
        Headers = @{ 'ngrok-skip-browser-warning' = '1' }
    }
    $hasta = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try {
            if ((Invoke-WebRequest @consulta).StatusCode -eq 405) { return }
        } catch {
            # El agente del túnel puede tardar en conectarse.
        }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $hasta)
    throw "El túnel no llega al proxy local. Revisa el dominio, el token y los logs de $Servicio."
}

function Test-Webhook([string]$Url, [string]$Token) {
    # Un formulario sin remitente ni SID verifica la firma sin enviar ni registrar un mensaje.
    $campo = 'Probe'
    $valor = 'ecoconecta'
    $clave = [Text.Encoding]::UTF8.GetBytes($Token)
    $datos = [Text.Encoding]::UTF8.GetBytes($Url + $campo + $valor)
    $firma = [Convert]::ToBase64String([Security.Cryptography.HMACSHA1]::HashData($clave, $datos))
    $cabeceras = @{ 'ngrok-skip-browser-warning' = '1' }
    $cabecerasFirmadas = $cabeceras + @{ 'X-Twilio-Signature' = $firma }
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
            $sinFirma = Invoke-WebRequest @formulario -Headers $cabeceras
            $firmado = Invoke-WebRequest @formulario -Headers $cabecerasFirmadas
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
    $config = Invoke-EcoCompose --profile '*' config --format json | ConvertFrom-Json -AsHashtable
    $app = $config.services.app.environment
    if ($app.TRANSPORTE -ne 'twilio') {
        throw 'Configura TRANSPORTE=twilio en el .env de la raíz.'
    }
    foreach ($variable in 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM') {
        if ([string]::IsNullOrWhiteSpace($app[$variable])) {
            throw "Configura $variable en el .env de la raíz."
        }
    }
    if ($app.REINICIAR_BASE) { throw 'Quita REINICIAR_BASE del entorno antes de iniciar la app local.' }

    $nuevo = $original
    if ($Temporal) {
        Invoke-EcoCompose up -d whatsapp-tunel-temporal
        $url = Get-TunelTemporal
    } else {
        if ($PSCmdlet.ParameterSetName -eq 'Cloudflare') {
            if (-not $config.services.'whatsapp-tunel-fijo'.environment.TUNNEL_TOKEN) {
                throw 'Agrega CLOUDFLARE_TUNNEL_TOKEN al .env local con el token del túnel dedicado a EcoConecta.'
            }
            $fija = $UrlFija
            if (-not $fija) {
                $fija = Get-UrlFija $app.CLOUDFLARE_TUNNEL_HOSTNAME 'CLOUDFLARE_TUNNEL_HOSTNAME'
            }
            $servicio = 'whatsapp-tunel-fijo'
        } else {
            $ngrok = $config.services.'whatsapp-tunel-ngrok'.environment
            if (-not $ngrok.NGROK_AUTHTOKEN) {
                throw 'Agrega NGROK_AUTHTOKEN al .env local con el token de tu cuenta de ngrok.'
            }
            $fija = Get-UrlFija $ngrok.NGROK_DOMAIN 'NGROK_DOMAIN'
            $servicio = 'whatsapp-tunel-ngrok'
        }
        if (-not $fija.IsAbsoluteUri -or $fija.Scheme -ne 'https' -or -not $fija.IsDefaultPort -or
            $fija.IsLoopback -or $fija.HostNameType -ne 'Dns' -or $fija.Host -notmatch '\.' -or
            $fija.UserInfo -or $fija.Query -or $fija.Fragment -or $fija.AbsolutePath -cne $Ruta -or
            $fija.Host -match '(^|\.)trycloudflare\.com\.?$') {
            throw "Usa la URL HTTPS pública fija con la ruta $Ruta."
        }
        $url = $fija.AbsoluteUri
        if ($UrlFija) {
            $nuevo = Set-ValorEntorno $original 'CLOUDFLARE_TUNNEL_HOSTNAME' $fija.Host
        }
        Invoke-EcoCompose up -d $servicio
        Test-ProxyWebhook $url $servicio
    }

    $cambioUrl = $app.TWILIO_WEBHOOK_URL -cne $url
    $nuevo = Set-ValorEntorno $nuevo 'TWILIO_WEBHOOK_URL' $url
    Write-Entorno $original $nuevo
    $opciones = @(if ($Compilar) { '--build' })
    Invoke-EcoCompose up -d @opciones app
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
