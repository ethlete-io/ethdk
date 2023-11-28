---
'@ethlete/cdk': minor
---

Add layout components & directives for overlays.

You can now use the `et-overlay-body` component directive and the `et-overlay-header` and `et-overlay-footer` directives inside your overlay templates.
The body component directive allows for scrolling content inside the overlay. The header and footer directives are used to position content at the top and bottom of the overlay respectively. The body component directive also allows for displaying dividers between the header, body and footer content via the `dividers` input. The input can be set to `"static"` to always display the dividers or `"dynamic"` to automatically hide the dividers when the the user scrolls to the top or bottom of the overlay respectively.

Example usage inside your overlay template. Note that the directives must be **direct children** of the overlay template.

```html
<et-overlay-header>
  <h1>Overlay Header</h1>
</et-overlay-header>
<et-overlay-body dividers="dynamic">
  <p>Overlay Body</p>
</et-overlay-body>
<et-overlay-footer>
  <p>Overlay Footer</p>
</et-overlay-footer>
```

Or if you want to use the directives on existing elements. Note that **the body is a component** itself so it can't be placed on an other Angular component.

```html
<div etOverlayHeader>
  <h1>Overlay Header</h1>
</div>
<div et-overlay-body dividers="dynamic">
  <p>Overlay Body</p>
</div>
<div etOverlayFooter>
  <p>Overlay Footer</p>
</div>
```
