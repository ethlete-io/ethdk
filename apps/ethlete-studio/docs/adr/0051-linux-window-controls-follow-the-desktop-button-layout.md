---
status: accepted
built: a1698f47a
decided: 2026-11-02
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Title bar window controls decisions" items 2, 4, 5
---

# Linux window controls follow the desktop button layout

Studio reads `org.gnome.desktop.wm.preferences button-layout` as VS Code does (which buttons, which side) and follows
changes; unset means minimize, maximize, close on the right. With `prefer-no-csd` (niri) it keeps the title bar but
drops minimize and maximize. `appmenu` is ignored; the app menu stays behind the sidebar logo. On Tom's machine this
shows only close, on the right.
