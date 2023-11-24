---
'@ethlete/cdk': minor
---

Add a drag handle element to the overlay template. This element will automatically be visible when the overlay is a bottom sheet.

**This might break your existing overlay templates** if you already have a drag handle element in your template. In that case you can simply hide it using CSS.

```css
.et-overlay-container-drag-handle {
  display: none !important;
}
```
