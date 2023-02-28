---
'@ethlete/query': major
---

Add functionality to auto refresh queries that can be cached, if their query client's default headers get updated.

`QueryClient.setDefaultHeaders()` now accepts a configuration object instead of a headers map.

Before:

```ts
QueryClient.setDefaultHeaders({ 'X-My-Header': 'Some Value' });
```

After:

```ts
QueryClient.setDefaultHeaders({ headers: { 'X-My-Header': 'Some Value' } });
```
