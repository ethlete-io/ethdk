import { buildQueryPathTree, flattenQueryPathTree, queryRoutePathSegments } from './query-devtools-query-tree';
import { trimRouteSegments } from './query-devtools-route.component';

const rowsFor = (routes: string[]) => routes.map((route) => ({ path: queryRoutePathSegments(route), item: route }));

const labels = (routes: string[]) => buildQueryPathTree(rowsFor(routes)).children.map((child) => child.label);

describe('queryRoutePathSegments', () => {
  it('should split a route and drop the empty leading segment', () => {
    expect(queryRoutePathSegments('/post/1')).toEqual(['post', '1']);
  });

  it('should keep a query string on the segment it belongs to', () => {
    expect(queryRoutePathSegments('/posts?page=1&limit=5')).toEqual(['posts?page=1&limit=5']);
  });

  it('should treat the root route as no segments at all', () => {
    expect(queryRoutePathSegments('/')).toEqual([]);
    expect(queryRoutePathSegments('')).toEqual([]);
  });
});

describe('buildQueryPathTree', () => {
  it('should branch where two routes diverge', () => {
    const tree = buildQueryPathTree(rowsFor(['/post/1', '/post/2']));

    expect(tree.children.map((child) => child.label)).toEqual(['post']);
    expect(tree.children[0]?.children.map((child) => child.label)).toEqual(['1', '2']);
  });

  it('should compress a chain nothing branches off', () => {
    expect(labels(['/api/v1/teams'])).toEqual(['api/v1/teams']);
  });

  it('should stop compressing at the segment that branches', () => {
    const tree = buildQueryPathTree(rowsFor(['/api/v1/teams', '/api/v1/players']));

    expect(tree.children.map((child) => child.label)).toEqual(['api/v1']);
    expect(tree.children[0]?.children.map((child) => child.label)).toEqual(['teams', 'players']);
  });

  it('should not compress a folder that holds a row of its own', () => {
    const tree = buildQueryPathTree(rowsFor(['/api', '/api/teams']));

    expect(tree.children.map((child) => child.label)).toEqual(['api']);
    expect(tree.children[0]?.items).toEqual(['/api']);
    expect(tree.children[0]?.children.map((child) => child.label)).toEqual(['teams']);
  });

  it('should key a node on its full path, not its compressed label', () => {
    expect(buildQueryPathTree(rowsFor(['/api/v1/teams'])).children[0]?.key).toBe('/api/v1/teams');
  });

  it('should count everything at or below a folder', () => {
    const tree = buildQueryPathTree(rowsFor(['/api/teams', '/api/teams/1', '/api/players']));

    expect(tree.children[0]?.count).toBe(3);
  });

  it('should keep the order rows arrived in', () => {
    expect(labels(['/zeta/one', '/alpha/one'])).toEqual(['zeta/one', 'alpha/one']);
  });

  it('should leave a route with no segments at the root', () => {
    const tree = buildQueryPathTree(rowsFor(['/', '/post/1']));

    expect(tree.items).toEqual(['/']);
    expect(tree.children.map((child) => child.label)).toEqual(['post/1']);
  });
});

describe('flattenQueryPathTree', () => {
  const flatten = (routes: string[], collapsed: string[] = []) =>
    flattenQueryPathTree(buildQueryPathTree(rowsFor(routes)), {
      isCollapsed: (key) => collapsed.includes(key),
      keyOf: (item) => item,
    });

  it('should give a route nothing branches off no folder row at all', () => {
    expect(flatten(['/post/1'])).toEqual([{ kind: 'row', key: '/post/1', depth: 0, item: '/post/1', parentPath: '' }]);
  });

  it('should head a node that actually splits the list, and indent its rows below it', () => {
    expect(flatten(['/post/1', '/post/2'])).toEqual([
      { kind: 'folder', key: '/post', label: 'post', depth: 0, count: 2, collapsed: false },
      { kind: 'row', key: '/post/1', depth: 1, item: '/post/1', parentPath: '/post' },
      { kind: 'row', key: '/post/2', depth: 1, item: '/post/2', parentPath: '/post' },
    ]);
  });

  it('should keep a folder that holds a row of its own next to a child', () => {
    expect(flatten(['/orders', '/orders/confirm'])).toEqual([
      { kind: 'folder', key: '/orders', label: 'orders', depth: 0, count: 2, collapsed: false },
      { kind: 'row', key: '/orders', depth: 1, item: '/orders', parentPath: '/orders' },
      { kind: 'row', key: '/orders/confirm', depth: 1, item: '/orders/confirm', parentPath: '/orders' },
    ]);
  });

  it('should hide everything under a collapsed folder but keep the folder', () => {
    const rows = flatten(['/api/teams', '/api/players'], ['/api']);

    expect(rows).toEqual([{ kind: 'folder', key: '/api', label: 'api', depth: 0, count: 2, collapsed: true }]);
  });

  it('should never lose a row, whatever the shape', () => {
    const routes = ['/post/1', '/post/2', '/flaky', '/orders', '/orders/confirm', '/api/v1/teams'];

    expect(flatten(routes).filter((row) => row.kind === 'row')).toHaveLength(routes.length);
  });

  it('should list a rootless row before everything else', () => {
    const rows = flatten(['/', '/post/1', '/post/2']);

    expect(rows[0]).toEqual({ kind: 'row', key: '/', depth: 0, item: '/', parentPath: '' });
    expect(rows[1]?.kind).toBe('folder');
  });
});

describe('trimRouteSegments', () => {
  const seg = (text: string, kind: 'static' | 'param' | 'query' = 'static') => ({ text, kind });

  it('should keep the whole route when there is no prefix', () => {
    expect(trimRouteSegments([seg('/post/1')], '')).toBeNull();
  });

  it('should drop a prefix that ends on a segment boundary', () => {
    expect(trimRouteSegments([seg('/post'), seg('/1')], '/post')).toEqual([seg('/1')]);
  });

  it('should split the segment the prefix ends inside', () => {
    expect(trimRouteSegments([seg('/post/1')], '/post')).toEqual([seg('/1')]);
  });

  it('should keep the kinds of the segments it keeps', () => {
    expect(trimRouteSegments([seg('/post/'), seg(':postId', 'param')], '/post')).toEqual([
      seg('/'),
      seg(':postId', 'param'),
    ]);
  });

  it('should refuse a prefix the route does not start with', () => {
    expect(trimRouteSegments([seg('/posts/1')], '/post/')).toBeNull();
  });

  it('should refuse to trim the whole route away', () => {
    expect(trimRouteSegments([seg('/post')], '/post')).toBeNull();
  });
});
