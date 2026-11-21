# CaySoc Global - Paperclip bootstrap to cx-serv1 (192.168.0.4, cx)
# SECURITY: prefer SSH keys. Rotate shared passwords/keys after bootstrap.
param(
  [string]$VpsHost = "192.168.0.4",
  [string]$VpsUser = "cx",
  [string]$RemoteDir = "/home/cx/caysoc/paperclip",
  [string]$PaperclipRepo = "https://github.com/paperclipai/paperclip.git"
)
$ErrorActionPreference = "Stop"
Write-Host "=== CaySoc Global -> cx-serv1 $VpsUser@$VpsHost ===" -ForegroundColor Cyan
ssh "$VpsUser@$VpsHost" "echo SSH_OK && uname -a"
ssh "$VpsUser@$VpsHost" "mkdir -p $RemoteDir/app $RemoteDir"
ssh "$VpsUser@$VpsHost" "if [ -d $RemoteDir/app/.git ]; then cd $RemoteDir/app && git pull; else git clone $PaperclipRepo $RemoteDir/app; fi"
$local = $PSScriptRoot
scp "$local/.env.cx-serv1.example" "${VpsUser}@${VpsHost}:$RemoteDir/.env.cx-serv1.example"
scp "$local/docker-compose.cx-serv1.yml" "${VpsUser}@${VpsHost}:$RemoteDir/docker-compose.cx-serv1.yml"
scp "$local/deploy-cx-serv1.sh" "${VpsUser}@${VpsHost}:$RemoteDir/deploy-cx-serv1.sh"
ssh "$VpsUser@$VpsHost" "chmod +x $RemoteDir/deploy-cx-serv1.sh"
Write-Host "Manual: create $RemoteDir/.env with secrets, then: cd $RemoteDir && ./deploy-cx-serv1.sh" -ForegroundColor Yellow
