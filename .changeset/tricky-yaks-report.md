---
'@ethlete/query': patch
---

Return the current query form instance from `QueryForm.observe` method. This allows for the form to be initialized and enabled without the need for a constructor.

```ts
class MyComponent {
  form = new QueryForm({
    name: new QueryField({ control: new FormControl('John') }),
  }).observe();
}
```
