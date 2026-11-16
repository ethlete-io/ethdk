---
status: accepted
built: 13d27be26
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# fifagg keeps one alert dialog confirm look

The SDK alert dialog's confirm button knows only `destructive: true`; fifagg used blue or page-theme confirm buttons
before the migration. Asked whether the SDK should get a colour option for the confirm button, the human answered: "q1ok
aber ich denke wir sollten das in fifa einheitlich haben. was bringt es ums fleißig alles auf sdk components umzubauen
nur damit wir dann nachher doch wieder einen zoo an looks haben. daher wúrde ich sagen der bleibt rot."

The SDK gets no colour option for the confirm button. fifagg uses the confirm button as the SDK ships it, the same
everywhere. `built` names HEAD at the decision, because no code change builds it.
