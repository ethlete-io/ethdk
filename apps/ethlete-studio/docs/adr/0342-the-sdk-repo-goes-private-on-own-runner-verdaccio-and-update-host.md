---
status: accepted
open: B580
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), the human on making the SDK repo private; supersedes ADR 0289
---

# The SDK repo goes private, on our own runner, Verdaccio and update host

The human asked to make `ethlete-io/ethdk` private. Three things depend on it being public: the Tauri updater endpoints
of timetrack-app and ethlete-studio are GitHub release downloads, private repos get 2000 free Actions minutes on the
free org plan (macOS counts 10x, Windows 2x), and npm provenance needs a public repo. The human answered (German,
verbatim):

> wir bauen um auf eigene runner dann + verdaccio + irgendwie ne lösung für die update files

> q1 unser self hosted verdaccio. fifa und co nutzen es eh schon für font awesome q2 falls sichtbar siehe ethlere
> producer. es nutzt bereits einen eigenen runner q3 ist erstmal ok. irgendwann werden wir hier lizensierung brauchen
> q4b

Decided, confirmed by the human as a summary:

1. `ethlete-io/ethdk` becomes private.
2. Every `@ethlete/*` package publishes only to the self-hosted Verdaccio that already serves `@fortawesome` and
   `@ethlete-producer`. npmjs gets no new versions; its existing versions are deprecated with a pointer.
3. Linux CI runs on the org's self-hosted runner `runner-ethlete` (Linux X64, docker, group Default). ADR 0289 is
   superseded: its reason was fork pull requests on a public repo.
4. The Tauri bundles (macOS arm/intel, Windows, Linux) stay on GitHub-hosted runners. The minutes of the first releases
   are measured, then decided again.
5. Updater files and installers move to our own server, over HTTPS, readable without login. Licensing comes later.
6. The two old public forks stay.

Technical, set by the doc agent: Verdaccio moves to HTTPS (today plain HTTP on an IP, the token travels in clear text);
several runner instances on the runner host, with the CI time measured; the switch to private happens only after one
release went through runner, Verdaccio and the new update host.
