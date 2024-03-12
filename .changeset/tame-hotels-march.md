---
'@ethlete/query': minor
---

Add `mock` property to `prepare` method to allow for mocking responses and errors. 
Mocked queries will ignore the `secure` property and will not be sent over the network. 

```ts
// The query results in a successful response after 300ms using the mock response
getBooks
  .prepare({
    queryParams: { page: 1 },
    mock: { response: MOCK_RESPONSE, delay: 300 },
  })
  .execute();

// The query results in a failed response after 300ms using the mock error
getBooks
  .prepare({
    queryParams: { page: 1 },
    mock: { error: MOCK_ERROR, delay: 300 },
  })
  .execute();

// The query results in a successful response using the mock response after being retried 3 times
getBooks
  .prepare({
    queryParams: { page: 1 },
    mock: { retryIntoResponse: true },
  })
  .execute();

// The query results in a successful response after 6 progress events using the mock response
uploadSomeFile
  .prepare({
    queryParams: { page: 1 },
    mock: {
      response: MOCK_RESPONSE,
      progress: {
        eventCount: 6,
      },
    },
  })
  .execute();
```
