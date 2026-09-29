import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import migrateRouterStateService from './router-state-service';

function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

describe('migrate-to-v5 -> router state service', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('observable properties', () => {
    it('should migrate route$ property access', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);
  
  route$ = this._routerStateService.route$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectRoute } from '@ethlete/core';

export class MyComponent {

  route$ = toObservable(injectRoute());
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should migrate multiple observable properties', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);
  
  route$ = this._routerStateService.route$;
  queryParams$ = this._routerStateService.queryParams$;
  pathParams$ = this._routerStateService.pathParams$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectPathParams, injectQueryParams, injectRoute } from '@ethlete/core';

export class MyComponent {

  route$ = toObservable(injectRoute());
  queryParams$ = toObservable(injectQueryParams());
  pathParams$ = toObservable(injectPathParams());
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
    it('should not rewrite route$ when route is replaced in the same class', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  route = this._routerStateService.route;
  route$ = this._routerStateService.route$;
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      const output = tree.read('test.ts', 'utf-8')!;

      expect(output).not.toContain('()$');
      expect(output).toContain('route = injectRoute();');
      expect(output).toContain('route$ = toObservable(injectRoute());');
    });
  });

  describe('method calls', () => {
    it('should migrate selectQueryParam method', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);
  
  id$ = this._routerStateService.selectQueryParam<string>('id');
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectQueryParam } from '@ethlete/core';

export class MyComponent {

  id$ = toObservable(injectQueryParam<string>('id'));
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('toSignal wrappers', () => {
    it('should migrate toSignal wrapped properties', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);
  
  route = toSignal(this._routerStateService.route$);
}`;

      const expected = `import { injectRoute } from '@ethlete/core';

export class MyComponent {

  route = injectRoute();
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle inline inject with toSignal', async () => {
      const input = `import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  protected readonly route = toSignal(inject(RouterStateService).route$);
}`;

      const expected = `import { inject } from '@angular/core';
import { injectRoute } from '@ethlete/core';

export class MyComponent {
  protected readonly route = injectRoute();
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('pipe chains', () => {
    it('should preserve pipe chains on observable properties', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);
  
  routeTitle$ = this._routerStateService.title$.pipe(
    map(title => title?.toUpperCase())
  );
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectRouteTitle } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {

  routeTitle$ = toObservable(injectRouteTitle()).pipe(
    map(title => title?.toUpperCase())
  );
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('constructor injection', () => {
    it('should handle constructor parameter injection', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  route$ = this._routerStateService.route$;

  constructor(private _routerStateService: RouterStateService) {}
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectRoute } from '@ethlete/core';

export class MyComponent {
  route$ = toObservable(injectRoute());

  constructor() {}
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('multiple occurrences', () => {
    it('should migrate every occurrence of an inline property access', async () => {
      tree.write(
        'test.ts',
        `import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

class Dummy {
  note = 'inject(RouterStateService).route$';
  a$ = inject(RouterStateService).route$;
  b$ = inject(RouterStateService).route$;
}`,
      );
      await migrateRouterStateService(tree);
      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).toContain("note = 'inject(RouterStateService).route$'");
      expect(result.match(/toObservable\(injectRoute\(\)\)/g)).toHaveLength(2);
    });

    it('should migrate every occurrence of an inline toSignal property and method call', async () => {
      tree.write(
        'test.ts',
        `import { toSignal } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

class Dummy {
  note = 'toSignal(inject(RouterStateService).route$) toSignal(inject(RouterStateService).selectQueryParam(1))';
  a = toSignal(inject(RouterStateService).route$);
  b = toSignal(inject(RouterStateService).route$);
  c = toSignal(inject(RouterStateService).selectQueryParam('x'));
  d = toSignal(inject(RouterStateService).selectQueryParam('x'));
}`,
      );
      await migrateRouterStateService(tree);
      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).toContain(
        "note = 'toSignal(inject(RouterStateService).route$) toSignal(inject(RouterStateService).selectQueryParam(1))'",
      );
      expect(result.match(/injectRoute\(\)/g)).toHaveLength(2);
      expect(result.match(/injectQueryParam\('x'\)/g)).toHaveLength(2);
    });

    it('should leave files under node_modules untouched', async () => {
      const vendored = `import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

class Vendored {
  a$ = inject(RouterStateService).route$;
}`;
      tree.write('node_modules/pkg/vendored.ts', vendored);
      await migrateRouterStateService(tree);
      expect(tree.read('node_modules/pkg/vendored.ts', 'utf-8')).toBe(vendored);
    });
  });

  describe('regression cases', () => {
    it('should leave a local class named RouterStateService untouched', async () => {
      const input = `import { inject } from '@angular/core';

class RouterStateService {
  route$ = 1;
}

export class Dummy {
  private _service = inject(RouterStateService);
  value = this._service.route$;
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(tree.read('test.ts', 'utf-8')).toBe(input);
    });

    it('should migrate a service imported with import type', async () => {
      tree.write(
        'test.ts',
        `import type { RouterStateService } from '@ethlete/core';
import { inject } from '@angular/core';

export class Dummy {
  private _service = inject(RouterStateService);
  value = this._service.route$;
}`,
      );
      await migrateRouterStateService(tree);

      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).toContain('injectRoute()');
      expect(result).not.toContain('RouterStateService');
    });

    it('should not touch the name inside a template comment', async () => {
      tree.write(
        'test.ts',
        `import { Component, inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

@Component({ template: '<!-- RouterStateService route$ -->' })
export class Dummy {
  private _service = inject(RouterStateService);
  value = this._service.route$;
}`,
      );
      await migrateRouterStateService(tree);

      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).toContain("template: '<!-- RouterStateService route$ -->'");
      expect(result).toContain('injectRoute()');
    });

    it('should leave a second class that does not use the service byte-identical', async () => {
      tree.write(
        'test.ts',
        `import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

export class First {
  private _service = inject(RouterStateService);
  value = this._service.route$;
}

export class Second {
  value = 1;
}`,
      );
      await migrateRouterStateService(tree);

      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).toContain('injectRoute()');
      expect(result).toContain('export class Second {\n  value = 1;\n}');
    });
  });

  describe('edge cases', () => {
    it('should handle selectQueryParam with pipe chain and multiline formatting', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';
import { map } from 'rxjs';

const CARD_CAROUSEL_ACTIVE_CARD_QUERY_PARAM = 'activeCard';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  readonly _overviewActiveCardParam$ = this._routerStateService
    .selectQueryParam(CARD_CAROUSEL_ACTIVE_CARD_QUERY_PARAM)
    .pipe(
      map((activeCard) => {
        if (!activeCard || isNaN(+activeCard)) {
          return null;
        }

        return +activeCard;
      }),
    );
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectQueryParam } from '@ethlete/core';
import { map } from 'rxjs';

const CARD_CAROUSEL_ACTIVE_CARD_QUERY_PARAM = 'activeCard';

export class MyComponent {

  readonly _overviewActiveCardParam$ = toObservable(injectQueryParam(CARD_CAROUSEL_ACTIVE_CARD_QUERY_PARAM))
    .pipe(
      map((activeCard) => {
        if (!activeCard || isNaN(+activeCard)) {
          return null;
        }

        return +activeCard;
      }),
    );
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle toSignal with requireSync option', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  private _route = toSignal(this._routerStateService.route$, { requireSync: true });
}`;

      const expected = `import { injectRoute } from '@ethlete/core';

export class MyComponent {

  private _route = injectRoute();
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle inline inject with selectPathParam and generic type', async () => {
      const input = `import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

type VideoGamePlayerId = string;

export class MyComponent {
  private _playerId = inject(RouterStateService).selectPathParam<VideoGamePlayerId | null>('playerId');
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { injectPathParam } from '@ethlete/core';

type VideoGamePlayerId = string;

export class MyComponent {
  private _playerId = toObservable(injectPathParam<VideoGamePlayerId | null>('playerId'));
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle method calls and property access in ngOnInit', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';
import { map, tap } from 'rxjs';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  ngOnInit(): void {
    this._routerStateService.enableScrollEnhancements();
    this._routerStateService.route$
      .pipe(
        map((_url) => _url.startsWith('/prototype')),
        tap((prototype) => {
          if (prototype) {
            document.body.classList.add('remove-background');
          } else {
            document.body.classList.remove('remove-background');
          }
        }),
      )
      .subscribe();
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectRoute, setupScrollRestoration } from '@ethlete/core';
import { map, tap } from 'rxjs';

export class MyComponent {
  private route$ = toObservable(injectRoute());

  constructor() {
    setupScrollRestoration();
  }

  ngOnInit(): void {

    this.route$
      .pipe(
        map((_url) => _url.startsWith('/prototype')),
        tap((prototype) => {
          if (prototype) {
            document.body.classList.add('remove-background');
          } else {
            document.body.classList.remove('remove-background');
          }
        }),
      )
      .subscribe();
  }
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle toSignal with selectPathParam, complex generic type, and requireSync', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
const COLLECTION_FILTER_PATH_PARAM = 'filter';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  private readonly _collectionFilter = toSignal(
    this._routerStateService.selectPathParam<ApprovalStatus | 'all' | 'updated' | null>(COLLECTION_FILTER_PATH_PARAM),
    { requireSync: true },
  );
}`;

      const expected = `import { injectPathParam } from '@ethlete/core';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
const COLLECTION_FILTER_PATH_PARAM = 'filter';

export class MyComponent {

  private readonly _collectionFilter = injectPathParam<ApprovalStatus | 'all' | 'updated' | null>(COLLECTION_FILTER_PATH_PARAM);
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle property access passed as function argument in method body', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  ngOnInit(): void {
    console.log('Current route:', this._routerStateService.route);
    console.log('Query params:', this._routerStateService.queryParams);
  }
}`;

      const expected = `import { injectQueryParams, injectRoute } from '@ethlete/core';

export class MyComponent {
  private route = injectRoute();
  private queryParams = injectQueryParams();

  ngOnInit(): void {
    console.log('Current route:', this.route());
    console.log('Query params:', this.queryParams());
  }
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle multiple toSignal wrapped method calls with generic types and requireSync', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type Format = 'json' | 'xml';
const COLLECTION_FILTER_PATH_PARAM = 'filter';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  private readonly _collectionFilter = toSignal(
    this._routerStateService.selectPathParam<ApprovalStatus | 'all' | 'updated' | null>(COLLECTION_FILTER_PATH_PARAM),
    { requireSync: true },
  );
  private readonly _format = toSignal(this._routerStateService.selectQueryParam<Format | undefined>('format'), {
    requireSync: true,
  });

  protected foo = queryComputed(() => {
    const collectionFilter = this._collectionFilter();
    const format = this._format();

    return null;
  });
}`;

      const expected = `import { injectPathParam, injectQueryParam } from '@ethlete/core';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type Format = 'json' | 'xml';
const COLLECTION_FILTER_PATH_PARAM = 'filter';

export class MyComponent {

  private readonly _collectionFilter = injectPathParam<ApprovalStatus | 'all' | 'updated' | null>(COLLECTION_FILTER_PATH_PARAM);
  private readonly _format = injectQueryParam<Format | undefined>('format');

  protected foo = queryComputed(() => {
    const collectionFilter = this._collectionFilter();
    const format = this._format();

    return null;
  });
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle toSignal with pipe chain and method calls in ngOnInit', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {
  private readonly _routerStateService = inject(RouterStateService);

  protected readonly isFullPageView = toSignal(
    this._routerStateService.route$.pipe(map((_url) => _url.startsWith('/prototype'))),
  );

  ngOnInit(): void {
    this._routerStateService.enableScrollEnhancements();
    this._routerStateService.route$
      .pipe(
        map((_url) => _url.startsWith('/prototype')),
      )
      .subscribe();
  }
}`;

      const expected = `import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { injectRoute, setupScrollRestoration } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {
  private route$ = toObservable(injectRoute());

  protected readonly isFullPageView = toSignal(
    this.route$.pipe(map((_url) => _url.startsWith('/prototype'))),
  );

  constructor() {
    setupScrollRestoration();
  }

  ngOnInit(): void {

    this.route$
      .pipe(
        map((_url) => _url.startsWith('/prototype')),
      )
      .subscribe();
  }
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle toSignal with pathParams$ and pipe chain', async () => {
      const input = `import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  protected readonly step = toSignal(
    this._routerStateService.pathParams$.pipe(
      map((params) => {
        return transformFormStep(params);
      }),
    ),
  );
}`;

      const expected = `import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { injectPathParams } from '@ethlete/core';
import { map } from 'rxjs';

export class MyComponent {

  protected readonly step = toSignal(
    toObservable(injectPathParams()).pipe(
      map((params) => {
        return transformFormStep(params);
      }),
    ),
  );
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle multiple inline inject with pathParams$ and pipe chains', async () => {
      const input = `import { inject } from '@angular/core';
import { RouterStateService } from '@ethlete/core';
import { map } from 'rxjs';

const CAMPAIGN_CURRENT_PATH_PARAM = 'campaignId';
const SQUAD_CURRENT_PATH_PARAM = 'squadId';

export class MyComponent {
  private readonly currentCampaignUuidFromPath$ = inject(RouterStateService).pathParams$.pipe(
    map((params) => params[CAMPAIGN_CURRENT_PATH_PARAM] ?? null),
  );

  private readonly currentSquadUuidFromPath$ = inject(RouterStateService).pathParams$.pipe(
    map((params) => params[SQUAD_CURRENT_PATH_PARAM] ?? null),
  );
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { injectPathParams } from '@ethlete/core';
import { map } from 'rxjs';

const CAMPAIGN_CURRENT_PATH_PARAM = 'campaignId';
const SQUAD_CURRENT_PATH_PARAM = 'squadId';

export class MyComponent {
  private readonly currentCampaignUuidFromPath$ = toObservable(injectPathParams()).pipe(
    map((params) => params[CAMPAIGN_CURRENT_PATH_PARAM] ?? null),
  );

  private readonly currentSquadUuidFromPath$ = toObservable(injectPathParams()).pipe(
    map((params) => params[SQUAD_CURRENT_PATH_PARAM] ?? null),
  );
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should handle toSignal with inline inject and selectPathParam with generic type', async () => {
      const input = `import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterStateService } from '@ethlete/core';

type BaseLanguageItemUuid = string;
const PROTOTYPE_ITEM_ID_PARAM = 'itemId';

export class MyComponent {
  private readonly _itemId = toSignal(
    inject(RouterStateService).selectPathParam<BaseLanguageItemUuid>(PROTOTYPE_ITEM_ID_PARAM),
  );
}`;

      const expected = `import { inject } from '@angular/core';
import { injectPathParam } from '@ethlete/core';

type BaseLanguageItemUuid = string;
const PROTOTYPE_ITEM_ID_PARAM = 'itemId';

export class MyComponent {
  private readonly _itemId = injectPathParam<BaseLanguageItemUuid>(PROTOTYPE_ITEM_ID_PARAM);
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('per-class migration', () => {
    it('should migrate two classes that inject the service under different field names', async () => {
      const input = `import { RouterStateService } from '@ethlete/core';

export class First {
  private _rs = inject(RouterStateService);

  log() {
    console.log(this._rs.queryParams);
  }
}

export class Second {
  private router = inject(RouterStateService);

  log() {
    console.log(this.router.pathParams);
  }
}`;

      const expected = `import { injectPathParams, injectQueryParams } from '@ethlete/core';

export class First {
  private queryParams = injectQueryParams();

  log() {
    console.log(this.queryParams());
  }
}

export class Second {
  private pathParams = injectPathParams();

  log() {
    console.log(this.pathParams());
  }
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should migrate two components in one file', async () => {
      const input = `import { Component } from '@angular/core';
import { RouterStateService } from '@ethlete/core';

@Component({ selector: 'app-first', template: '' })
export class FirstComponent {
  private _routerStateService = inject(RouterStateService);

  route$ = this._routerStateService.route$;
}

@Component({ selector: 'app-second', template: '' })
export class SecondComponent {
  private _routerStateService = inject(RouterStateService);

  log() {
    console.log(this._routerStateService.queryParams);
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { Component } from '@angular/core';
import { injectQueryParams, injectRoute } from '@ethlete/core';

@Component({ selector: 'app-first', template: '' })
export class FirstComponent {

  route$ = toObservable(injectRoute());
}

@Component({ selector: 'app-second', template: '' })
export class SecondComponent {
  private queryParams = injectQueryParams();

  log() {
    console.log(this.queryParams());
  }
}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should leave a class that does not inject the service untouched', async () => {
      const other = `export class Other {
  private _rs = inject(OtherService);

  log() {
    console.log(this._rs.queryParams);
  }
}`;

      const input = `import { RouterStateService } from '@ethlete/core';

export class First {
  private _rs = inject(RouterStateService);

  log() {
    console.log(this._rs.queryParams);
  }
}

${other}`;

      tree.write('test.ts', input);
      await migrateRouterStateService(tree);

      const output = tree.read('test.ts', 'utf-8')!;
      expect(output).toContain(other);
      expect(normalizeCode(output)).toContain(`export class First {
  private queryParams = injectQueryParams();

  log() {
    console.log(this.queryParams());
  }
}`);
    });

    it('should migrate an aliased import', async () => {
      const input = `import { RouterStateService as Rss } from '@ethlete/core';

export class MyComponent {
  private _router = inject(Rss);

  route$ = this._router.route$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectRoute } from '@ethlete/core';

export class MyComponent {

  route$ = toObservable(injectRoute());
}`;

      tree.write('test.ts', input);
      const report = await migrateRouterStateService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(report.review).toEqual([]);
    });
  });
});
