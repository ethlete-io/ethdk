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
}`;

      const expected = `import { injectIsXs } from '@ethlete/core';

class Dummy {

  get isSmallScreen() {
    return injectIsXs()();
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
});
