# Design exploration: screenshots

**Off by default.** The user has the call open and sends you a picture when something looks
wrong. Take one only when the code cannot tell you whether two variants really differ, and
never to put in front of the user. Copy `shoot-template.mjs` from this skill folder to the repository
root.

```bash
node shoot.mjs <story-id> 1100 760 out.png
```

- `waitUntil: 'networkidle'` never settles on an iframe that holds a live dev server
  connection. Use `'domcontentloaded'`.
- `:hover`, `:focus-visible` and `:active` need a CDP session and `CSS.forcePseudoState`.
  Several hold open at once, so one image shows them all. The template does this.
