---
'@ethlete/query': patch
---

Stop a legacy `InfinityQuery` from aborting a non-cacheable page (such as a POST) that is still loading when it is reset or destroyed; the page now finishes and is destroyed once it settles.
