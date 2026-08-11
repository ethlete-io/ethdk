---
'@ethlete/components': patch
---

Selection lists (`et-radio-group`, `et-checkbox-group`, `et-segmented-button-group`) accept `aria-label` / `aria-labelledby` and count as labelled, so a group named from outside its field no longer trips the field's labelling guard (ET2201) and no longer needs a visually hidden `<et-label>`.
