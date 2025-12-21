import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
import { QueryArgs } from './query';
import { createQueryClient } from './query-client';
import {
  createDeleteQuery,
  createGetQuery,
  createPatchQuery,
  createPostQuery,
  createPutQuery,
  createSecureDeleteQuery,
  createSecureGetQuery,
  createSecurePatchQuery,
  createSecurePostQuery,
  createSecurePutQuery,
} from './query-creator-templates';

describe('query creator templates', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
  const authProvider = createBearerAuthProvider({ queryClientRef: client, name: 'test' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  describe('createGetQuery', () => {
    it('should create a GET query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createGetQuery(client);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createSecureGetQuery', () => {
    it('should create a secure GET query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createSecureGetQuery(client, authProvider);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createPostQuery', () => {
    it('should create a POST query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createPostQuery(client);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createSecurePostQuery', () => {
    it('should create a secure POST query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createSecurePostQuery(client, authProvider);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createPutQuery', () => {
    it('should create a PUT query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createPutQuery(client);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createSecurePutQuery', () => {
    it('should create a secure PUT query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createSecurePutQuery(client, authProvider);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createDeleteQuery', () => {
    it('should create a DELETE query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createDeleteQuery(client);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createSecureDeleteQuery', () => {
    it('should create a secure DELETE query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createSecureDeleteQuery(client, authProvider);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createPatchQuery', () => {
    it('should create a PATCH query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createPatchQuery(client);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('createSecurePatchQuery', () => {
    it('should create a secure PATCH query creator', () => {
      TestBed.runInInjectionContext(() => {
        const creator = createSecurePatchQuery(client, authProvider);
        const query = creator('/users');
        expect(query).toBeTruthy();
      });
    });
  });

  describe('conditional transformResponse requirement', () => {
    type User = { id: number; name: string };

    it('should allow optional transformResponse when rawResponse is not defined', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & { response: User };
        const creator = createGetQuery(client);

        // Should compile without options
        const query1 = creator<Args>('/users');
        expect(query1).toBeTruthy();

        // Should also work with transformResponse
        const query2 = creator<Args>('/users', {
          transformResponse: (r) => r,
        });
        expect(query2).toBeTruthy();
      });
    });

    it('should allow optional transformResponse when rawResponse equals response', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & {
          response: User;
          rawResponse: User;
        };
        const creator = createGetQuery(client);

        // Should compile without options
        const query1 = creator<Args>('/users');
        expect(query1).toBeTruthy();

        // Should also work with transformResponse
        const query2 = creator<Args>('/users', {
          transformResponse: (r) => r,
        });
        expect(query2).toBeTruthy();
      });
    });

    it('should require transformResponse when rawResponse differs from response', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & {
          response: number;
          rawResponse: User;
        };
        const creator = createGetQuery(client);

        // This line would NOT compile without transformResponse:
        // const query1 = creator<Args>('/users');

        // Must provide transformResponse
        const query2 = creator<Args>('/users', {
          transformResponse: (r) => r.id,
        });
        expect(query2).toBeTruthy();
      });
    });

    it('should properly type transformResponse parameter and return', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & {
          response: string;
          rawResponse: User;
        };
        const creator = createGetQuery(client);

        const query = creator<Args>('/users', {
          // r should be typed as User
          // return should be string
          transformResponse: (r) => r.name,
        });
        expect(query).toBeTruthy();
      });
    });

    it('should work with secure query creators', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & {
          response: number;
          rawResponse: User;
        };
        const creator = createSecureGetQuery(client, authProvider);

        const query = creator<Args>('/users', {
          transformResponse: (r) => r.id,
        });
        expect(query).toBeTruthy();
      });
    });

    it('should work with POST queries', () => {
      TestBed.runInInjectionContext(() => {
        type Args = QueryArgs & {
          response: number;
          rawResponse: { data: User };
          body: { name: string };
        };
        const creator = createPostQuery(client);

        const query = creator<Args>('/users', {
          transformResponse: (r) => r.data.id,
        });
        expect(query).toBeTruthy();
      });
    });
  });
});
