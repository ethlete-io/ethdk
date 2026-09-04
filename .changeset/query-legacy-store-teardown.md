---
'@ethlete/query': patch
---

Legacy `V2QueryClient`: a client created inside an injection context now tears down its store's window listeners and 15s garbage collector when that injector is destroyed.
