---
'@ethlete/components': minor
---

Forms: new `et-rating` control (star rating, `RATING_IMPORTS`) - `FormValueControl<number | null>` implementing the slider pattern: hover preview, drag/swipe rating (mouse and touch, commits on release), half steps (`allowHalf`), click-again/Backspace to clear, arrow-key stepping, and a custom icon slot (`ng-template[etRatingIcon]`). The fill animates as one continuous sweep. Tokens `--et-rating-icon-size` / `--et-rating-gap`.
