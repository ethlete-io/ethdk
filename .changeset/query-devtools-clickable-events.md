---
'@ethlete/components': minor
---

Make the query devtools' Events rows open the query they came from. The Events tab was the
one view with no way out of it - the Timeline already links a bar to its query, but a
`request-error` row named a URL and left you to find it in the Queries list yourself. The
request cell is now a button that opens the owning query's detail.

The owner is resolved when the event is logged rather than when the row is clicked, so the
100-entry log holds a registry id instead of a reference to the `HttpRequest` it described.
A row whose query was never registered (or has since been destroyed) stays plain text.
