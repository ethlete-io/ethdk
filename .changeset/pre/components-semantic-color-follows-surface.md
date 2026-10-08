---
'@ethlete/components': major
---

Breaking: every component takes its error, warning and success colors from the surface it renders on, so `injectFormSupport().errorColorTheme` and `TableComponent.errorColorTheme` are now signals; `et update` migrates their reads.
