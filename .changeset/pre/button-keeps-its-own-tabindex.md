---
'@ethlete/components': patch
---

An `et-button` keeps a `tabindex` its consumer set on the element. The host binding no longer removes it, so an opted-out control such as the scrollable's navigation buttons stays out of the tab order.
