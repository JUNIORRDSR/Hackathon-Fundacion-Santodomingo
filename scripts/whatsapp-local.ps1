#Requires -Version 7.2
[CmdletBinding()]
param(
    [uri]$UrlFija,
    [switch]$Cloudflare,
    [switch]$Temporal,
    [switch]$Compilar
)

& (Join-Path $PSScriptRoot '../deploy/whatsapp-local.ps1') @PSBoundParameters
