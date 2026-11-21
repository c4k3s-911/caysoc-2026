# CaySoc Global - cx-serv1 Paperclip Deployment
Target: **cx-serv1** `192.168.0.4` (user `cx`). TZ: `Africa/Johannesburg`.

## Files
- `.env.cx-serv1.example` (safe template - no secrets)
- `docker-compose.cx-serv1.yml` (Linux paths, localhost bind for 3100)
- `deploy-cx-serv1.sh` / `deploy-cx-serv1.ps1`

## Before production
- Rotate shared passwords/keys and any previously exposed gateway/API keys.
- Use SSH keys; restrict port 3100 (VPN/Tailscale/LAN ACL/reverse proxy).
- POPIA-aware data handling; classify data before agent access.
