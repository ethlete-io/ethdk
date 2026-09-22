---
'@ethlete/core': minor
---

`injectAnimatedBlockSize` can now animate the inline axis too via the new `axes` option (`['block' | 'inline']`, static or signal-based; default `['block']` as before). Used by the cascader panel to grow/shrink its width as columns drill in and out.
