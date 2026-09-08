---
'@ethlete/timetrack': patch
---

Both agent parsers read the prompts a person typed as `agent-prompt` events: an instant, a session and
a checkout, never the text. They key like spend, so a log read again stores each one once.
