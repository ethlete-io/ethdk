import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import migrateViewportService from './viewport-service';

function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trimEnd()) // Remove trailing whitespace
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .trim();
}

describe('migrate-to-v5 -> viewport service', () => {
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

  describe('boolean getters', () => {
    it('should replace ViewportService.isXs in getter body but warn about injection context', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  get isSmallScreen() {
    return this.viewportService.isXs;
  }

  get isSmallScreen$() {
    return this.viewportService.isXs$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsXs } from '@ethlete/core';

class Dummy {

  get isSmallScreen() {
    return injectIsXs()();
  }

  get isSmallScreen$() {
    return toObservable(injectIsXs());
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/test\.ts.*injectIsXs.*injection context/s));
    });

    it('should replace all viewport size getters in class member context', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);
  
  private isXs = this.viewportService.isXs;
  private isSm = this.viewportService.isSm;
}`;

      const expected = `import { injectIsSm, injectIsXs } from '@ethlete/core';

class Dummy {

  private isXs = injectIsXs()();
  private isSm = injectIsSm()();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace viewport getters in constructor', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    const xs = this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {

  constructor() {
    const xs = injectIsXs()();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should migrate but warn when used in callbacks outside injection context', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  checkSizes() {
    setTimeout(() => {
      const xs = this.viewportService.isXs;
    }, 1000);
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {

  checkSizes() {
    setTimeout(() => {
      const xs = injectIsXs()();
    }, 1000);
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/test\.ts.*injectIsXs.*injection context/s));
    });

    it('should migrate but warn when used in lifecycle hooks', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  ngOnInit() {
    const xs = this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {

  ngOnInit() {
    const xs = injectIsXs()();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/test\.ts.*injectIsXs.*injection context/s));
    });

    it('should handle constructor parameter injection', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  constructor(private viewportService: ViewportService) {
    const xs = this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  constructor() {
    const xs = injectIsXs()();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('observable properties', () => {
    it('should replace ViewportService.isXs$ with toObservable(injectIsXs())', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  isXs$ = this.viewportService.isXs$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsXs } from '@ethlete/core';

class Dummy {

  isXs$ = toObservable(injectIsXs());
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace all viewport observable properties', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  xs$ = this.viewportService.isXs$;
  sm$ = this.viewportService.isSm$;
  md$ = this.viewportService.isMd$;
  lg$ = this.viewportService.isLg$;
  xl$ = this.viewportService.isXl$;
  xxl$ = this.viewportService.is2Xl$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIs2Xl, injectIsLg, injectIsMd, injectIsSm, injectIsXl, injectIsXs } from '@ethlete/core';

class Dummy {

  xs$ = toObservable(injectIsXs());
  sm$ = toObservable(injectIsSm());
  md$ = toObservable(injectIsMd());
  lg$ = toObservable(injectIsLg());
  xl$ = toObservable(injectIsXl());
  xxl$ = toObservable(injectIs2Xl());
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when observable is accessed outside injection context', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  ngOnInit() {
    const xs$ = this.viewportService.isXs$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsXs } from '@ethlete/core';

class Dummy {

  ngOnInit() {
    const xs$ = toObservable(injectIsXs());
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/test\.ts.*injectIsXs.*injection context/s));
    });
  });

  describe('dimension observables', () => {
    it('should replace ViewportService.viewportSize$ with toObservable(injectViewportDimensions())', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  size$ = this.viewportService.viewportSize$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectViewportDimensions } from '@ethlete/core';

class Dummy {

  size$ = toObservable(injectViewportDimensions());
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace ViewportService.scrollbarSize$ with toObservable(injectScrollbarDimensions())', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  scrollbar$ = this.viewportService.scrollbarSize$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectScrollbarDimensions } from '@ethlete/core';

class Dummy {

  scrollbar$ = toObservable(injectScrollbarDimensions());
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace ViewportService.currentViewport$ with toObservable(injectCurrentBreakpoint())', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  current$ = this.viewportService.currentViewport$;
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectCurrentBreakpoint } from '@ethlete/core';

class Dummy {

  current$ = toObservable(injectCurrentBreakpoint());
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('method calls', () => {
    it('should replace ViewportService.observe() with injectObserveBreakpoint()', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  isAboveSm$ = this.viewportService.observe({ min: 'sm' });
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {

  isAboveSm$ = injectObserveBreakpoint({ min: 'sm' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace ViewportService.isMatched() with injectBreakpointIsMatched()', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  isSmall = this.viewportService.isMatched({ max: 'sm' });
}`;

      const expected = `import { injectBreakpointIsMatched } from '@ethlete/core';

class Dummy {

  isSmall = injectBreakpointIsMatched({ max: 'sm' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace ViewportService.getBreakpointSize() with getBreakpointSize()', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  size = this.viewportService.getBreakpointSize('md');
}`;

      const expected = `import { getBreakpointSize } from '@ethlete/core';

class Dummy {

  size = getBreakpointSize('md');
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when observe() is called outside injection context', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  ngOnInit() {
    const obs$ = this.viewportService.observe({ min: 'lg' });
  }
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {

  ngOnInit() {
    const obs$ = injectObserveBreakpoint({ min: 'lg' });
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/test\.ts.*injectObserveBreakpoint.*injection context/s),
      );
    });

    it('should handle toSignal wrapping - remove toSignal and use inject function directly', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);

  isAboveSm = toSignal(this.viewportService.observe({ min: 'sm' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';
class Dummy {

  isAboveSm = injectObserveBreakpoint({ min: 'sm' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
