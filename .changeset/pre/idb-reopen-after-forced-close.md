---
'@ethlete/query': patch
---

Query persistence now opens the IndexedDB database again after the browser closes the connection, for example when the user clears the site data. Before, every later write failed and persistence stopped for the rest of the session.
