---
'@ethlete/components': patch
---

`et-table` treats `[error]="false"` as no error, hands a `rowsSource` error to `errorTemplate`, and drops the virtual-scroll spacers around the error state.
