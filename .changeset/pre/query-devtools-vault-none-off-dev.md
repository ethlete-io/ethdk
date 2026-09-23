---
'@ethlete/query': patch
'@ethlete/query-devtools': patch
---

Outside a development build the devtools session vault now defaults to `none`, so a plain login no longer leaves tokens in `sessionStorage`, and a vault left in either store is removed on load.
