# Design exploration: flows

### Draw a flow

A flow joins states of pages into a path the user reads left to right in Studio's Flows view.
It is `<product>/flows/<name>.json`; `position` and `label` are optional:

```json
{
  "frames": [{ "part": "pages/projects", "state": "empty", "position": { "x": 0, "y": 0 } }],
  "lines": [
    {
      "from": { "part": "pages/projects", "state": "empty" },
      "to": { "part": "pages/project-detail", "state": "default" },
      "label": "user adds a project"
    }
  ]
}
```

Every flow line is labelled, and the element the label names is visible in the frame before it: a line
labelled "user clicks 'Log in'" starts from a frame that shows a "Log in" button. A line that names
nothing the reader can see, or a label for a control the page lacks, is a defect.

A line may join two states of one page. A frame may name a page that exists only as an open sketch;
the flow then shows its first variant. Lines hold for every preset. Without `position`, Studio
lays the frames out along the lines.

A page may not import another page. To show a page inside a page ("in context"), embed it:
`embedPage('pages/system', { state, width, height, scale })` from `@design-system` answers a
drawing whose `body` is a frame of that page, drawn in the same product, sketch variant and theme
as the embedding frame. `width` and `height` are the viewport the page is drawn at (default
1280 x 800; `height: 'auto'` fits its content), `scale` shrinks the frame. Never rebuild a page
from its elements to show it.

The app shell (menu, navigation) is one element named by purpose (`elements/shell-primary`) that each page
imports, so a shell pick lands in one file. Never draw the shell inside a page, and never as a state of one.
A dialog without its own URL is an element that a page state shows ("login open").
