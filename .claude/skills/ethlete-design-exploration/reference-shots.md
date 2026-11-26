# Design exploration: shots and screenshots

**Do not send a screenshot.** The user keeps the call open. Screenshot only for your own
check that a variant renders. In a repository with `et design`, take it with
`et design shot <layer>/<name> --states [--variants]`: one contact sheet of every state, and
every variant of the open sketch, with a label per cell; below each variant row, a diff row marks
the pixels that differ from the merged state in red, or says "no pixel change" (with ", but the markup differs" when only the markup changed, e.g. both sides miss the same content). It prints the PNG path last. `--scale 2` enlarges a small part; `--crop x,y,w,h` cuts each cell to that CSS-pixel box, to judge hairlines. `--interaction hover` forces an interaction on every cell. `--state a,b` draws only those states, to compare them side by side. With `--variants`, `--round r2` or `--variant i,j` draws only those variants next to the merged row, so the current round stays readable; it filters the picture, never the checks. With `--variants`, `--diff-props` compares each variant with the merged part drawn with the variant's state props, so changed props do not paint the diff red. It draws
undimmed, whatever Studio shows. Do not write a scratch script for batch shots.
`et design motion shots <layer>/<name> <motion>` draws a motion at its keyframes, in full and reduced motion, into one sheet, and writes its tracks (element, properties, start, duration, easing) as JSON next to it.

## Screenshots

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
