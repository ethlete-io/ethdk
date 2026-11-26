---
'@ethlete/query': patch
---

Fix the devtools **Log in as** landing one login behind: the previous user's cached data is now dropped once the login's tokens are in force, not while the old token is still the one every secure query re-runs on.
