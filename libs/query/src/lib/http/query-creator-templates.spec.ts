import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth';
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
});
