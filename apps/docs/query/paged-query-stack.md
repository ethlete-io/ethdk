# Paged Query Stack

A paged query stack extends the concept of a [Query Stack](./query-stack) for paginated data. It manages page navigation, knows the total number of pages, and can accumulate responses across pages.

## Usage

```ts
import { createPagedQueryStack } from '@ethlete/query';

const stack = createPagedQueryStack({
  injector,
  query: (page: number) => getItems({ injector }, withArgs({ page, pageSize: 20 })),
  totalPages: (response) => response.meta.totalPages,
});

stack.loading();
stack.error();
stack.currentPage();
stack.totalPages();

// Navigation
stack.fetchNextPage();
stack.fetchPreviousPage();
stack.goToPage(3);
```

## Rules

- `fetchNextPage()` cannot be called before the current page has loaded (error `ET401`).
- `fetchPreviousPage()` cannot be called when already on page 1 (error `ET402`).
- Requesting a page greater than `totalPages` throws error `ET400`.
