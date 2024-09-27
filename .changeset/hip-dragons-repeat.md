---
'@ethlete/query': minor
---

Add `skipAutoTransform` option to query fields. This should be set to true on e.g. search fields. Otherwise, the search value might get transformed from a string to a number, which leads to loss of user input. E.g. "0031" would become "31" and "30.00" would become "30". Also whitespace would no longer work. The query form can detect these cases on its own but it's better to prevent them from happening in the first place. 
