---
'@ethlete/cli': patch
'ethlete-studio': none
---

The Tailwind class facts cache is keyed by the checkout's files, not its path, honours `ETHLETE_DESIGN_CLASS_FACTS_DIR`, and runs one Tailwind per entry across processes; the Studio e2e workers share one per-run dir.
