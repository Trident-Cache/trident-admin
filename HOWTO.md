# Trident Admin Dashboard - Installation Guide

## Prerequisites

- Node.js 18+ and npm
- Trident cache proxy running with admin API enabled
- nginx (or similar reverse proxy) for SSL termination and basic auth
- pm2 (process manager) - installed globally or via npx

## Security Warning

**The admin dashboard MUST be protected by a login when anyone but you can reach it.**
It provides full access to cache management operations including purging, banning,
and viewing request/response headers from your origin server.

The dashboard has a login of its own, which is **off until you set
`TRIDENT_PANEL_PASSWORD`** (step 3). While it is off, the dashboard logs a warning
at start and shows a red banner on every screen. Either turn it on, or protect the
dashboard with nginx `auth_basic` or your reverse proxy's equivalent (step 6), or
both. Never expose it with neither.

Whatever you choose, serve it over HTTPS: the session cookie and any Basic
Authentication credentials must not travel in clear text.

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

# The dashboard's own login. Off while unset. At least 12 characters and not
# built from common words (password, admin, changeme, trident, ...), or the
# dashboard refuses to start -- as it does with this placeholder until you
# replace it.
TRIDENT_PANEL_PASSWORD=changeme

# Key that signs session cookies, 32 characters or more (openssl rand -base64 48).
# Unset, a random key is made at each start and sessions end on every restart.
TRIDENT_PANEL_SESSION_SECRET=

# How long a sign-in lasts, in hours (default 12).
# TRIDENT_PANEL_SESSION_HOURS=12

# Hosts the sitemap warmer may fetch although they resolve to internal
# addresses (comma-separated, exact names). Empty: public addresses only.
# TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS=shop.internal
```

With `TRIDENT_PANEL_PASSWORD` set, every page asks for the password first and
every API call without a session is answered with `401`. Ten wrong passwords
from one address within five minutes block that address for the rest of the
five minutes. **Sign out** is in the top bar. See `README.md`, "Login", for the
details.

The sitemap warmer (`POST /api/warmer/sitemap`) only fetches from hosts whose
every address is public, and checks each redirect again. If you warm from a
sitemap on an internal host, the request fails with a message naming the host:
add that host to `TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS` and restart the dashboard.

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

**This step is critical for security** unless the dashboard's own login is on
(step 3). With the login on, Basic Auth is optional: it adds per-user accounts
in front of the shared password. Either way nginx terminates TLS, and it must
pass the original `Host` header and `X-Forwarded-Proto`, as below: the dashboard
uses them to recognise its own pages (it refuses state-changing requests that a
browser marks as coming from another site) and to mark the session cookie
`Secure`. `X-Forwarded-For` is what the sign-in rate limit counts by.

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
      - "127.0.0.1:4001:4001"         # this host only — nginx (step 6) is the public entry
    environment:
      - HOSTNAME=0.0.0.0              # listen on the compose network (the image default)
      - TRIDENT_ADMIN_URL=http://trident:9303
      - TRIDENT_AUTH_TOKEN=your-secret-token
      - NEXT_PUBLIC_BASE_PATH=/trident-admin
      - TRIDENT_PANEL_PASSWORD=changeme            # replace; refused as it is
      - TRIDENT_PANEL_SESSION_SECRET=              # optional: 32+ random characters
    depends_on:
      - trident
    restart: unless-stopped
```

For a container health check, probe `/api/live` (here
`http://127.0.0.1:4001/trident-admin/api/live`). It answers without a session
and reports nothing but that the dashboard process is up.

With this setup:
- Trident runs on ports 8120 (cache proxy) and 9303 (admin API)
- The admin dashboard connects to Trident via the Docker network (`http://trident:9303`)
- You still need nginx or a reverse proxy in front for SSL, and for basic auth
  if you leave the dashboard's own login off (see step 6)
- Without `TRIDENT_PANEL_PASSWORD` the dashboard has no login — anyone who can
  reach port 4001 can purge the cache. `127.0.0.1:4001:4001` publishes it to
  this host's loopback only, where the reverse proxy picks it up. Do not publish
  it as a bare `4001:4001`, which listens on every interface of the host.

**Common issue:** If `curl http://localhost:9303` returns "Connection reset by peer",
the admin API is not enabled in your `config.toml`. Add the `[admin]` section above
and restart Trident.

## Architecture

```
Browser → nginx:443 (SSL, optional Basic Auth) → Next.js:4001 (login) → Trident Admin API:9303
                                                       ↓
                                             SSE proxy for events
```

- The admin dashboard runs as a Next.js server on port 4001
- All Trident API calls are made server-side (SSR) - the browser never talks to Trident directly
- SSE (Server-Sent Events) for real-time events are proxied through a Next.js API route.
  The dashboard holds one upstream stream per kind of event and shares it between
  all open tabs, so tabs do not use up Trident's per-address connection limit
- nginx handles SSL termination, and basic authentication when you use it
