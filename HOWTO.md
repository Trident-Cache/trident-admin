# Trident Admin Dashboard - Installation Guide

## Prerequisites

- Node.js 18+ and npm
- Trident cache proxy running with admin API enabled
- nginx (or similar reverse proxy) for SSL termination and basic auth
- pm2 (process manager) - installed globally or via npx

## Security Warning

**The admin dashboard MUST be secured with HTTP Basic Authentication (or equivalent)
when exposed to the internet.** It provides full access to cache management operations
including purging, banning, and viewing request/response headers from your origin server.

Never expose the admin dashboard without authentication. Use nginx `auth_basic` or
your reverse proxy's equivalent.

## 1. Install the SDK

The admin dashboard depends on `@trident-cache/sdk`. Copy or symlink it to the server:

```bash
# Copy the SDK to the server
rsync -az integrations/js-library/ root@your-server:/opt/trident-sdk/

# Install SDK dependencies
ssh root@your-server "cd /opt/trident-sdk && npm install && npm run build"
```

## 2. Install the Admin Dashboard

```bash
# Copy the admin dashboard
rsync -az --exclude='.next' --exclude='node_modules' \
  integrations/nextjs-admin/ root@your-server:/opt/trident-admin/

# Point the SDK dependency to the server path
ssh root@your-server "cd /opt/trident-admin && \
  sed -i 's|\"file:../js-library\"|\"file:/opt/trident-sdk\"|' package.json"

# Install dependencies
ssh root@your-server "cd /opt/trident-admin && npm install"
```

## 3. Configure Environment

Create `/opt/trident-admin/.env.local`:

```env
# Trident admin API URL (must be accessible from the server)
TRIDENT_ADMIN_URL=http://127.0.0.1:9303

# Auth token matching your Trident config [admin] auth_token
TRIDENT_AUTH_TOKEN=your-secret-token

# Base path if serving under a subpath (e.g. /trident-admin)
NEXT_PUBLIC_BASE_PATH=/trident-admin
```

## 4. Configure next.config.js

If using a `basePath` (recommended), create/edit `/opt/trident-admin/next.config.js`:

```js
/** @type {import("next").NextConfig} */
const nextConfig = {
  basePath: "/trident-admin",
  output: "standalone",
  reactStrictMode: true,

  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        { key: "Surrogate-Control", value: "no-store" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
  ],
};

module.exports = nextConfig;
```

## 5. Build and Start with pm2

```bash
ssh root@your-server "cd /opt/trident-admin && \
  npm run build && \
  npx pm2 start npm --name trident-admin -- start && \
  npx pm2 save"
```

The dashboard runs on port 4001 by default.

## 6. Configure nginx with Basic Auth

**This step is critical for security.**

Create a password file:

```bash
# Install apache2-utils if needed
apt install -y apache2-utils

# Create password file (replace 'admin' and 'yourpassword')
htpasswd -cb /etc/nginx/.htpasswd-trident admin yourpassword
```

Create `/etc/nginx/snippets/trident-admin.conf`:

```nginx
# SSE (Server-Sent Events) endpoint - needs special proxy settings
location /trident-admin/api/events {
    auth_basic "Trident Admin";
    auth_basic_user_file /etc/nginx/.htpasswd-trident;

    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_read_timeout 86400s;
}

# Admin dashboard
location /trident-admin {
    auth_basic "Trident Admin";
    auth_basic_user_file /etc/nginx/.htpasswd-trident;

    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass 1;
    proxy_no_cache 1;
}
```

Include it in your site's server block:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # ... SSL config ...

    # Admin dashboard (must be BEFORE the main location / block)
    include /etc/nginx/snippets/trident-admin.conf;

    # IMPORTANT: Strip Authorization header for non-admin requests.
    # Basic auth credentials are sent by the browser on ALL requests
    # to the same domain, which would cause Trident to bypass caching.
    location / {
        proxy_pass http://127.0.0.1:8120;
        proxy_set_header Authorization "";
        # ... other proxy settings ...
    }
}
```

**Important:** The `proxy_set_header Authorization "";` line in the main `location /`
block is essential. Without it, browsers will send basic auth credentials on every
request to the domain (not just `/trident-admin`), which prevents Trident from caching
any responses.

Test and reload nginx:

```bash
nginx -t && systemctl reload nginx
```

## 7. Updating

To deploy updates:

```bash
rsync -az --delete \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='.env.local' \
  --exclude='next.config.js' \
  integrations/nextjs-admin/ root@your-server:/opt/trident-admin/

ssh root@your-server "cd /opt/trident-admin && \
  sed -i 's|\"file:../js-library\"|\"file:/opt/trident-sdk\"|' package.json && \
  npm install && npm run build && npx pm2 restart trident-admin"
```

Note: `.env.local` and `next.config.js` are excluded from rsync to preserve
server-specific configuration.

## Trident Admin API Configuration

Make sure your Trident config (`/etc/trident/config.toml`) has the admin API enabled:

```toml
[admin]
enabled = true
address = "127.0.0.1:9303"
auth_token = "your-secret-token"

# Increase timeout for SSE event streams (default: 30s is too low)
request_timeout = "24h"
```

## Docker Compose Setup

If you're running Trident via Docker, you can add the admin dashboard as a service.

**Important:** The Trident admin API must be enabled in your `config.toml`:

```toml
[admin]
enabled = true
address = "0.0.0.0:9303"          # bind to all interfaces inside the container
auth_token = "your-secret-token"
request_timeout = "24h"            # required for SSE event streams
```

Example `docker-compose.yml`:

```yaml
services:
  trident:
    image: docker.trident-cache.com/trident:latest
    ports:
      - "8120:8120"
      - "9303:9303"
    volumes:
      - ./config.toml:/etc/trident/config.toml:ro
      - ./license.key:/etc/trident/license.key:ro
    restart: unless-stopped

  trident-admin:
    build:
      context: ./integrations       # must include both js-library/ and nextjs-admin/
      dockerfile: nextjs-admin/Dockerfile
    ports:
      - "4001:4001"
    environment:
      - TRIDENT_ADMIN_URL=http://trident:9303
      - TRIDENT_AUTH_TOKEN=your-secret-token
      - NEXT_PUBLIC_BASE_PATH=/trident-admin
    depends_on:
      - trident
    restart: unless-stopped
```

With this setup:
- Trident runs on ports 8120 (cache proxy) and 9303 (admin API)
- The admin dashboard connects to Trident via the Docker network (`http://trident:9303`)
- You still need nginx or a reverse proxy in front for SSL and basic auth (see step 6)

**Common issue:** If `curl http://localhost:9303` returns "Connection reset by peer",
the admin API is not enabled in your `config.toml`. Add the `[admin]` section above
and restart Trident.

## Architecture

```
Browser → nginx:443 (SSL + Basic Auth) → Next.js:4001 → Trident Admin API:9303
                                              ↓
                                    SSE proxy for events
```

- The admin dashboard runs as a Next.js server on port 4001
- All Trident API calls are made server-side (SSR) - the browser never talks to Trident directly
- SSE (Server-Sent Events) for real-time events are proxied through a Next.js API route
- nginx handles SSL termination and basic authentication
