# QZD MVP Single-Server Deployment Guide

## 1. Overview & Diagram
This guide describes how to deploy the entire QZD MVP stack behind a single fully-qualified domain name (FQDN) on an Ubuntu 22.04 LTS server using Docker Compose and Nginx for path-based routing.

```
Internet
   │
   ▼
┌──────────────┐      443/tcp       ┌───────────────────────────────────────────┐
│   Clients    │  ───────────────▶  │              Nginx Reverse Proxy          │
└──────────────┘                    │  /api     →   api:8080 (NestJS)           │
                                     │  /wallet  →   wallet:8080 (React SPA)     │
                                     │  /admin   →   admin:8080 (React SPA)      │
                                     │  /pos     →   pos:8080 (React SPA)        │
                                     │  /docs    →   docs:8088 (Redoc static)    │
                                     │  /mock    →   mock:4010 (Prism, optional) │
                                     │  /metrics →   prometheus:9090 (restricted)│
                                     │
                                     │      Internal Docker network             │
                                     └───────────────────────────────────────────┘
                                                     │         │
                                                     ▼         ▼
                                               postgres   grafana
```

## 2. Prerequisites
1. **Server sizing**
   - Ubuntu 22.04 LTS (amd64) with at least 4 vCPU, 8 GB RAM, and 80 GB SSD.
   - Root or sudo user with SSH access.
2. **DNS**
   - Create `A` (and `AAAA` if using IPv6) records pointing `qzd.example.com` to the server's IP addresses.
3. **Firewall (ufw)**
   ```sh
   sudo apt update
   sudo apt install -y ufw
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp comment "SSH"
   sudo ufw allow 80/tcp comment "HTTP"
   sudo ufw allow 443/tcp comment "HTTPS"
   sudo ufw enable
   sudo ufw status verbose
   ```
4. **Packages**
   ```sh
   sudo apt update
   sudo apt install -y ca-certificates curl gnupg lsb-release software-properties-common
   ```
5. **Docker Engine & Docker Compose**
   ```sh
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg
   echo "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo usermod -aG docker $USER
   newgrp docker
   docker compose version
   ```
6. **Authenticate with GitHub Container Registry (GHCR)**
   ```sh
   echo "<github-token>" | docker login ghcr.io -u <github-org-or-user> --password-stdin
   ```
   Replace `<github-token>` with a fine-grained personal access token or GitHub CLI token that has the `read:packages` scope.

7. **Node.js (optional, for local builds)**
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version
   ```
8. **Nginx** (used only for initial ACME challenges if webroot mode is required; main proxy runs in Docker)
   ```sh
   sudo apt install -y nginx
   sudo systemctl disable --now nginx
   ```

## 3. Directory Layout
Create the deployment directory tree:

```sh
sudo mkdir -p /opt/qzd/{env,compose,nginx,certbot,data/postgres,data/prometheus,data/grafana,site}
sudo chown -R $USER:$USER /opt/qzd
``` 

Resulting structure:
```
/opt/qzd/
  env/           # .env files
  compose/       # docker-compose.yml and overrides
  nginx/         # nginx.conf + snippets
  certbot/       # ACME webroot (if using webroot)
  data/          # volumes (postgres, prometheus, grafana)
  site/          # openapi/site (static docs)
```

Copy the contents of `openapi/site` from the repository into `/opt/qzd/site` when preparing static docs.

## 4. Environment Variables (`/opt/qzd/env/.env`)
Create the environment file:

```sh
cat <<'ENVEOF' > /opt/qzd/env/.env
DOMAIN=qzd.example.com
API_PORT=8080
WALLET_PORT=8081
ADMIN_PORT=8082
POS_PORT=8083
DOCS_PORT=8088
PRISM_PORT=4010
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
POSTGRES_DB=qzd
POSTGRES_USER=qzd
POSTGRES_PASSWORD=super-secure-password
JWT_SECRET=replace-with-64byte-secret
OAS_BASE_URL=https://qzd.example.com/api
REDOC_BASE_PATH=/docs
ENV=production
ENVEOF
```

Add additional secrets (OAuth, SMTP, etc.) as needed.

## 5. Docker Compose (`/opt/qzd/compose/docker-compose.yml`)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - ../data/postgres:/var/lib/postgresql/data
    networks:
      - qzd

  api:
    image: ghcr.io/<github-org-or-user>/qzd-api:latest
    restart: unless-stopped
    env_file:
      - ../env/.env
    environment:
      NODE_ENV: production
      PORT: ${API_PORT}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${API_PORT}/health/ready"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  wallet:
    image: ghcr.io/<github-org-or-user>/qzd-wallet-web:latest
    restart: unless-stopped
    environment:
      PORT: 8080
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  admin:
    image: ghcr.io/<github-org-or-user>/qzd-admin-web:latest
    restart: unless-stopped
    environment:
      PORT: 8080
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  pos:
    image: ghcr.io/<github-org-or-user>/qzd-merchant-pos:latest
    restart: unless-stopped
    environment:
      PORT: 8080
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  docs:
    image: caddy:2-alpine
    restart: unless-stopped
    environment:
      SITE_ADDRESS: ":${DOCS_PORT}"
    volumes:
      - ../site:/srv
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${DOCS_PORT}/"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  mock:
    image: stoplight/prism:4
    restart: unless-stopped
    command: >-
      mock --host 0.0.0.0 --port ${PRISM_PORT} ./openapi.yaml
    volumes:
      - ../../openapi:/tmp/openapi:ro
    working_dir: /tmp/openapi
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${PRISM_PORT}/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd
    profiles: ["dev"]

  prometheus:
    image: prom/prometheus:v2.49.0
    restart: unless-stopped
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ../data/prometheus:/prometheus
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:9090/-/healthy"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

  grafana:
    image: grafana/grafana:10.2.0
    restart: unless-stopped
    environment:
      GF_SERVER_ROOT_URL: https://${DOMAIN}/grafana/
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: change-me
    volumes:
      - ../data/grafana:/var/lib/grafana
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - qzd

networks:
  qzd:
    driver: bridge
```

> **Note:** Replace `<github-org-or-user>` with your GitHub organization or username. Release pipelines described below publish each deployable image to GitHub Container Registry (GHCR) with the tag that triggered the workflow (for example, `ghcr.io/example/qzd-api:v1.4.0`) and update the `latest` tag. Wallet/admin/pos containers should serve production builds via Nginx using port 8080 internally.

### 5.1 Automated image publishing

This repository ships with a GitHub Actions workflow that builds and pushes the API, SPA, and simulator containers to GHCR every time a new Git tag is created (for example, `v1.4.0`). After pushing a tag to GitHub:

1. The workflow logs into GHCR using the repository's `GITHUB_TOKEN` with `packages: write` scope.
2. Each application Dockerfile (`apps/api`, `apps/wallet-web`, `apps/admin-web`, `apps/merchant-pos`, and `apps/sms-sim`) is built with Docker Buildx.
3. Two tags are published per image:
   - `ghcr.io/<github-org-or-user>/qzd-<component>:<tag>`
   - `ghcr.io/<github-org-or-user>/qzd-<component>:latest`

Once the workflow succeeds, update the Compose file to reference the matching tag (for example, `qzd-api:v1.4.0`) instead of `latest` for deterministic rollouts.

## 6. Nginx Reverse Proxy (`/opt/qzd/nginx/nginx.conf`)

```nginx
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
  worker_connections  4096;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  sendfile        on;
  tcp_nopush      on;
  tcp_nodelay     on;
  keepalive_timeout  65;
  types_hash_max_size 4096;

  map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
  }

  gzip on;
  gzip_comp_level 5;
  gzip_min_length 256;
  gzip_vary on;
  gzip_types text/plain text/css application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

  brotli on;
  brotli_comp_level 5;
  brotli_types text/plain text/css application/javascript application/json application/xml image/svg+xml;

  server_tokens off;

  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent" "$http_x_forwarded_for"';

  access_log  /var/log/nginx/access.log  main;

  upstream api_upstream { server api:${API_PORT}; }
  upstream wallet_upstream { server wallet:8080; }
  upstream admin_upstream { server admin:8080; }
  upstream pos_upstream { server pos:8080; }
  upstream docs_upstream { server docs:${DOCS_PORT}; }
  upstream mock_upstream { server mock:${PRISM_PORT}; }
  upstream prometheus_upstream { server prometheus:9090; }

  server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location ^~ /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }

    location / {
      return 301 https://$host$request_uri;
    }
  }

  server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header X-XSS-Protection "1; mode=block" always;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/ {
      proxy_pass http://api_upstream/;
      proxy_set_header X-Forwarded-Prefix /api;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }

    location /wallet/ {
      proxy_pass http://wallet_upstream/;
      proxy_set_header X-Forwarded-Prefix /wallet;
      proxy_intercept_errors on;
      error_page 404 = @wallet_spa;
    }

    location @wallet_spa {
      proxy_pass http://wallet_upstream/index.html;
    }

    location /admin/ {
      proxy_pass http://admin_upstream/;
      proxy_set_header X-Forwarded-Prefix /admin;
      proxy_intercept_errors on;
      error_page 404 = @admin_spa;
    }

    location @admin_spa {
      proxy_pass http://admin_upstream/index.html;
    }

    location /pos/ {
      proxy_pass http://pos_upstream/;
      proxy_set_header X-Forwarded-Prefix /pos;
      proxy_intercept_errors on;
      error_page 404 = @pos_spa;
    }

    location @pos_spa {
      proxy_pass http://pos_upstream/index.html;
    }

    location /docs/ {
      proxy_pass http://docs_upstream/;
    }

    location /mock/ {
      allow 10.0.0.0/8;
      allow 192.168.0.0/16;
      deny all;
      proxy_pass http://mock_upstream/;
    }

    location = /metrics {
      allow 127.0.0.1;
      deny all;
      proxy_pass http://prometheus_upstream/metrics;
    }

    location /grafana/ {
      proxy_pass http://grafana:3000/;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Host $host;
      proxy_set_header X-Forwarded-Prefix /grafana;
    }

    location /healthz {
      access_log off;
      return 200 'ok';
    }

    location / {
      return 308 https://$host/wallet/;
    }
  }
}
```

Mount `/var/www/certbot` to `/opt/qzd/certbot` via Docker volume mapping described later.

## 7. TLS with Let’s Encrypt
1. Create webroot directory:
   ```sh
   sudo mkdir -p /opt/qzd/certbot
   sudo chown -R www-data:www-data /opt/qzd/certbot
   ```
2. Obtain certificate:
   ```sh
   sudo certbot certonly --webroot -w /opt/qzd/certbot -d qzd.example.com --email ops@example.com --agree-tos --no-eff-email
   ```
3. Symlink Nginx SSL options (if not already):
   ```sh
   sudo ln -sf /opt/qzd/certbot /var/www/certbot
   ```
4. Auto-renewal is configured via systemd timer by default. Verify:
   ```sh
   sudo systemctl list-timers | grep certbot
   sudo certbot renew --dry-run
   ```

## 8. Build & Publish Images
### API (`apps/api/Dockerfile`)
```Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm --filter @qzd/api build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
RUN npm install -g pnpm && pnpm install --prod
ENV NODE_ENV=production PORT=8080
CMD ["node", "dist/main.js"]
```

### SPAs (`apps/wallet-web/Dockerfile`, similar for admin & pos)
```Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm --filter @qzd/wallet-web build

FROM nginx:1.25-alpine
COPY --from=builder /app/apps/wallet-web/dist /usr/share/nginx/html
COPY apps/wallet-web/nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK CMD curl -f http://localhost/healthz || exit 1
```

`apps/wallet-web/nginx.conf` should expose `/healthz` and `try_files $uri /index.html;`. Repeat for admin and pos.

### Tagging & Publishing
- Tag images with both `:gitsha` and `:latest` and push to `registry.example.com/qzd/*`.
- **CI build (recommended):**
  ```sh
  docker buildx build --push --platform linux/amd64 -t registry.example.com/qzd/api:$(git rev-parse --short HEAD) -t registry.example.com/qzd/api:latest -f apps/api/Dockerfile .
  docker buildx build --push --platform linux/amd64 -t registry.example.com/qzd/wallet-web:$(git rev-parse --short HEAD) -t registry.example.com/qzd/wallet-web:latest -f apps/wallet-web/Dockerfile .
  # Repeat for admin-web and merchant-pos
  ```
- **On-server build (fallback):**
  ```sh
  cd /opt/qzd/src/qzd-mvp
  docker build -t registry.example.com/qzd/api:latest -f apps/api/Dockerfile .
  docker build -t registry.example.com/qzd/wallet-web:latest -f apps/wallet-web/Dockerfile .
  ```

## 9. Deploy Steps
```sh
cd /opt/qzd/compose
docker compose --env-file ../env/.env --profile prod pull
docker compose --env-file ../env/.env --profile prod up -d
docker compose --env-file ../env/.env ps
```

- Run database migrations:
  ```sh
  docker compose --env-file ../env/.env exec api pnpm --filter @qzd/api prisma migrate deploy
  ```
- Verify health checks through Nginx:
  ```sh
  curl -I https://qzd.example.com/api/health/ready
  curl -I https://qzd.example.com/wallet/healthz
  curl -I https://qzd.example.com/admin/healthz
  curl -I https://qzd.example.com/pos/healthz
  ```

Zero downtime is achieved because `docker compose up -d` recreates containers without stopping healthy ones until replacements are ready.

## 10. Security & Hardening
- **Firewall:** Already configured via `ufw`.
- **Fail2ban for Nginx:**
  ```sh
  sudo apt install -y fail2ban
  sudo tee /etc/fail2ban/jail.d/nginx-qzd.conf > /dev/null <<'JAIL'
  [nginx-http-auth]
  enabled = true
  filter  = nginx-http-auth
  port    = http,https
  logpath = /var/log/nginx/error.log
  bantime = 3600

  [nginx-limit-req]
  enabled = true
  filter  = nginx-limit-req
  port    = http,https
  logpath = /var/log/nginx/error.log
  bantime = 3600
  JAIL
  sudo systemctl restart fail2ban
  sudo fail2ban-client status
  ```
- **Rate limiting (`/opt/qzd/nginx/limit.conf`):**
  ```nginx
  limit_req_zone $binary_remote_addr zone=api_ratelimit:10m rate=10r/s;
  ```
  Include in `http {}` and apply:
  ```nginx
  location /api/ {
    limit_req zone=api_ratelimit burst=20 nodelay;
    proxy_pass http://api_upstream/;
    # ...
  }
  ```
- **CORS:** Configure the API to allow `https://qzd.example.com` and optional dev origins (`http://localhost:5173`).

## 11. Monitoring & Logs
- Prometheus scrapes API metrics via `/api/metrics` proxied internally.
- Grafana dashboards: import JSON dashboards and secure admin password.
- Docker log rotation (`/etc/docker/daemon.json`):
  ```sh
  sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "5"
    }
  }
  JSON
  sudo systemctl restart docker
  ```
- For systemd-managed Docker Compose (optional) check logs with `journalctl -u docker`.

## 12. Backups & Recovery
- **Postgres dump:**
  ```sh
  docker compose --env-file ../env/.env exec postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > /opt/qzd/backups/qzd-$(date +%F).sql
  ```
- **Restore:**
  ```sh
  cat /opt/qzd/backups/qzd-2024-01-01.sql | docker compose --env-file ../env/.env exec -T postgres psql -U ${POSTGRES_USER} ${POSTGRES_DB}
  ```
- Schedule cron jobs or use snapshotting of the `/opt/qzd/data/postgres` volume.

## 13. SPA Routing Notes
Ensure SPA containers include:
```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  location / {
    try_files $uri /index.html;
  }
  location = /healthz {
    access_log off;
    add_header Content-Type text/plain;
    return 200 'ok';
  }
}
```
This guarantees deep links like `/wallet/activity` resolve correctly.

## 14. CI/CD Appendix
Example GitHub Actions workflow (`.github/workflows/deploy.yml`):
```yaml
name: Deploy QZD MVP

on:
  push:
    branches: ["main"]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Log in to registry
        uses: docker/login-action@v3
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      - name: Build & push images
        run: |
          docker buildx build --push --platform linux/amd64 \
            -t registry.example.com/qzd/api:${{ github.sha }} \
            -t registry.example.com/qzd/api:latest -f apps/api/Dockerfile .
          docker buildx build --push --platform linux/amd64 \
            -t registry.example.com/qzd/wallet-web:${{ github.sha }} \
            -t registry.example.com/qzd/wallet-web:latest -f apps/wallet-web/Dockerfile .
          docker buildx build --push --platform linux/amd64 \
            -t registry.example.com/qzd/admin-web:${{ github.sha }} \
            -t registry.example.com/qzd/admin-web:latest -f apps/admin-web/Dockerfile .
          docker buildx build --push --platform linux/amd64 \
            -t registry.example.com/qzd/merchant-pos:${{ github.sha }} \
            -t registry.example.com/qzd/merchant-pos:latest -f apps/merchant-pos/Dockerfile .
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/qzd/compose
            docker compose --env-file ../env/.env --profile prod pull
            docker compose --env-file ../env/.env --profile prod up -d
```

## 15. Appendix: Full Config Files
### `docker-compose.yml`
Refer to Section 5 for the complete file.

### `nginx.conf`
Refer to Section 6 for the complete file.

### `prometheus.yml` (`/opt/qzd/compose/prometheus.yml`)
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    metrics_path: /metrics
    scheme: http
    static_configs:
      - targets: ['api:${API_PORT}']
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Sample `.env`
Provided in Section 4.

---

Follow these steps to maintain a secure, observable, and reliable single-server deployment of the QZD MVP stack.
