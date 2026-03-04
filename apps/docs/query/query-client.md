# Query Client

The query client is the central runtime context for the query system. It holds the Angular `HttpClient`, the `QueryRepository` (cache layer), and global configuration.

## Setup

Create a query client once at the application root using `createQueryClient`:

```ts
import { createQueryClient } from '@ethlete/query';

export const [QueryClientProvider, injectQueryClient] = createQueryClient({
  baseUrl: 'https://api.example.com',
});
```

Then provide it in your `app.config.ts`:

```ts
import { ApplicationConfig } from '@angular/core';
import { QueryClientProvider } from './query-client';

export const appConfig: ApplicationConfig = {
  providers: [QueryClientProvider],
};
```

## Options

| Option    | Type                                    | Description                                 |
| --------- | --------------------------------------- | ------------------------------------------- |
| `baseUrl` | `string`                                | Base URL prepended to all request routes    |
| `headers` | `HttpHeaders \| Record<string, string>` | Default headers added to every request      |
| `params`  | `HttpParams \| Record<string, string>`  | Default query params added to every request |

## Multiple clients

You can create multiple clients for different APIs — each provides its own isolated repository and config:

```ts
export const [PrimaryClientProvider, injectPrimaryClient] = createQueryClient({
  baseUrl: 'https://api.example.com',
});

export const [CmsClientProvider, injectCmsClient] = createQueryClient({
  baseUrl: 'https://cms.example.com',
});
```

Each query creator is bound to a specific client at instantiation time via the injector context.
