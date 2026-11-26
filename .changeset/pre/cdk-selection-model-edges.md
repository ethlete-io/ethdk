---
'@ethlete/cdk': patch
---

Keep a falsy option such as `0` or `''` selectable in the combobox, and stop `SelectionModel.getOptionByOffset` from overflowing the stack when it loops, gets no options, or meets only disabled options.
