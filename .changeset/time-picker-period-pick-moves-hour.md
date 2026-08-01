---
'@ethlete/components': patch
---

Fix an AM/PM pick doing nothing when the mirrored hour is out of bounds: an AM/PM option
chooses a half-day, not an hour, so the hour may now move inside the picked half - closest
to the current clock position first. With 09:00–17:00 opening hours, picking PM at 10:00 AM
commits 4 PM instead of silently keeping 10 AM.
