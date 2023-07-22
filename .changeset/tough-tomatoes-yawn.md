---
'@ethlete/core': major
'@ethlete/cdk': major
---

Switch from popperjs to floating ui

```
npm uninstall @popperjs/core
npm install @floating-ui/dom
```

Update attribute names in css styles

```css
/* before */
[data-popper-placement^='top'] {
}

/* after */
[et-floating-placement^='top'] {
}
```
