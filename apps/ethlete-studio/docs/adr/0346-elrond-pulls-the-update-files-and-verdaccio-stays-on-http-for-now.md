---
status: accepted
open: B580
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), how the update files reach elrond (ADR 0345) and Verdaccio over HTTPS (ADR 0342)
---

# elrond pulls the update files, and Verdaccio stays on HTTP for now

elrond serves the update files (ADR 0345), but nothing from the internet can upload to it: SSH is LAN/VPN only, and
the only public path is Traefik's `extern` entrypoint (`https://<name>.local.elros.cc:12345`). Decided by the human:

1. elrond pulls. A small service on elrond polls the releases of the private `ethlete-io/ethdk` with a read-only token
   and copies `latest.json` and the installers into a public static folder behind Traefik. No new ingress opens. The
   Tauri bundles stay on GitHub-hosted runners and end as a GitHub release, as before. Rejected: an upload endpoint
   behind `extern` (a new ingress), and a LAN runner that uploads by SSH (one more runner to keep).
2. The SDK publishes to Verdaccio over plain HTTP (`http://78.46.42.73:54873`) for now, like fifa. HTTPS follows once
   Verdaccio has a hostname. This defers the doc agent's "Verdaccio moves to HTTPS" in ADR 0342.

The human: "q1ok q2erstmal ohne dann" (pull, recommended; Verdaccio without HTTPS for now).
