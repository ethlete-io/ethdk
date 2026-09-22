---
'@ethlete/contentful': major
---

Rich text: marks now render as semantic elements (`<strong>`, `<em>`, `<u>`, `<code>`, `<s>`, `<sub>`, `<sup>`) instead of Tailwind classes; marks inside hyperlinks become `et-contentful-rich-text-mark-*` classes on the link's `textClass`. `marksToClass` changed accordingly, `marksToTags` is new.
