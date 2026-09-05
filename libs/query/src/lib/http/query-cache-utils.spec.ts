import { HttpHeaders } from '@angular/common/http';
import { buildQueryCacheKey, extractExpiresInSeconds, shouldCacheQuery } from './query-cache-utils';

describe('query cache utils', () => {
  describe('shouldCacheQuery', () => {
    it('should return true for GET, OPTIONS and HEAD', () => {
      expect(shouldCacheQuery('GET')).toBe(true);
      expect(shouldCacheQuery('OPTIONS')).toBe(true);
      expect(shouldCacheQuery('HEAD')).toBe(true);
    });

    it('should return false for POST, PUT, PATCH and DELETE', () => {
      expect(shouldCacheQuery('POST')).toBe(false);
      expect(shouldCacheQuery('PUT')).toBe(false);
      expect(shouldCacheQuery('PATCH')).toBe(false);
      expect(shouldCacheQuery('DELETE')).toBe(false);
    });
  });

  describe('buildQueryCacheKey', () => {
    it('should return the same key for the same route and args', () => {
      const key1 = buildQueryCacheKey('/api/test', { queryParams: { id: 1 } });
      const key2 = buildQueryCacheKey('/api/test', { queryParams: { id: 1 } });
      expect(key1).toBe(key2);
    });

    it('should return different keys for different routes', () => {
      const key1 = buildQueryCacheKey('/api/test', undefined);
      const key2 = buildQueryCacheKey('/api/other', undefined);
      expect(key1).not.toBe(key2);
    });

    it('should include body in the hash', () => {
      const key1 = buildQueryCacheKey('/api/test', { body: { query: '{ users }' } });
      const key2 = buildQueryCacheKey('/api/test', { body: { query: '{ posts }' } });
      expect(key1).not.toBe(key2);
    });

    it('should include request headers other than authorization in the hash', () => {
      const english = buildQueryCacheKey('/api/test', {
        headers: new HttpHeaders({ 'Accept-Language': 'en', Authorization: 'Bearer one' }),
      });
      const german = buildQueryCacheKey('/api/test', {
        headers: new HttpHeaders({ 'Accept-Language': 'de', Authorization: 'Bearer one' }),
      });
      const rotatedToken = buildQueryCacheKey('/api/test', {
        headers: new HttpHeaders({ 'Accept-Language': 'en', Authorization: 'Bearer two' }),
      });

      expect(english).not.toBe(german);
      expect(english).toBe(rotatedToken);
    });

    it('should derive the same key regardless of header name casing', () => {
      const mixed = buildQueryCacheKey('/api/test', {
        headers: new HttpHeaders({ 'X-Tenant': 'one', 'accept-language': 'en' }),
      });
      const lower = buildQueryCacheKey('/api/test', {
        headers: new HttpHeaders({ 'x-tenant': 'one', 'Accept-Language': 'en' }),
      });

      expect(mixed).toBe(lower);
    });

    it('should give every cacheable method on one route its own key', () => {
      const args = { body: { page: 1 } };

      const get = buildQueryCacheKey('/api/status', args, 'GET');
      const head = buildQueryCacheKey('/api/status', args, 'HEAD');
      const options = buildQueryCacheKey('/api/status', args, 'OPTIONS');
      const post = buildQueryCacheKey('/api/status', args, 'POST');

      expect(new Set([get, head, options, post]).size).toBe(4);
    });

    it('should keep the key a GET already has, so persisted entries survive an upgrade', () => {
      expect(buildQueryCacheKey('/api/status', undefined)).toBe('06330470810770548246');
      expect(buildQueryCacheKey('/api/status', undefined, 'GET')).toBe('06330470810770548246');
      expect(buildQueryCacheKey('/api/status', { body: { page: 1 } }, 'GET')).toBe('40377494252018032206');
      expect(buildQueryCacheKey('/api/status', { headers: new HttpHeaders({ 'Accept-Language': 'en' }) }, 'GET')).toBe(
        '10877690302814443351',
      );
    });

    it('should return a numeric string', () => {
      const key = buildQueryCacheKey('/api/test', undefined);
      expect(Number.isNaN(Number(key))).toBe(false);
    });
  });

  describe('extractExpiresInSeconds', () => {
    it('should return null when cache-control is no-cache', () => {
      const headers = new HttpHeaders({ 'cache-control': 'no-cache' });
      expect(extractExpiresInSeconds(headers)).toBeNull();
    });

    it('should return null when cache-control is no-store', () => {
      const headers = new HttpHeaders({ 'cache-control': 'no-store' });
      expect(extractExpiresInSeconds(headers)).toBeNull();
    });

    it('should not fall through to expires when max-age is zero', () => {
      const headers = new HttpHeaders({
        'cache-control': 'max-age=0',
        expires: new Date(Date.now() + 60_000).toUTCString(),
      });

      expect(extractExpiresInSeconds(headers)).toBe(0);
    });

    it('should return max-age/2 as estimate when only max-age is present', () => {
      const headers = new HttpHeaders({ 'cache-control': 'max-age=600' });
      expect(extractExpiresInSeconds(headers)).toBe(300);
    });

    it('should subtract age from max-age when both headers are present', () => {
      const headers = new HttpHeaders({ 'cache-control': 'max-age=600', age: '100' });
      expect(extractExpiresInSeconds(headers)).toBe(500);
    });

    it('should use s-maxage when max-age is absent', () => {
      const headers = new HttpHeaders({ 'cache-control': 's-maxage=400' });
      expect(extractExpiresInSeconds(headers)).toBe(200);
    });

    it('should return 3600 for expires: -1', () => {
      const headers = new HttpHeaders({ expires: '-1' });
      expect(extractExpiresInSeconds(headers)).toBe(3600);
    });

    it('should parse a future expires date header', () => {
      const future = new Date(Date.now() + 60_000);
      const headers = new HttpHeaders({ expires: future.toUTCString() });
      const result = extractExpiresInSeconds(headers);
      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThanOrEqual(60);
    });

    it('should return null when no cache headers are present', () => {
      const headers = new HttpHeaders();
      expect(extractExpiresInSeconds(headers)).toBeNull();
    });
  });
});
