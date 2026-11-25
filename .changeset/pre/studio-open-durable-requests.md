---
'@ethlete/cli': patch
'ethlete-studio': patch
---

`et design studio open` keeps a queued request in a folder that survives a reboot (`~/.local/state/ethlete-studio/open-requests` on Linux, `~/Library/Application Support/ethlete-studio/open-requests` on macOS, `%LOCALAPPDATA%\ethlete-studio\open-requests` on Windows) instead of the temp folder, and Studio reads it from there at its next start.
