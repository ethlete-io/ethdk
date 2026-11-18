# SDK - Status

Stand: 18.11.2026

Das SDK sind die veröffentlichten `@ethlete/*`-Bibliotheken unter `libs/`. Die Arbeit läuft in der Builder-Warteschlange
(ADR 0355), die Zeilen stehen in [`plans/ethlete-studio/STATUS.md`](../ethlete-studio/STATUS.md). Hier stehen sie nicht
doppelt. Es gibt keine eigene SDK-Warteschlange.

## Offene Plan-Dateien

- [`e2e-failure-triage.md`](./e2e-failure-triage.md): offen ist nur `et e2e slices` (Slice-Runner im `@ethlete/cli`).
  Reporter, Skill und Mod sind gebaut.
- [`fifagg-sdk-findings-2026-11-15-seo.md`](./fifagg-sdk-findings-2026-11-15-seo.md): zwei Befunde aus der SEO-Migration
  von fifagg (Titel-Priorität, Head-Store-Schreiben in `effect`), noch nicht gegen `next` geprüft.

## Verweise

Entscheidungen: [`apps/ethlete-studio/docs/adr/`](../../apps/ethlete-studio/docs/adr/), zuletzt 0359 (query v3),
0360 (Docs-Beispiele), 0361 (Farbe: Surface und Akzent). Docs: `apps/docs`.
