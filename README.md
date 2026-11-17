# Trident Admin 1.8.1

The web admin panel for the [Trident HTTP cache](https://trident-cache.com):
cache statistics, purge (URL, tag, pattern, host, vary), cached entries and tags,
coverage, warmer, launch and reflect modes, denoisers, bans, backends, DNS
discovery, configuration and live events — over Trident's admin API.

## Run with Docker

```bash
docker run -d --name trident-admin \
  -p 127.0.0.1:4001:4001 \
  -e TRIDENT_ADMIN_URL=http://trident:9301 \
  -e TRIDENT_AUTH_TOKEN=... \
  docker.trident-cache.com/trident-admin:1.8.1
```

The panel has no login of its own: anyone who can reach its port can purge the
cache. `-p 127.0.0.1:4001:4001` publishes it to this host's loopback only. Never
publish it on a public interface (a bare `-p 4001:4001` does).

Serve it under a sub-path by building with
`--build-arg NEXT_PUBLIC_BASE_PATH=/trident-admin`. Put it behind
authentication — see `HOWTO.md` and the nginx snippet in `nginx/`.

## Environment

| Variable | Purpose |
|---|---|
| `TRIDENT_ADMIN_URL` | Trident admin API, e.g. `http://127.0.0.1:9301` |
| `TRIDENT_AUTH_TOKEN` | Trident admin bearer token (`[admin] auth_token`) |
| `TRIDENT_METRICS_URL`, `TRIDENT_METRICS_PATH`, `TRIDENT_METRICS_STATS_PATH`, `TRIDENT_METRICS_TOKEN` | Trident metrics endpoint, if not on the admin API |
| `HOSTNAME` | listen address inside the container; default `0.0.0.0` |
| `NEXT_PUBLIC_BASE_PATH` | build-time sub-path (build argument) |
| `NEXT_PUBLIC_TRIDENT_ENV` | label shown in the header |

## Build from source

```bash
(cd sdk && npm ci && npm run build)
npm ci && npm run build && npm start   # port 4001
```

## Versioning

Versions follow Trident: the admin 1.8.x works with Trident 1.8. MAJOR.MINOR moves
with the engine (every Trident X.Y.0 release is also a release of this package,
changed or not); the PATCH number is this package's own. The
admin screens warn when a connected Trident runs another release line.

## This repository is a mirror

Trident Admin is developed in the Trident repository and published here with
each Trident release; every commit is a release snapshot, and the tags are the
Trident versions it ships with. **Please open issues here** — pull requests
against this repository cannot be merged, because the next release would
overwrite them.

## License

MIT — see [`LICENSE`](LICENSE). The bundled SDK in `sdk/` is MIT as well
(`sdk/LICENSE`).
