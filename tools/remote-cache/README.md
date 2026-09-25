# moon remote cache

Self-hosted [`bazel-remote`](https://github.com/buchgr/bazel-remote) on Hetzner, shared by all
moon repos. Lives here for lack of an infra repo; it is not sdk-specific.

## Server

```bash
sudo mkdir -p /srv/moon-cache && sudo chown 1000:1000 /srv/moon-cache
docker compose -f tools/remote-cache/docker-compose.yml up -d
curl -s localhost:8080/status
```

Small shared-vCPU instance is enough (arm64 works). For more than 50 GiB, attach a Cloud Volume
and set `MOON_CACHE_DIR` / `MOON_CACHE_MAX_SIZE` in a `.env` beside the compose file. No backups -
the cache is disposable. Eviction is LRU, so nothing to prune.

## Per repo

`.moon/workspace.yml`:

```yaml
remote:
  api: 'grpc'
  cache:
    compression: 'zstd'
    instanceName: '<repo-name>'
    localReadOnly: true
```

CI:

```yaml
env:
  MOON_REMOTE_HOST: 'grpc://10.0.0.2:9092'
```

`host` stays out of the file so remote caching is CI-only. That's the whole onboarding.

## Access

Port `9092` has no auth, and `instanceName` isolates storage but is not a security boundary.

- **Self-hosted runners on Hetzner** - same private network, use the `10.x` address. No TLS, no
  auth, no egress cost.
- **GitHub-hosted runners** - can't join a Hetzner network, so you need Tailscale
  (`tailscale/github-action`) or mTLS (`remote.mtls` + `--tls_ca_file`). An IP allowlist doesn't
  work; GitHub's ranges are too broad.

Cloud Firewall in front either way.

## Gotchas

- `--storage_mode` must match `remote.cache.compression`. Changing either invalidates every
  repo's blobs.
- `--max_size` is one shared LRU pool - a busy repo evicts a quiet one. Size for the sum.
- Nx repos can't use this; Nx doesn't speak the Bazel REAPI.

## Verify

```bash
export MOON_REMOTE_HOST='grpc://10.0.0.2:9092'
CI=true npx moon run types:build --force    # localReadOnly only uploads from CI
rm -rf .moon/cache/outputs .moon/cache/hashes
npx moon run types:build                     # should be instant
```

Nothing happening? `MOON_LOG=debug` and grep for `remote`.
