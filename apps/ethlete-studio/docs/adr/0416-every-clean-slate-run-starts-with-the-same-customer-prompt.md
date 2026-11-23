---
status: accepted
open: B662
decided: 2026-11-23
source: doc-agent session 2026-11-23, before the second tomflix run
---

# Every clean-slate run starts with the same customer prompt

The human: "ich denke zum testen sollten wir stehts den gleichen prompt nutzen zum starten um es.. naja zumindest etwas
vergleichbar zu halten".

Every tomflix clean-slate run (ADR 0399) starts with this text as its first message, word for word:

```
Hallo! Ich möchte eine App für meine private Filmsammlung, sie heißt Tomflix. Ich will meine Filme durchstöbern, nach Titel suchen und zu jedem Film eine Seite mit Bild, Handlung, Jahr und Besetzung sehen. Ich will mich anmelden können, damit nur ich und meine Familie reinkommen. Am liebsten soll sie sich wie ein gemütlicher Kinoabend anfühlen. Kannst du mir das gestalten? Ich bin kein Techniker, frag mich also bitte nur Dinge, die ich als Kunde beantworten kann.
```

After it, the human answers freely as the customer. A run with another first message is a new test, not a comparison
run. The text lives only here, never in the copy, so the agent cannot read it before the run.
