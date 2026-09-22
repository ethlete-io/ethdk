---
'@ethlete/query': major
---

Error-response parsing and the default retry policy are opt-in query client features - without them a
client reads the plain `string` / `{ message }` / `{ detail }` / `string[]` ladder and retries
nothing, which takes ~1.4 kB gz out of an app that needs neither. Pick from `withHtmlErrorParsing()`,
`withSymfonyErrors()`, `withDefaultRetry()`, `withEthleteApiErrors()` (all three, the previous
behavior) and `registerQueryErrorParser()` for a body shape the SDK does not know. Run
`npx nx g @ethlete/query:migrate-query-opt-in-features` to keep the old behavior.
