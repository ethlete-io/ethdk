---
'@ethlete/query': patch
---

`V2BearerAuthProvider` writes the refresh cookie on the parent domain of the host again when `refreshConfig.cookieDomain` is not set. An earlier 6.0.0 prerelease wrote a host-only cookie, so apps on sibling subdomains lost the session and looped back to the login.
