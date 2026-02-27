# Deployment Guide — rightdata.uk

The application is deployed to a **Hetzner Cloud VPS** using Docker and served via **Caddy** with automatic HTTPS.

## Server Details
- **Provider:** Hetzner Cloud
- **IP:** `89.167.62.131`
- **OS:** Ubuntu 24.04 LTS
- **User:** `root`
- **App directory:** `/opt/uk-property-analyzer`
- **Live URL:** https://www.rightdata.uk

## Architecture
- **Docker container** runs the Next.js app on port `3000`
- **Caddy** acts as a reverse proxy on ports `80`/`443`, handling SSL automatically via Let's Encrypt
- **SQLite database** is persisted via a Docker volume at `/app/data/production.db`
- **Playwright cookies** are persisted via a Docker volume at `/app/debug`

## ⚠️ Known Quirk: docker-compose v1 on Ubuntu 24.04
The server has `docker-compose` v1.29.2 (the legacy Python-based CLI). This version has a bug with newer Docker Engine where it cannot recreate existing containers — it crashes with a `KeyError: 'ContainerConfig'` error.

**Workaround:** Always remove the old container before running `up`:
```bash
docker rm -f $(docker ps -q -f name=uk-property-analyzer)
docker-compose --env-file .env.prod up -d
```

## Deploying an Update

SSH into the server (password: ask the user):
```bash
ssh root@89.167.62.131
```

Then run the full redeploy sequence:
```bash
cd /opt/uk-property-analyzer
git stash          # stash any server-side local changes (e.g. Dockerfile tweaks)
git pull           # pull latest code from GitHub
docker-compose --env-file .env.prod up -d --build  # build new image
# If docker-compose crashes with 'ContainerConfig' error:
docker rm -f $(docker ps -q -f name=uk-property-analyzer)
docker-compose --env-file .env.prod up -d
```

### After Deploying — Restore the Database
The new container starts fresh with an empty DB. Re-copy the database from the volume:
```bash
docker cp /opt/uk-property-analyzer/production.db $(docker ps -q -f name=uk-property-analyzer):/app/data/production.db
```
Or if you want to push the local dev database, `scp` it first then copy:
```bash
# From your local machine:
scp prisma/dev.db root@89.167.62.131:/opt/uk-property-analyzer/production.db
# Then on the server:
docker cp /opt/uk-property-analyzer/production.db $(docker ps -q -f name=uk-property-analyzer):/app/data/production.db
```

## Setting Up Caddy (Already Done — For Reference)

Caddy is installed at `/etc/caddy/Caddyfile`:
```
rightdata.uk, www.rightdata.uk {
    reverse_proxy localhost:3000
}
```

To reload Caddy config changes:
```bash
systemctl restart caddy
systemctl status caddy --no-pager
```

## Environment Variables
Stored at `/opt/uk-property-analyzer/.env.prod` on the server. Contains:
- `GOOGLE_MAPS_API_KEY`
- `OPENROUTER_API_KEY`
- `PROPERTYDATA_API_KEY`
- `LOCRATING_EMAIL` / `LOCRATING_PASSWORD`
- `SITE_PASSWORD`
- `DATABASE_URL=file:/app/data/production.db`

## Troubleshooting

### Login not working
The auth cookie is set with the `Secure` flag, so it **only works over HTTPS**. Accessing via raw `http://89.167.62.131:3000` will not work.

### Check container logs
```bash
docker logs $(docker ps -q -f name=uk-property-analyzer) --tail 100
```

### Check Caddy logs
```bash
journalctl -u caddy -n 50 --no-pager
```

### Check if app is running
```bash
docker ps
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
```
