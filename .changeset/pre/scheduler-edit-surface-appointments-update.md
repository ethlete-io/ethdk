---
'@ethlete/components': patch
---

Fix an immutable `appointments` update stacking a second scheduler edit surface and wiping the
user's unsaved draft. Adds `openEditSurface(id)`, `closeEditSurface()` and `selectAppointment(id)`
on `<et-scheduler>`.
