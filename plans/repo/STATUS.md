# Repo - Status

Stand: 18.11.2026

Repo ist Werkzeug, CI, Agent-Maschinerie und Monorepo-Infrastruktur. Die Arbeit läuft in der Builder-Warteschlange
(ADR 0355), die Zeilen stehen in [`plans/ethlete-studio/STATUS.md`](../ethlete-studio/STATUS.md). Hier stehen sie nicht
doppelt. Prozess-ADRs liegen vorerst in `apps/ethlete-studio/docs/adr/` (ein Repo-Ordner folgt mit B599).

## Offene Plan-Dateien

- [`moon-migration.md`](./moon-migration.md): moon als Nx-Ersatz mit eigenem Remote-Cache (Homelab), Trial auf dem Branch
  `chore/moon-trial`. Nichts davon gebaut; Nx Cloud bleibt aus (`NX_NO_CLOUD`).
- [`windows-test-pc.md`](./windows-test-pc.md): Windows-Testrechner `rack` für B480 (ADR 0258). Sondiert, nichts
  eingerichtet: SSH-Eintrag, WSL2, Toolchain offen.
