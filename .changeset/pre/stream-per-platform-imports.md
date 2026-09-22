---
'@ethlete/components': major
---

Stream: `STREAM_IMPORTS` now holds only the shared consent, loading, error and slot pieces. Add the barrel of each platform you embed (`STREAM_YOUTUBE_IMPORTS`, `STREAM_TWITCH_IMPORTS`, … `STREAM_SOOP_IMPORTS`) and `STREAM_PIP_IMPORTS` for picture-in-picture - or `STREAM_ALL_IMPORTS` to keep the old contents. A YouTube-only app saves ~5 kB gz.
