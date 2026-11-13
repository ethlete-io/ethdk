---
status: accepted
built: d9a775727
decided: 2026-11-13
source: doc agent chat 2026-11-13, about 11:55 local
---

# A page sketch does not own the design of foreign parts

The builder drew a sketch of the sketches screen (`pages/sketches@focus-tooltip`) because the focus tooltip of the zoom
chips stuck out of a 176 px cell. The human rejected it (German, verbatim):

> die zoom controls hier im sketch sind ja dummy data. der sketch ist der sketches screen. ich weiß ehrlich gesagt nicht
> was der sketches screen mit dem tooltip zu tun hat. weil er abgeschnitten wird? warscheinlich. sind ja alles iframes
> und der tooltip wäre sicherlich ausßerhalb. aber das ist doch auch eig eher eine frage des zoom chip designs und nicht
> der sketches view. die sketches view hat das doch null zu interessieren.

A fresh session (not the supervisor) proposed one narrowing, and the human answered "q1ok" to the summary with it:

- Placeholder content of other parts in a page sketch (here the zoom chips in the sketches screen) is not the page's
  concern. Their own look and behaviour, such as a clipped tooltip, belongs in the sketch of that part.
- The page sketch still owns where those parts sit and how much room they get.
- The focus-tooltip sketch was discarded with no fix (d9a775727).
