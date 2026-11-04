---
'@ethlete/cli': patch
'ethlete-studio': patch
---

`design check` rewrites the `old` variant of an open edit sketch from the part at HEAD before it compares, so a stored `old` that imports a since renamed `shared/` export no longer keeps the sketch open. An `old` that does not draw fails the check as `EDIT-OLD-NOT-DRAWN` instead of asking for a pick. Edit sketch notes are German. The full sketch listing sends a space every 15 s while it renders, so Studio (WebKit) no longer fails it with "Load failed" after 60 s; Studio shows a listing error the server sends after that as the error.
