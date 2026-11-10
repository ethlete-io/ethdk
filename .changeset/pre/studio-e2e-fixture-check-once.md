---
'ethlete-studio': none
---

The Studio e2e workers each request the full sketch listing in setup, which also warms their own compare cache. Only the first worker asserts the fixture states, and a timeout or error in the request fails the run.
