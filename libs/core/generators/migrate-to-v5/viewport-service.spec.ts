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

  describe('provideViewportConfig migration', () => {
    it('should replace provideViewportConfig with provideBreakpointObserver', async () => {
      const input = `import { ApplicationConfig } from '@angular/core';
import { provideViewportConfig } from '@ethlete/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideViewportConfig({
      breakpoints: {
        sm: 640,
        md: 768,
        lg: 1024,
      },
    }),
  ],
};`;

      const expected = `import { ApplicationConfig } from '@angular/core';
import { provideBreakpointObserver } from '@ethlete/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBreakpointObserver({
      breakpoints: {
        sm: 640,
        md: 768,
        lg: 1024,
      },
    }),
  ],
};`;

      tree.write('app.config.ts', input);
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('app.config.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should add provideBreakpointObserver if no provideViewportConfig exists', async () => {
      const input = `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
  ],
};`;

      const expected = `import { provideBreakpointObserver } from '@ethlete/core';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideBreakpointObserver(),
  ],
};`;

      tree.write('app.config.ts', input);
      tree.write(
        'some-component.ts',
        `import { ViewportService } from '@ethlete/core';
class Test {
  private vs = inject(ViewportService);
}`,
      );
      await migrateViewportService(tree);

      expect(normalizeCode(tree.read('app.config.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should not add provideBreakpointObserver if ViewportService is not used anywhere', async () => {
      const input = `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
  ],
};`;

      tree.write('app.config.ts', input);
      await migrateViewportService(tree);

      expect(tree.read('app.config.ts', 'utf-8')).toBe(input);
    });
  });
});
