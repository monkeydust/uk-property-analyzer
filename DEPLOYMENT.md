# Deployment Guide for Hetzner

This guide outlines the simplest and most robust way to deploy the UK Property Analyzer to a Hetzner Cloud VPS using **Docker** and **Docker Compose**. Since this application uses Playwright (requiring Chromium dependencies) and a local SQLite database, a Dockerized environment is highly recommended to keep the dependencies isolated and the database persistent.

## Prerequisites
1. A Hetzner Cloud account (and a newly created project).
2. A server instance (e.g. **CX22** or **CPX21** running **Ubuntu 22.04 or 24.04** is recommended).
3. SSH access to your new server.
4. A root domain or subdomain pointed to the server's IP address if you plan on serving traffic directly (optional but recommended for HTTPS).

## Step 1: Prepare the Server
Connect to your Hetzner VPS via SSH:
```bash
ssh root@<your_hetzner_ip>
```

Install Docker and Docker Compose on the Ubuntu server:
```bash
# Update packages
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose (if not included)
apt-get install docker-compose-plugin -y
```

## Step 2: Push Your Code
You can transfer your code to the server by cloning your Git repository, or using `scp`/`rsync`. 

```bash
# Clone the repo inside the /opt directory (or another folder of your choice)
cd /opt
git clone <your-repo-url> uk-property-analyzer
cd uk-property-analyzer
```

## Step 3: Configure Environment Variables
Copy the local environment template and configure your production keys:
```bash
cp .env .env.prod
nano .env.prod
```

Inside `.env.prod`, make sure you provide all REQUIRED keys, particularly:
```
GOOGLE_MAPS_API_KEY=...
OPENROUTER_API_KEY=...
PROPERTYDATA_API_KEY=...
LOCRATING_EMAIL=...
LOCRATING_PASSWORD=...
# Plus any Auth keys if you are using them
```

## Step 4: Build and Deploy using Docker Compose
The repository comes equipped with a `Dockerfile` and `docker-compose.yml` specifically configured for this stack (NextJS + Playwright + SQLite Prisma). Make sure to specify the `.env.prod` file when starting.

```bash
# Build the images and start the container in detached mode
docker compose --env-file .env.prod up -d --build
```

### What happens in the background?
1. The `Dockerfile` pulls `node:20-bookworm`, installs Node dependencies, and downloads Playwright System dependencies necessary for Chrome scraping.
2. It compiles the Next.js application for production.
3. Automatically sets up a persistent Docker Volume `sqlite_data` (mapped in `docker-compose.yml`) ensuring your `production.db` doesn't get wiped upon restarts.
4. On startup, Prisma automatically syncs/pushes any new schema rules to your database.

You can check the application logs at any time to verify a successful startup:
```bash
docker compose logs -f
```

## Step 5: (Optional) Set up Reverse Proxy with Nginx & Let's Encrypt
Right now, the app is running on port `3000`. To make it accessible via standard HTTP/HTTPS (`80/443`), you can install Caddy or Nginx. 

### Quick Caddy Setup (Recommended for effortless HTTPS)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy -y
```

Then, configure the Caddyfile to point your Domain to Port 3000:
```bash
nano /etc/caddy/Caddyfile
```
Add:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```
And finally, restart Caddy:
```bash
systemctl restart caddy
```
Your application should now securely run with Let's Encrypt automated certificates at `https://your-domain.com`.

## Updating Your Application Later
Whenever you push new code to your remote repository, pull it down to the Hetzner server and rebuild:
```bash
cd /opt/uk-property-analyzer
git pull
docker compose --env-file .env.prod up -d --build
```
