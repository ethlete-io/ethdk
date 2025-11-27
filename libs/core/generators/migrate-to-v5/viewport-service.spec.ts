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
  let consoleInfoSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('boolean getters', () => {
    it('should extract ViewportService.isXs into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  get isSmallScreen() {
    return this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  get isSmallScreen() {
    return this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract ViewportService.isXs$ into observable class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  get isSmallScreen$() {
    return this.viewportService.isXs$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs$ = toObservable(injectIsXs());

  get isSmallScreen$() {
    return this.isXs$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract all viewport size getters into class members', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);
  
  checkSize() {
    return this.viewportService.isXs || this.viewportService.isSm;
  }
}`;

      const expected = `import { injectIsSm, injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();
  private isSm = injectIsSm();
  
  checkSize() {
    return this.isXs() || this.isSm();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract viewport getters used in constructor', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    const xs = this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  constructor() {
    const xs = this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract and use in callbacks', async () => {
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
  private isXs = injectIsXs();

  checkSizes() {
    setTimeout(() => {
      const xs = this.isXs();
    }, 1000);
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract and use in lifecycle hooks', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  ngOnInit() {
    const xs = this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  ngOnInit() {
    const xs = this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
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
    private isXs = injectIsXs();
constructor() {
    const xs = this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('observable properties', () => {
    it('should extract ViewportService.isXs$ into observable class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  doStuff() {
    return this.viewportService.isXs$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs$ = toObservable(injectIsXs());

  doStuff() {
    return this.isXs$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract all viewport observable properties', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.isXs$.subscribe();
    this.viewportService.isSm$.subscribe();
    this.viewportService.isMd$.subscribe();
    this.viewportService.isLg$.subscribe();
    this.viewportService.isXl$.subscribe();
    this.viewportService.is2Xl$.subscribe();
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIs2Xl, injectIsLg, injectIsMd, injectIsSm, injectIsXl, injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs$ = toObservable(injectIsXs());
  private isSm$ = toObservable(injectIsSm());
  private isMd$ = toObservable(injectIsMd());
  private isLg$ = toObservable(injectIsLg());
  private isXl$ = toObservable(injectIsXl());
  private is2Xl$ = toObservable(injectIs2Xl());

  constructor() {
    this.isXs$.subscribe();
    this.isSm$.subscribe();
    this.isMd$.subscribe();
    this.isLg$.subscribe();
    this.isXl$.subscribe();
    this.is2Xl$.subscribe();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract observable accessed in lifecycle hooks', async () => {
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
  private isXs$ = toObservable(injectIsXs());

  ngOnInit() {
    const xs$ = this.isXs$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('dimension observables', () => {
    it('should extract ViewportService.viewportSize$ into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  getSize() {
    return this.viewportService.viewportSize$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectViewportDimensions } from '@ethlete/core';

class Dummy {
  private viewportSize$ = toObservable(injectViewportDimensions());

  getSize() {
    return this.viewportSize$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract ViewportService.scrollbarSize$ into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  getScrollbar() {
    return this.viewportService.scrollbarSize$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectScrollbarDimensions } from '@ethlete/core';

class Dummy {
  private scrollbarSize$ = toObservable(injectScrollbarDimensions());

  getScrollbar() {
    return this.scrollbarSize$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract ViewportService.currentViewport$ into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  getCurrent() {
    return this.viewportService.currentViewport$;
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectCurrentBreakpoint } from '@ethlete/core';

class Dummy {
  private currentViewport$ = toObservable(injectCurrentBreakpoint());

  getCurrent() {
    return this.currentViewport$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('method calls', () => {
    it('should extract ViewportService.observe() into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  checkBreakpoint() {
    return this.viewportService.observe({ min: 'sm' });
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  private isMinSm$ = toObservable(injectObserveBreakpoint({ min: 'sm' }));

  checkBreakpoint() {
    return this.isMinSm$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract ViewportService.isMatched() into class member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  checkMatch() {
    return this.viewportService.isMatched({ max: 'sm' });
  }
}`;

      const expected = `import { injectBreakpointIsMatched } from '@ethlete/core';

class Dummy {
  private isMaxSm = injectBreakpointIsMatched({ max: 'sm' });

  checkMatch() {
    return this.isMaxSm();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract observe() called in lifecycle hooks', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  ngOnInit() {
    const obs$ = this.viewportService.observe({ min: 'lg' });
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  private isMinLg$ = toObservable(injectObserveBreakpoint({ min: 'lg' }));

  ngOnInit() {
    const obs$ = this.isMinLg$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple observe() calls with different arguments', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  checkBreakpoints() {
    const sm$ = this.viewportService.observe({ min: 'sm' });
    const lg$ = this.viewportService.observe({ max: 'lg' });
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  private isMinSm$ = toObservable(injectObserveBreakpoint({ min: 'sm' }));
  private isMaxLg$ = toObservable(injectObserveBreakpoint({ max: 'lg' }));

  checkBreakpoints() {
    const sm$ = this.isMinSm$;
    const lg$ = this.isMaxLg$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should avoid name conflicts when extracting members', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);
  private isXs = false; // existing member

  checkSize() {
    return this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private _isXs = injectIsXs();

  private isXs = false; // existing member

  checkSize() {
    return this._isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('monitorViewport and CSS variables', () => {
    it('should detect CSS variables in component inline styles', async () => {
      const tsInput = `import { Component } from '@angular/core';
import { ViewportService } from '@ethlete/core';

@Component({
  selector: 'app-test',
  template: '<div></div>',
  styles: [\`
    .container {
      width: calc(100 * var(--et-vw));
      padding: calc(1rem + var(--et-sw));
    }
  \`]
})
export class TestComponent {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.monitorViewport();
  }
}`;

      const expected = `import { Component } from '@angular/core';
import { writeScrollbarSizeToCssVariables, writeViewportSizeToCssVariables } from '@ethlete/core';

@Component({
  selector: 'app-test',
  template: '<div></div>',
  styles: [\`
    .container {
      width: calc(100 * var(--et-vw));
      padding: calc(1rem + var(--et-sw));
    }
  \`]
})
export class TestComponent {

  constructor() {
    writeViewportSizeToCssVariables();
    writeScrollbarSizeToCssVariables();
  }
}`;

      tree.write('test.component.ts', tsInput);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should remove monitorViewport() call', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.monitorViewport();
  }
}`;

      const expected = `class Dummy {

  constructor() {}
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should add writeViewportSizeToCssVariables() when --et-vw is used in CSS', async () => {
      const tsInput = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.monitorViewport();
  }
}`;

      const cssInput = `.container {
  width: calc(100 * var(--et-vw));
  height: calc(100 * var(--et-vh));
}`;

      const expected = `import { writeViewportSizeToCssVariables } from '@ethlete/core';

class Dummy {

  constructor() {
    writeViewportSizeToCssVariables();
  }
}`;

      tree.write('test.ts', tsInput);
      tree.write('test.css', cssInput);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should add writeScrollbarSizeToCssVariables() when --et-sw is used in CSS', async () => {
      const tsInput = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.monitorViewport();
  }
}`;

      const scssInput = `.scrollable {
  padding-right: calc(1rem + var(--et-sw));
  margin-bottom: calc(1rem + var(--et-sh));
}`;

      const expected = `import { writeScrollbarSizeToCssVariables } from '@ethlete/core';

class Dummy {

  constructor() {
    writeScrollbarSizeToCssVariables();
  }
}`;

      tree.write('test.ts', tsInput);
      tree.write('test.scss', scssInput);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should add both write functions when all CSS variables are used', async () => {
      const tsInput = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  constructor() {
    this.viewportService.monitorViewport();
  }
}`;

      const cssInput = `.container {
  width: calc(100 * var(--et-vw));
  height: calc(100 * var(--et-vh));
  padding: calc(1rem + var(--et-sw)) calc(1rem + var(--et-sh));
}`;

      const expected = `import { writeScrollbarSizeToCssVariables, writeViewportSizeToCssVariables } from '@ethlete/core';

class Dummy {

  constructor() {
    writeViewportSizeToCssVariables();
    writeScrollbarSizeToCssVariables();
  }
}`;

      tree.write('test.ts', tsInput);
      tree.write('test.css', cssInput);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('edge cases', () => {
    it('should remove ViewportService with readonly modifier', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private readonly _viewportService = inject(ViewportService);

  get isSmallScreen() {
    return this._viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  get isSmallScreen() {
    return this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle ViewportService with underscore prefix', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private _viewportService = inject(ViewportService);

  checkSize() {
    return this._viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  checkSize() {
    return this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle toSignal wrapped observable without toObservable', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private _viewportService = inject(ViewportService);
  protected readonly isAboveMd = toSignal(this._viewportService.observe({ min: 'md' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  protected readonly isAboveMd = injectObserveBreakpoint({ min: 'md' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should directly replace toSignal wrapped observable properties with signal', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = toSignal(this.viewportService.isXs$);
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  readonly isSmall = injectIsXs();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should directly replace toSignal wrapped observe calls with signal', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private _viewportService = inject(ViewportService);
  protected readonly isAboveMd = toSignal(this._viewportService.observe({ min: 'md' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  protected readonly isAboveMd = injectObserveBreakpoint({ min: 'md' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple toSignal usages with different breakpoints', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isAboveSm = toSignal(this.viewportService.observe({ min: 'sm' }));
  readonly isAboveLg = toSignal(this.viewportService.observe({ min: 'lg' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  readonly isAboveSm = injectObserveBreakpoint({ min: 'sm' });
  readonly isAboveLg = injectObserveBreakpoint({ min: 'lg' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should insert new members before any members that use them', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  protected readonly isAboveMd = toSignal(this._viewportService.observe({ min: 'md' }));
  private _viewportService = inject(ViewportService);
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  protected readonly isAboveMd = injectObserveBreakpoint({ min: 'md' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle mixed usage: toSignal and direct observable access', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = toSignal(this.viewportService.isXs$);

  ngOnInit() {
    this.viewportService.isXs$.subscribe(console.log);
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private isXs$ = toObservable(injectIsXs());

  readonly isSmall = toSignal(this.isXs$);

  ngOnInit() {
    this.isXs$.subscribe(console.log);
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle toSignal with observe method calls', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isMobile = toSignal(this.viewportService.observe({ max: 'sm' }));
  readonly isDesktop = toSignal(this.viewportService.observe({ min: 'lg' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  readonly isMobile = injectObserveBreakpoint({ max: 'sm' });
  readonly isDesktop = injectObserveBreakpoint({ min: 'lg' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not add toObservable import when only toSignal is used', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = toSignal(this.viewportService.isXs$);
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  readonly isSmall = injectIsXs();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      const result = tree.read('test.ts', 'utf-8')!;
      expect(result).not.toContain('toObservable');
      expect(normalizeCode(result)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle protected and public ViewportService properties', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  protected viewportService = inject(ViewportService);

  checkSize() {
    return this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  checkSize() {
    return this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle ViewportService without any modifiers', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  viewportService = inject(ViewportService);

  checkSize() {
    return this.viewportService.isXs;
  }
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  private isXs = injectIsXs();

  checkSize() {
    return this.isXs();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should directly replace toSignal wrapped observe calls without creating intermediate members', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private _viewportService = inject(ViewportService);
  protected readonly isAboveMd = toSignal(this._viewportService.observe({ min: 'md' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  protected readonly isAboveMd = injectObserveBreakpoint({ min: 'md' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should directly replace toSignal wrapped observable properties without creating intermediate members', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = toSignal(this.viewportService.isXs$);
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  readonly isSmall = injectIsXs();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should create intermediate member for toSignal wrapped observables when used multiple times', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = toSignal(this.viewportService.isXs$);
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {
  readonly isSmall = injectIsXs();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple toSignal usages of same observable without intermediate member', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isAboveMd1 = toSignal(this.viewportService.observe({ min: 'md' }));
  readonly isAboveMd2 = toSignal(this.viewportService.observe({ min: 'md' }));
}`;

      const expected = `import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  readonly isAboveMd1 = injectObserveBreakpoint({ min: 'md' });
  readonly isAboveMd2 = injectObserveBreakpoint({ min: 'md' });
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace initializers in existing property declarations', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private _viewportService = inject(ViewportService);
  protected isXs$ = this._viewportService.observe({ max: 'xs' });
  protected isMd$ = this._viewportService.observe({ max: 'md' });
  protected isBase$ = this._viewportService.observe({ min: 'lg', max: 'lg' });
  protected isAboveBase$ = this._viewportService.observe({ min: 'lg' });
  protected isAboveXl$ = this._viewportService.observe({ min: 'xl' });
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  protected isXs$ = toObservable(injectObserveBreakpoint({ max: 'xs' }));
  protected isMd$ = toObservable(injectObserveBreakpoint({ max: 'md' }));
  protected isBase$ = toObservable(injectObserveBreakpoint({ min: 'lg', max: 'lg' }));
  protected isAboveBase$ = toObservable(injectObserveBreakpoint({ min: 'lg' }));
  protected isAboveXl$ = toObservable(injectObserveBreakpoint({ min: 'xl' }));
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace initializers for signal properties', async () => {
      const input = `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);
  readonly isSmall = this.viewportService.isXs;
  readonly isMedium = this.viewportService.isMd;
}`;

      const expected = `import { injectIsMd, injectIsXs } from '@ethlete/core';

class Dummy {
  readonly isSmall = injectIsXs();
  readonly isMedium = injectIsMd();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle complex service with multiple ViewportService usages', async () => {
      const input = `import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { Injectable } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ViewportService } from '@ethlete/core';
import { BehaviorSubject, combineLatest, filter, fromEvent, map, Observable, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShellService {
  private _isNavigationOpen$ = new BehaviorSubject(false);

  get isNavigationOpen$() {
    return this._isNavigationOpen$.asObservable();
  }

  navigationAlwaysOpen$ = this._viewportService.observe({ min: 'md' });
  sidebarAlwaysOpen$ = this._viewportService.observe({ min: 'lg' });
  navigationCanCollapse$ = this._viewportService.observe({ min: 'md', max: 'lg' });

  inertMap$: Observable<InertMap> = combineLatest([this.isNavigationOpen$, this.navigationAlwaysOpen$]).pipe(
    map(([isNavigationOpen, navigationAlwaysOpen]) => {
      return {
        content: false,
        navigation: false,
        sidebar: false,
      };
    }),
  );

  constructor(
    private _viewportService: ViewportService,
    private _scrollDispatcher: ScrollDispatcher,
  ) {}

  blockScrolling() {
    const scrollContainers = this._scrollDispatcher.scrollContainers;

    for (const [scrollable] of scrollContainers) {
      const offsetX = scrollable.measureScrollOffset('left');
      const offsetY = scrollable.measureScrollOffset('top');

      const isSmOrBelow = this._viewportService.isSm || this._viewportService.isXs;
      const isLgOrAbove = this._viewportService.isLg || this._viewportService.isXl;

      const headerYOffset = isSmOrBelow ? 60 : 100;
    }
  }

  unblockScrolling() {
    const scrollContainers = this._scrollDispatcher.scrollContainers;

    for (const [scrollable] of scrollContainers) {
      const isSmOrBelow = this._viewportService.isSm || this._viewportService.isXs;
      const isLgOrAbove = this._viewportService.isLg || this._viewportService.isXl;

      const headerOffset = isSmOrBelow ? 60 : 100;
    }
  }
}`;

      const expected = `import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { Injectable } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectIsLg, injectIsSm, injectIsXl, injectIsXs, injectObserveBreakpoint } from '@ethlete/core';
import { BehaviorSubject, combineLatest, filter, fromEvent, map, Observable, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShellService {
    private isSm = injectIsSm();
  private isXs = injectIsXs();
  private isLg = injectIsLg();
  private isXl = injectIsXl();
private _isNavigationOpen$ = new BehaviorSubject(false);

  get isNavigationOpen$() {
    return this._isNavigationOpen$.asObservable();
  }

  navigationAlwaysOpen$ = toObservable(injectObserveBreakpoint({ min: 'md' }));
  sidebarAlwaysOpen$ = toObservable(injectObserveBreakpoint({ min: 'lg' }));
  navigationCanCollapse$ = toObservable(injectObserveBreakpoint({ min: 'md', max: 'lg' }));

  inertMap$: Observable<InertMap> = combineLatest([this.isNavigationOpen$, this.navigationAlwaysOpen$]).pipe(
    map(([isNavigationOpen, navigationAlwaysOpen]) => {
      return {
        content: false,
        navigation: false,
        sidebar: false,
      };
    }),
  );

  constructor(private _scrollDispatcher: ScrollDispatcher) {}

  blockScrolling() {
    const scrollContainers = this._scrollDispatcher.scrollContainers;

    for (const [scrollable] of scrollContainers) {
      const offsetX = scrollable.measureScrollOffset('left');
      const offsetY = scrollable.measureScrollOffset('top');

      const isSmOrBelow = this.isSm() || this.isXs();
      const isLgOrAbove = this.isLg() || this.isXl();

      const headerYOffset = isSmOrBelow ? 60 : 100;
    }
  }

  unblockScrolling() {
    const scrollContainers = this._scrollDispatcher.scrollContainers;

    for (const [scrollable] of scrollContainers) {
      const isSmOrBelow = this.isSm() || this.isXs();
      const isLgOrAbove = this.isLg() || this.isXl();

      const headerOffset = isSmOrBelow ? 60 : 100;
    }
  }
}`;

      tree.write('shell.service.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('shell.service.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should replace property initializer with observable pipe chain', async () => {
      const input = `import { ViewportService } from '@ethlete/core';
import { map } from 'rxjs';

class Dummy {
  private _viewportService = inject(ViewportService);
  
  protected readonly tableRows$ = this._viewportService.observe({ min: 'md' }).pipe(
    map((isMdMin) => {
      if (isMdMin) {
        return ['title', 'updatedAt', '_actions'];
      }

      return ['title', '_actions'];
    }),
  );
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';
import { map } from 'rxjs';

class Dummy {

  protected readonly tableRows$ = toObservable(injectObserveBreakpoint({ min: 'md' })).pipe(
    map((isMdMin) => {
      if (isMdMin) {
        return ['title', 'updatedAt', '_actions'];
      }

      return ['title', '_actions'];
    }),
  );
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle project-based ViewportService with build() method', async () => {
      const input = `import { ViewportService } from '@fifa-gg/uikit/core';

class Dummy {
  private _viewportService = inject(ViewportService);
  
  navigationAlwaysOpen$ = this._viewportService.build({ min: 'md' });
  sidebarAlwaysOpen$ = this._viewportService.build({ min: 'lg' });
  
  someMethod() {
    this._viewportService.build({ max: 'sm' }).subscribe(console.log);
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';

class Dummy {
  private isMaxSm$ = toObservable(injectObserveBreakpoint({ max: 'sm' }));

  navigationAlwaysOpen$ = toObservable(injectObserveBreakpoint({ min: 'md' }));
  sidebarAlwaysOpen$ = toObservable(injectObserveBreakpoint({ min: 'lg' }));
  
  someMethod() {
    this.isMaxSm$.subscribe(console.log);
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle build() method with pipe chains', async () => {
      const input = `import { ViewportService } from '@fifa-gg/uikit/core';
import { map } from 'rxjs';

class Dummy {
  private _viewportService = inject(ViewportService);
  
  protected readonly tableColumns$ = this._viewportService.build({ min: 'lg' }).pipe(
    map((isLgMin) => {
      if (isLgMin) {
        return ['id', 'name', 'email', 'actions'];
      }
      return ['name', 'actions'];
    }),
  );
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';
import { map } from 'rxjs';

class Dummy {

  protected readonly tableColumns$ = toObservable(injectObserveBreakpoint({ min: 'lg' })).pipe(
    map((isLgMin) => {
      if (isLgMin) {
        return ['id', 'name', 'email', 'actions'];
      }
      return ['name', 'actions'];
    }),
  );
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle build() method with constructor parameter injection', async () => {
      const input = `import { Inject } from '@angular/core';
import { ViewportService } from '@fifa-gg/uikit/core';

class Dummy {
  isMdMin$ = this._viewportService.build({ min: 'md' });

  constructor(
    @Inject(LAYOUT_DEFAULT) public layout: LayoutDefaultComponent,
    private _viewportService: ViewportService,
    private _competitionDataService: CompetitionDataService,
    private _competitionDataSeedingService: CompetitionDataSeedingService,
  ) {}

  someMethod() {
    return this.isMdMin$.pipe(map(x => x));
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectObserveBreakpoint } from '@ethlete/core';
import { Inject } from '@angular/core';

class Dummy {
  isMdMin$ = toObservable(injectObserveBreakpoint({ min: 'md' }));

  constructor(@Inject(LAYOUT_DEFAULT) public layout: LayoutDefaultComponent, private _competitionDataService: CompetitionDataService, private _competitionDataSeedingService: CompetitionDataSeedingService) {}

  someMethod() {
    return this.isMdMin$.pipe(map(x => x));
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle toSignal with inline inject(ViewportService)', async () => {
      const input = `import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ViewportService } from '@ethlete/core';

class Dummy {
  protected readonly isXs = toSignal(inject(ViewportService).isXs$);
}`;

      const expected = `import { inject } from '@angular/core';
import { injectIsXs } from '@ethlete/core';

class Dummy {
  protected readonly isXs = injectIsXs();
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle toSignal with observe in property initializer and constructor with decorator', async () => {
      const input = `import { Inject } from '@angular/core';
import { ViewportService } from '@ethlete/core';
import { toSignal } from '@angular/core/rxjs-interop';

export class RescheduleRoundDialogComponent implements OnInit {
  private readonly _viewportService = inject(ViewportService);

  protected readonly isMdUp = toSignal(this._viewportService.observe({ min: 'md' }));

  constructor(
    @Inject(OVERLAY_DATA) public data: RescheduleRoundOverlayData | null,
    private _competitionStageFacade: CompetitionStageFacade,
    private _notificationService: NotificationService,
    private _competitionDataService: CompetitionDataService,
  ) {}

  ngOnInit(): void {
    this.competitionData$ = this._competitionDataService.competitionData$;
    this.initializeForm();
  }
}`;

      const expected = `import { Inject } from '@angular/core';
import { injectObserveBreakpoint } from '@ethlete/core';

export class RescheduleRoundDialogComponent implements OnInit {

  protected readonly isMdUp = injectObserveBreakpoint({ min: 'md' });

  constructor(@Inject(OVERLAY_DATA) public data: RescheduleRoundOverlayData | null, private _competitionStageFacade: CompetitionStageFacade, private _notificationService: NotificationService, private _competitionDataService: CompetitionDataService) {}

  ngOnInit(): void {
    this.competitionData$ = this._competitionDataService.competitionData$;
    this.initializeForm();
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle observable property with pipe chain using currentViewport$', async () => {
      const input = `import { ViewportService } from '@fifa-gg/uikit/core';
import { debounceTime, map } from 'rxjs';

export class CompetitionProductsComponent implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _viewportService = inject(ViewportService);
  private readonly _stageHelperService = inject(StageHelperService);

  private readonly _productsPerPage$ = this._viewportService.currentViewport$.pipe(
    debounceTime(0),
    map((vp) => {
      if (vp === 'xs' || vp === 'sm') {
        return 2;
      }

      if (vp === 'md') {
        return 3;
      }

      return 4;
    }),
  );

  ngOnInit(): void {
    this._productsPerPage$.subscribe(console.log);
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectCurrentBreakpoint } from '@ethlete/core';
import { debounceTime, map } from 'rxjs';

export class CompetitionProductsComponent implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _stageHelperService = inject(StageHelperService);

  private readonly _productsPerPage$ = toObservable(injectCurrentBreakpoint()).pipe(
    debounceTime(0),
    map((vp) => {
      if (vp === 'xs' || vp === 'sm') {
        return 2;
      }

      if (vp === 'md') {
        return 3;
      }

      return 4;
    }),
  );

  ngOnInit(): void {
    this._productsPerPage$.subscribe(console.log);
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle observable properties assigned in ngOnInit', async () => {
      const input = `import { ViewportService } from '@fifa-gg/uikit/core';

export class StreamBannerComponent implements OnInit {
  private _viewportService = inject(ViewportService);
  isBase$!: Observable<boolean>;
  isLgUp$!: Observable<boolean>;

  ngOnInit(): void {
    this.isBase$ = this._viewportService.isBase$;
    this.isLgUp$ = this._viewportService.build({ min: 'lg' });
  }
}`;

      const expected = `import { toObservable } from '@angular/core/rxjs-interop';
import { injectIsLg, injectObserveBreakpoint } from '@ethlete/core';


export class StreamBannerComponent implements OnInit {
  private _isBase$ = toObservable(injectIsLg());
  private isMinLg$ = toObservable(injectObserveBreakpoint({ min: 'lg' }));

  isBase$!: Observable<boolean>;
  isLgUp$!: Observable<boolean>;

  ngOnInit(): void {
    this.isBase$ = this._isBase$;
    this.isLgUp$ = this.isMinLg$;
  }
}`;

      tree.write('test.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
