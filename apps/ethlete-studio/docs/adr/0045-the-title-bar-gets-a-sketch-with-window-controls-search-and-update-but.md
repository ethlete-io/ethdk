---
status: accepted
open: none
decided: 2026-11-02
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Studio order, explorer, merge canvas and build-ready decisions" item 2 (A1-A3)
---

# The title bar gets a sketch with window controls, search and update button

A sketch `components/title-bar` comes first; after the human's pick the built window controls are aligned to it and A2/A3
follow. Builder calls accepted: "no client decorations" comes from the compositor's xdg-decoration preference, and
stock GNOME `appmenu:close` shows close only.
