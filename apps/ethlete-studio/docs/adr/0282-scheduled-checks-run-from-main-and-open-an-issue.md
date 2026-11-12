---
status: accepted
open: B505
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning), finding 998
---

# Scheduled checks run from main and open an issue

The scheduled Rust audit never ran: GitHub starts a `schedule` trigger only from the default branch `main`, and
`rust-audit.yml` exists only on `next`. The doc agent asked: a small workflow on `main` that audits `next` daily, and
`et design status` shows a red result. The human answered (German, verbatim):

> Q4 – Ja zur Workflow-Datei auf main, aber nicht in et design status. […] spec-sweep.yml hat dasselbe Problem. […]
> Das sollte derselbe Commit auf main mit erledigen, statt später als eigener Befund aufzutauchen. Kein rotes Ergebnis
> in et design status. Bei ci: red in diesem Befehl darf der Builder keinen Feature-Slice starten. Eine neue Lücke in
> einer Timetrack-Abhängigkeit würde dann die ganze Studio-Arbeit anhalten, obwohl sie nichts mit ihr zu tun hat.
> Besser: Der tägliche Lauf legt ein GitHub-Issue an, und der Doc-Agent nennt es im Schichtbericht.

- One commit on `main` adds a small workflow that runs the Rust audit and the spec sweep on a schedule against `next`.
- A red scheduled run opens a GitHub issue. The doc agent names open issues in the shift report.
- `et design status` does not show the scheduled runs, so a new advisory does not stop Studio work.

## Follow-up: the audit leaves ci.yml

The doc agent asked whether the audit in `ci.yml` should block only a push that changes a Cargo file. The human
answered (German, verbatim): "Q6 – Ja, aber einfacher: den Audit ganz aus der normalen CI nehmen. […] Mein Vorschlag:
den Audit-Schritt aus ci.yml löschen. Übrig bleiben zwei klare Fälle: rust-audit.yml blockiert bei Cargo-Änderungen,
und der tägliche Lauf von main aus legt für neue Lücken ein Issue an." The doc agent checked: `rust-audit.yml` already
runs on a push to `next` that changes a `Cargo.lock` or `Cargo.toml` of either Tauri app (c6184dbb0).

- The `audit-rust` steps and the cargo-audit install leave `ci.yml`.
- `rust-audit.yml` keeps its push trigger on Cargo files; the scheduled run from `main` covers new advisories.
