---
status: accepted
built: d679f5cec
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning); proposal of the analysis session claude2
---

# The agent skills name closed groups as the output

Both agent skills still said that the tool fixes are the main output and that no defect is done with only its fix. The
human: "Solange das dort steht, widersprechen die neuen Regeln dem Auftrag, und der Auftrag gewinnt meistens." The doc
agent proposed to drop "unless it blocks the row" from the builder text. The human kept it, narrowed: "Ein Fehler, der
vorher da war, wird nur repariert, wenn der Beweis der laufenden Zeile ohne ihn nicht grün werden kann. Der Builder
nennt das im Bericht in einem Satz. Die Reparatur gehört zum Slice und bekommt keine Nummer."

- The doc-agent and builder-agent skills name the output as a finished Studio and closed rebuild rows with a green
  proof. The question "why did the tool not catch it" is gone; the question is which group owns a defect and what would
  make it impossible.
- A revealed defect is fixed only when the proof of the current row cannot turn green without it; the builder says so
  in one sentence; the fix belongs to the slice and gets no number.
- A new check rule, cache, lock, hook or gate is never the default fix; a fix that adds one names what it removes.
- A lesson becomes one line in its group or a changed skill line; a skill gains a line only when another goes. The
  lines for every subagent brief live in `.agents/skills/builder-agent/subagent-brief.md`.
- Running sessions keep the old skill text, so the builder and the doc agent restart after this change.
