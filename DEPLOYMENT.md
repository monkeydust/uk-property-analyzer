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

> ⚠️ **Before SSHing: ask the user for the SSH password.** The server uses password authentication — SSH will hang silently without it. Do not attempt `ssh root@89.167.62.131` until you have the password confirmed from the user.

> 💡 **Alternative:** If `run_command` can't allocate a TTY (password prompt hangs), use the Node.js deploy script at `tmp/deploy.js` which uses the `ssh2` library for programmatic SSH: `node tmp/deploy.js` (from the project root). Update the password in the script before running.

SSH into the server:
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

> ⚠️ **Important:** The Docker named volume `uk-property-analyzer_sqlite_data` persists `/app/data/production.db` across container restarts. However, because we use `docker rm` to work around the docker-compose v1 bug, always explicitly restore the DB after creating a new container.

**Source of truth for the database is your local `prisma/dev.db`.**

```bash
# Step 1 (local machine): upload the current dev database
scp prisma/dev.db root@89.167.62.131:/opt/uk-property-analyzer/production.db

# Step 2 (on server): write it to both the volume and the running container
cp /opt/uk-property-analyzer/production.db /var/lib/docker/volumes/uk-property-analyzer_sqlite_data/_data/production.db
docker cp /opt/uk-property-analyzer/production.db $(docker ps -q -f name=uk-property-analyzer):/app/data/production.db

# Step 3 (on server): ensure the Node app can write to the database (and create journal files)
docker exec $(docker ps -q -f name=uk-property-analyzer) chown -R node:node /app/data
```

To check how many saved properties are in the DB on the server:
```bash
sqlite3 /var/lib/docker/volumes/uk-property-analyzer_sqlite_data/_data/production.db "SELECT COUNT(*) FROM SavedProperty;"
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
