import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migrateOverlayPositions from './overlay-positions';

describe('migrate-to-v5 -> overlay positions', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    tree.write(
      'project.json',
      JSON.stringify({
        name: 'test',
        root: '.',
        sourceRoot: '.',
      }),
    );

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

  describe('service injection', () => {
    it('should migrate inject(OverlayService) to injectOverlayManager()', async () => {
      tree.write(
        'test.ts',
        `
        import { OverlayService } from '@ethlete/cdk';
        
        const overlayService = inject(OverlayService);
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('const overlayService = injectOverlayManager();');
      expect(content).not.toContain('inject(OverlayService)');
    });

    it('should preserve other imports from @ethlete/cdk', async () => {
      tree.write(
        'test.ts',
        `
        import { OverlayService, SomeOtherImport } from '@ethlete/cdk';
        
        const overlayService = inject(OverlayService);
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { SomeOtherImport, injectOverlayManager } from '@ethlete/cdk';");
    });
  });

  describe('config property rename', () => {
    it('should rename positions to strategies', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.dialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('strategies: dialogOverlayStrategy()');
      expect(content).not.toContain('positions:');
    });
  });

  describe('position method to strategy function', () => {
    it('should migrate dialog() to dialogOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        import { OverlayService } from '@ethlete/cdk';
        
        const overlayService = inject(OverlayService);
        overlayService.open(Component, {
          positions: overlayService.positions.dialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('dialogOverlayStrategy()');
      expect(content).not.toContain('overlayService.positions.dialog()');
    });

    it('should migrate bottomSheet() to bottomSheetOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.bottomSheet({ maxWidth: '35rem' })
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("bottomSheetOverlayStrategy({ maxWidth: '35rem' })");
    });

    it('should migrate leftSheet() to leftSheetOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.leftSheet()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('leftSheetOverlayStrategy()');
    });

    it('should migrate rightSheet() to rightSheetOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.rightSheet()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('rightSheetOverlayStrategy()');
    });

    it('should migrate topSheet() to topSheetOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.topSheet()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('topSheetOverlayStrategy()');
    });

    it('should migrate fullScreenDialog() to fullScreenDialogOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.fullScreenDialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('fullScreenDialogOverlayStrategy()');
    });

    it('should migrate anchoredDialog() to anchoredDialogOverlayStrategy()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.anchoredDialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('anchoredDialogOverlayStrategy()');
    });
  });

  describe('transforming methods', () => {
    it('should migrate transformingBottomSheetToDialog()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.transformingBottomSheetToDialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('transformingBottomSheetToDialogOverlayStrategy()');
    });

    it('should migrate transformingFullScreenDialogToRightSheet()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.transformingFullScreenDialogToRightSheet()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('transformingFullScreenDialogToRightSheetOverlayStrategy()');
    });

    it('should migrate transformingFullScreenDialogToDialog()', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          positions: overlayService.positions.transformingFullScreenDialogToDialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('transformingFullScreenDialogToDialogOverlayStrategy()');
    });

    it('should migrate transforming methods with custom config', async () => {
      tree.write(
        'test.ts',
        `
    overlayService.open(Component, {
      positions: overlayService.positions.transformingBottomSheetToDialog({
        dialog: { maxWidth: '600px' },
        breakpoint: 'lg'
      })
    });
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain("dialog: { maxWidth: '600px' }");
      expect(content).toContain("breakpoint: 'lg'");
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy');
    });
  });

  describe('DEFAULTS migration', () => {
    it('should migrate positions.DEFAULTS.dialog to factory function', async () => {
      tree.write(
        'test.ts',
        `
      import { OverlayService } from '@ethlete/cdk';
      
      const overlayService = inject(OverlayService);
      overlayService.open(Component, {
        positions: [
          { config: overlayService.positions.DEFAULTS.dialog }
        ]
      });
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectDialogStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('strategies: () => {');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain('{ strategy: dialogStrategy.build() }');
    });

    it('should migrate positions.DEFAULTS.bottomSheet', async () => {
      tree.write(
        'test.ts',
        `
  import { OverlayService } from '@ethlete/cdk';
  
  const overlayService = inject(OverlayService);
  overlayService.open(Component, {
    positions: [
      { config: overlayService.positions.DEFAULTS.bottomSheet }
    ]
  });
  `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectBottomSheetStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('const bottomSheetStrategy = injectBottomSheetStrategy();');
      expect(content).toContain('{ strategy: bottomSheetStrategy.build() }');
    });

    it('should handle DEFAULTS with breakpoints', async () => {
      tree.write(
        'test.ts',
        `
  import { OverlayService } from '@ethlete/cdk';
  
  const overlayService = inject(OverlayService);
  overlayService.open(Component, {
    positions: [
      { config: overlayService.positions.DEFAULTS.bottomSheet },
      { breakpoint: 'md', config: overlayService.positions.DEFAULTS.dialog }
    ]
  });
  `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain(
        "import { injectBottomSheetStrategy, injectDialogStrategy, injectOverlayManager } from '@ethlete/cdk';",
      );
      expect(content).toContain('strategies: () => {');
      expect(content).toContain('const bottomSheetStrategy = injectBottomSheetStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain("{ breakpoint: 'md', strategy: dialogStrategy.build() }");
    });

    it('should import all necessary strategy injectors', async () => {
      tree.write(
        'test.ts',
        `
  import { OverlayService } from '@ethlete/cdk';
  
  const overlayService = inject(OverlayService);
  overlayService.open(Component, {
    positions: [
      { config: overlayService.positions.DEFAULTS.dialog },
      { breakpoint: 'sm', config: overlayService.positions.DEFAULTS.bottomSheet },
      { breakpoint: 'md', config: overlayService.positions.DEFAULTS.leftSheet },
      { breakpoint: 'lg', config: overlayService.positions.DEFAULTS.rightSheet }
    ]
  });
  `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('injectDialogStrategy');
      expect(content).toContain('injectBottomSheetStrategy');
      expect(content).toContain('injectLeftSheetStrategy');
      expect(content).toContain('injectRightSheetStrategy');
    });
  });

  describe('mergeConfigs migration', () => {
    it('should migrate mergeConfigs to mergeOverlayBreakpointConfigs', async () => {
      tree.write(
        'test.ts',
        `
      import { OverlayService } from '@ethlete/cdk';
      
      const config = overlayService.positions.mergeConfigs(
        overlayService.positions.DEFAULTS.dialog,
        extraConfig
      );
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectOverlayManager, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';");
      expect(content).toContain('mergeOverlayBreakpointConfigs(');
      expect(content).not.toContain('overlayService.positions.mergeConfigs');
    });

    it('should migrate mergeConfigs in strategy build call', async () => {
      tree.write(
        'test.ts',
        `
  import { OverlayService } from '@ethlete/cdk';
  
  const overlayService = inject(OverlayService);
  overlayService.open(Component, {
    positions: [
      { 
        config: overlayService.positions.mergeConfigs(
          overlayService.positions.DEFAULTS.dialog,
          { maxWidth: '800px' }
        )
      }
    ]
  });
  `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain(
        "import { injectDialogStrategy, injectOverlayManager, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';",
      );
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain("strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs({ maxWidth: '800px' }");
    });
  });

  describe('type migrations', () => {
    it('should migrate OverlayBreakpointConfigEntry to OverlayStrategyBreakpoint', async () => {
      tree.write(
        'test.ts',
        `
    import { OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';
    
    export class MyClass {
      private overlayService = inject(OverlayService);
      
      private helper(): OverlayBreakpointConfigEntry[] {
        return [{ config: this.overlayService.positions.DEFAULTS.dialog }];
      }
    }
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain(
        "import { OverlayStrategyBreakpoint, injectDialogStrategy, injectOverlayManager } from '@ethlete/cdk';",
      );
      expect(content).toContain('private overlayService = injectOverlayManager();');
      expect(content).toContain('private helper(): () => OverlayStrategyBreakpoint[] {');
      expect(content).toContain('return () => {');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain('{ strategy: dialogStrategy.build() }');
      expect(content).not.toContain('OverlayBreakpointConfigEntry');
    });

    it('should update return type when using DEFAULTS', async () => {
      tree.write(
        'test.ts',
        `
    import { OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';
    
    export class MyClass {
      private overlayService = inject(OverlayService);
      
      private getPositions(): OverlayBreakpointConfigEntry[] {
        return [
          { config: this.overlayService.positions.DEFAULTS.bottomSheet }
        ];
      }
    }
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain(
        "import { OverlayStrategyBreakpoint, injectBottomSheetStrategy, injectOverlayManager } from '@ethlete/cdk';",
      );
      expect(content).toContain('private getPositions(): () => OverlayStrategyBreakpoint[] {');
      expect(content).toContain('return () => {');
      expect(content).toContain('const bottomSheetStrategy = injectBottomSheetStrategy();');
    });
  });

  describe('helper method migrations', () => {
    it('should wrap helper method return in factory function', async () => {
      tree.write(
        'test.ts',
        `
    import { OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';
    
    export class MyClass {
      private overlayService = inject(OverlayService);
      
      private getConfig(): OverlayBreakpointConfigEntry[] {
        return [
          { config: this.overlayService.positions.DEFAULTS.dialog }
        ];
      }
      
      openOverlay() {
        this.overlayService.open(Component, {
          positions: this.getConfig()
        });
      }
    }
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('private getConfig(): () => OverlayStrategyBreakpoint[] {');
      expect(content).toContain('return () => {');
      expect(content).toContain('strategies: this.getConfig()');
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple overlayService calls in one file', async () => {
      tree.write(
        'test.ts',
        `
        import { OverlayService } from '@ethlete/cdk';
        
        const overlayService = inject(OverlayService);
        
        overlayService.open(Component1, {
          positions: overlayService.positions.dialog()
        });
        
        overlayService.open(Component2, {
          positions: overlayService.positions.bottomSheet()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('injectOverlayManager()');
      expect(content).toContain('dialogOverlayStrategy()');
      expect(content).toContain('bottomSheetOverlayStrategy()');
    });

    it('should handle nested config objects', async () => {
      tree.write(
        'test.ts',
        `
        const config = {
          positions: overlayService.positions.dialog({
            maxWidth: '600px',
            containerClass: 'custom-class'
          })
        };
        
        overlayService.open(Component, config);
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('strategies: dialogOverlayStrategy');
      expect(content).toContain("maxWidth: '600px'");
      expect(content).toContain("containerClass: 'custom-class'");
    });

    it('should preserve comments and formatting', async () => {
      tree.write(
        'test.ts',
        `
        overlayService.open(Component, {
          // Configure dialog position
          positions: overlayService.positions.dialog()
        });
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('// Configure dialog position');
    });
  });

  describe('edge cases', () => {
    it('should migrate readonly inject with helper method returning OverlayBreakpointConfigEntry[] and usage in open call', async () => {
      tree.write(
        'test.ts',
        `
import { OverlayService, OverlayBreakpointConfig, OverlayBreakpointConfigEntry } from '@ethlete/cdk';

class Example {
  readonly _dialogService = inject(OverlayService);

  _transformingFullscreenDialogToDialog(extraConfig: OverlayBreakpointConfig = {}): OverlayBreakpointConfigEntry[] {
    return [
      {
        config: this._dialogService.positions.DEFAULTS.bottomSheet,
      },
      {
        breakpoint: 'sm',
        config: this._dialogService.positions.mergeConfigs(
          this._dialogService.positions.DEFAULTS.dialog,
          OVERLAY_CONFIG,
          extraConfig,
        ),
      },
    ];
  }

  showConfirmDialog(data: ConfirmDialogData) {
    return this._dialogService.open<ConfirmDialogComponent, ConfirmDialogData, ConfirmDialogResult>(
      ConfirmDialogComponent,
      {
        positions: this._transformingFullscreenDialogToDialog({}),
        data: data,
      },
    );
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain(
        "import { OverlayBreakpointConfig, OverlayStrategyBreakpoint, injectBottomSheetStrategy, injectDialogStrategy, injectOverlayManager, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';",
      );

      // Check readonly field injection is preserved and migrated
      expect(content).toContain('readonly _dialogService = injectOverlayManager();');
      expect(content).not.toContain('inject(OverlayService)');

      // Check helper method return type changed to factory function
      expect(content).toContain(
        '_transformingFullscreenDialogToDialog(extraConfig: OverlayBreakpointConfig = {}): () => OverlayStrategyBreakpoint[] {',
      );

      // Check factory function structure
      expect(content).toContain('return () => {');
      expect(content).toContain('const bottomSheetStrategy = injectBottomSheetStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');

      // Check DEFAULTS migration
      expect(content).toContain('strategy: bottomSheetStrategy.build()');

      // Check mergeConfigs migration with multiple arguments
      expect(content).toContain("breakpoint: 'sm',");
      expect(content).toContain('strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs(OVERLAY_CONFIG,');

      // Check that the calling code is properly migrated
      expect(content).toContain('strategies: this._transformingFullscreenDialogToDialog({})');

      // Check that data property is preserved
      expect(content).toContain('data: data,');

      // Verify generic types are preserved in open call
      expect(content).toContain(
        'this._dialogService.open<ConfirmDialogComponent, ConfirmDialogData, ConfirmDialogResult>(',
      );

      // Verify no syntax corruption
      expect(content).not.toContain('})onfig');
      expect(content).not.toContain('positions:');
    });

    it('should migrate builder pattern with DEFAULTS and mergeConfigs', async () => {
      tree.write(
        'test.ts',
        `
import { createOverlayHandler } from '@ethlete/cdk';

export const createSelectGroupOverlayComponentOverlayHandler = createOverlayHandler<
  SelectGroupOverlayComponent,
  SelectGroupOverlayData,
  null
>({
  component: SelectGroupOverlayComponent,
  positions: (builder) => [
    {
      config: builder.DEFAULTS.fullScreenDialog,
    },
    {
      breakpoint: 'md',
      config: builder.mergeConfigs(builder.DEFAULTS.dialog, {
        maxHeight: 'min(calc(100% - 5rem), 80rem)',
        maxWidth: 'min(calc(100% - 5rem), 80rem)',
        width: '100%',
      }),
    },
  ],
});
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain(
        "import { createOverlayHandler, injectDialogStrategy, injectFullscreenDialogStrategy, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';",
      );

      // Check positions changed to strategies with factory function
      expect(content).toContain('strategies: () => {');
      expect(content).toContain('const fullscreenDialogStrategy = injectFullscreenDialogStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');

      // Check DEFAULTS.fullScreenDialog migration
      expect(content).toContain('strategy: fullscreenDialogStrategy.build()');

      // Check mergeConfigs migration
      expect(content).toContain("breakpoint: 'md',");
      expect(content).toContain('strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs({');
      expect(content).toContain("maxHeight: 'min(calc(100% - 5rem), 80rem)'");
      expect(content).toContain("maxWidth: 'min(calc(100% - 5rem), 80rem)'");
      expect(content).toContain("width: '100%'");

      // Verify builder pattern is removed
      expect(content).not.toContain('(builder) =>');
      expect(content).not.toContain('builder.DEFAULTS');
      expect(content).not.toContain('builder.mergeConfigs');

      // Verify generic types are preserved
      expect(content).toContain('createOverlayHandler<');
      expect(content).toContain('SelectGroupOverlayComponent,');
      expect(content).toContain('SelectGroupOverlayData,');
      expect(content).toContain('null');

      // Verify no syntax corruption
      expect(content).not.toContain('})onfig');
      expect(content).not.toContain('positions:');
    });

    it('should handle files without overlay usage', async () => {
      tree.write(
        'test.ts',
        `
        import { Component } from '@angular/core';
        
        @Component({
          selector: 'app-test'
        })
        export class TestComponent {}
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { Component } from '@angular/core';");
    });

    it('should not modify non-overlay positions property', async () => {
      tree.write(
        'test.ts',
        `
        const someObject = {
          positions: [1, 2, 3]
        };
        `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('positions: [1, 2, 3]');
    });

    it('should handle multiple files', async () => {
      tree.write('file1.ts', `import { OverlayService } from '@ethlete/cdk';`);
      tree.write(
        'file2.ts',
        `
        import { OverlayService } from '@ethlete/cdk';
        const overlayService = inject(OverlayService);
        `,
      );

      await migrateOverlayPositions(tree);

      expect(tree.read('file1.ts', 'utf-8')).toContain('injectOverlayManager');
      expect(tree.read('file2.ts', 'utf-8')).toContain('injectOverlayManager()');
    });
  });

  describe('preset strategy imports', () => {
    it('should not add inject imports for preset strategy functions', async () => {
      tree.write(
        'test.ts',
        `
      import { OverlayService } from '@ethlete/cdk';
      
      overlayService.open(Component, {
        positions: overlayService.positions.dialog()
      });
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).not.toContain('injectDialogStrategy');
    });

    it('should import transforming preset functions', async () => {
      tree.write(
        'test.ts',
        `
      import { OverlayService } from '@ethlete/cdk';
      
      overlayService.open(Component, {
        positions: overlayService.positions.transformingBottomSheetToDialog()
      });
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain(
        "import { injectOverlayManager, transformingBottomSheetToDialogOverlayStrategy } from '@ethlete/cdk';",
      );
    });
  });

  describe('formatting preservation', () => {
    it('should preserve empty lines between class members', async () => {
      tree.write(
        'test.ts',
        `import { OverlayService } from '@ethlete/cdk';

export class MyClass {
  overlayRef = inject(OverlayService);
  overlayData = inject(OverlayService);

  statusQuery = someQuery.createSignal();
  statusResponse = queryStateResponseSignal(this.statusQuery);

  form = new FormGroup({
    status: new FormControl('pending'),
  });

  openOverlay() {
    this.overlayRef.open(Component, {
      positions: this.overlayRef.positions.dialog()
    });
  }
}`,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8')!;

      // Split by lines and check for empty lines
      const lines = content.split('\n')!;

      // Find the line with overlayData
      const overlayDataIndex = lines.findIndex((l) => l.includes('overlayData'));
      const statusQueryIndex = lines.findIndex((l) => l.includes('statusQuery'));
      const statusResponseIndex = lines.findIndex((l) => l.includes('statusResponse'));
      const formIndex = lines.findIndex((l) => l.includes('form ='));

      // Check that there's an empty line after overlayData (before statusQuery)
      expect(lines[overlayDataIndex + 1]).toBe('');

      // Check that statusQuery and statusResponse are adjacent (no empty line)
      expect(statusResponseIndex).toBe(statusQueryIndex + 1);

      // Check that there's an empty line after statusResponse (before form)
      expect(lines[statusResponseIndex + 1]).toBe('');

      // Verify the transformation happened
      expect(content).toContain('injectOverlayManager()');
      expect(content).toContain('strategies: dialogOverlayStrategy()');
    });

    it('should preserve empty lines in complex class structure', async () => {
      tree.write(
        'test.ts',
        `import { OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';

export class ComplexClass {
  private overlayService = inject(OverlayService);

  private config: OverlayBreakpointConfigEntry[] = [
    { config: this.overlayService.positions.DEFAULTS.dialog }
  ];

  private anotherProperty = 'value';

  constructor() {}

  private getPositions(): OverlayBreakpointConfigEntry[] {
    return [
      { config: this.overlayService.positions.DEFAULTS.bottomSheet }
    ];
  }

  openOverlay() {
    this.overlayService.open(Component, {
      positions: this.getPositions()
    });
  }
}`,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8')!;

      const lines = content.split('\n');

      // Find key lines
      const overlayServiceIndex = lines.findIndex((l) => l.includes('private overlayService'));
      const anotherPropertyIndex = lines.findIndex((l) => l.includes('private anotherProperty'));
      const getPositionsIndex = lines.findIndex((l) => l.includes('private getPositions()'));

      // Verify empty lines are preserved between property groups
      expect(lines[overlayServiceIndex + 1]).toBe(''); // Empty line after overlayService

      // Empty line after anotherProperty, before constructor
      expect(lines[anotherPropertyIndex + 1]).toBe('');

      // Empty line after constructor, before getPositions

      // Empty line after getPositions, before openOverlay
      const getPositionsEndIndex = lines.findIndex(
        (l, i) => i > getPositionsIndex && l.trim() === '}' && !l.includes('class'),
      );
      expect(lines[getPositionsEndIndex + 1]).toBe('');

      // Verify transformations happened
      expect(content).toContain('injectOverlayManager()');
      expect(content).toContain('OverlayStrategyBreakpoint');
      expect(content).toContain('strategies: this.getPositions()');
    });

    it('should not add extra empty lines where there were none', async () => {
      tree.write(
        'test.ts',
        `import { OverlayService } from '@ethlete/cdk';
export class CompactClass {
  overlayService = inject(OverlayService);
  anotherProperty = 'value';
  thirdProperty = 'value';
}`,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8')!;
      const lines = content.split('\n');

      // Find property lines
      const overlayServiceIndex = lines.findIndex((l) => l.includes('overlayService'));
      const anotherPropertyIndex = lines.findIndex((l) => l.includes('anotherProperty'));
      const thirdPropertyIndex = lines.findIndex((l) => l.includes('thirdProperty'));

      // Verify no empty lines between properties (they should be adjacent)
      expect(anotherPropertyIndex).toBe(overlayServiceIndex + 1);
      expect(thirdPropertyIndex).toBe(anotherPropertyIndex + 1);

      // Verify transformation
      expect(content).toContain('injectOverlayManager()');
    });

    it('should preserve multiple consecutive empty lines', async () => {
      tree.write(
        'test.ts',
        `import { OverlayService } from '@ethlete/cdk';

export class MyClass {
  overlayService = inject(OverlayService);


  anotherProperty = 'value';
}`,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8')!;
      const lines = content.split('\n');

      // Find the overlayService line
      const overlayServiceIndex = lines.findIndex((l) => l.includes('overlayService'));

      // Check for two consecutive empty lines
      expect(lines[overlayServiceIndex + 1]).toBe('');
      expect(lines[overlayServiceIndex + 2]).toBe('');

      // Verify transformation
      expect(content).toContain('injectOverlayManager()');
    });

    it('should preserve empty lines before and after methods', async () => {
      tree.write(
        'test.ts',
        `import { OverlayService } from '@ethlete/cdk';

export class MyClass {
  private overlayService = inject(OverlayService);

  ngOnInit() {
    console.log('init');
  }

  openOverlay() {
    this.overlayService.open(Component, {
      positions: this.overlayService.positions.dialog()
    });
  }

  ngOnDestroy() {
    console.log('destroy');
  }
}`,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8')!;
      const lines = content.split('\n');

      // Find method markers
      const overlayServiceIndex = lines.findIndex((l) => l.includes('private overlayService'));
      const ngOnInitIndex = lines.findIndex((l) => l.includes('ngOnInit()'));

      // Verify empty lines
      expect(lines[overlayServiceIndex + 1]).toBe(''); // After property

      const ngOnInitEnd = lines.findIndex((l, i) => i > ngOnInitIndex && l.trim() === '}');
      expect(lines[ngOnInitEnd + 1]).toBe(''); // After ngOnInit

      // Verify transformation
      expect(content).toContain('injectOverlayManager()');
      expect(content).toContain('strategies: dialogOverlayStrategy()');
    });
  });

  describe('builder pattern migrations', () => {
    it('should migrate builder pattern with regular strategy', async () => {
      tree.write(
        'test.ts',
        `
import { createOverlayHandlerWithQueryParamLifecycle } from '@ethlete/cdk';

export const setupMatchOverlayHandler = createOverlayHandlerWithQueryParamLifecycle({
  component: MatchOverlayHostComponent,
  positions: (builder) => builder.rightSheet({ maxWidth: 800, dragToDismiss: undefined }),
  queryParamKey: 'match',
});
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain(
        "import { createOverlayHandlerWithQueryParamLifecycle, rightSheetOverlayStrategy } from '@ethlete/cdk'",
      );
      expect(content).toContain('strategies: rightSheetOverlayStrategy({ maxWidth: 800, dragToDismiss: undefined })');
      expect(content).not.toContain('(builder) =>');
      expect(content).not.toContain('builder.');
    });

    it('should migrate builder pattern with transforming preset', async () => {
      tree.write(
        'test.ts',
        `
import { createOverlayHandler } from '@ethlete/cdk';

export const openOverlayHandler = createOverlayHandler({
  component: MyComponent,
  positions: (builder) =>
    builder.transformingFullScreenDialogToDialog({
      dialog: { width: '100%', maxWidth: 500 },
    }),
});
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain(
        "import { createOverlayHandler, transformingFullScreenDialogToDialogOverlayStrategy } from '@ethlete/cdk'",
      );
      expect(content).toContain('strategies: transformingFullScreenDialogToDialogOverlayStrategy({');
      expect(content).toContain("dialog: { width: '100%', maxWidth: 500 }");
      expect(content).not.toContain('(builder) =>');
    });
  });

  describe('complex DEFAULTS scenarios', () => {
    it('should migrate readonly inject with preset strategy and config object', async () => {
      tree.write(
        'test.ts',
        `
import { inject, Injectable } from '@angular/core';
import { OverlayService } from '@ethlete/cdk';
import { ConfirmOverlayComponent, ConfirmOverlayData, ConfirmOverlayResult } from '../components/confirm-overlay';
import { CONFIRM_OVERLAY_CONFIG } from '../constants';

@Injectable({ providedIn: 'root' })
export class ConfirmOverlayService {
  private readonly _overlayService = inject(OverlayService);

  showConfirmOverlay(data: ConfirmOverlayData) {
    return this._overlayService.open<ConfirmOverlayComponent, ConfirmOverlayData, ConfirmOverlayResult>(
      ConfirmOverlayComponent,
      {
        positions: this._overlayService.positions.dialog({
          maxHeight: CONFIRM_OVERLAY_CONFIG.maxHeight,
          maxWidth: CONFIRM_OVERLAY_CONFIG.maxWidth,
          width: CONFIRM_OVERLAY_CONFIG.width,
        }),
        data,
      },
    );
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");

      // Check readonly field injection is preserved
      expect(content).toContain('private readonly _overlayService = injectOverlayManager();');
      expect(content).not.toContain('inject(OverlayService)');

      // Check positions changed to strategies with config object
      expect(content).toContain('strategies: dialogOverlayStrategy({');
      expect(content).toContain('maxHeight: CONFIRM_OVERLAY_CONFIG.maxHeight,');
      expect(content).toContain('maxWidth: CONFIRM_OVERLAY_CONFIG.maxWidth,');
      expect(content).toContain('width: CONFIRM_OVERLAY_CONFIG.width,');
      expect(content).toContain('}),');

      // Check data property is preserved
      expect(content).toContain('data,');

      // Verify generic types are preserved in open call
      expect(content).toContain(
        'this._overlayService.open<ConfirmOverlayComponent, ConfirmOverlayData, ConfirmOverlayResult>(',
      );

      // Check that other imports are preserved
      expect(content).toContain(
        "import { ConfirmOverlayComponent, ConfirmOverlayData, ConfirmOverlayResult } from '../components/confirm-overlay';",
      );
      expect(content).toContain("import { CONFIRM_OVERLAY_CONFIG } from '../constants';");

      // Verify no syntax corruption
      expect(content).not.toContain('})ata');
      expect(content).not.toContain('positions:');
    });

    it('should migrate multiple DEFAULTS with different strategies', async () => {
      tree.write(
        'test.ts',
        `
import { OverlayService } from '@ethlete/cdk';

class Example {
  private overlayService = inject(OverlayService);

  showDialog(data: any) {
    this.overlayService.open(Component, {
      data,
      positions: [
        {
          config: this.overlayService.positions.DEFAULTS.fullScreenDialog,
        },
        {
          breakpoint: 'md',
          config: this.overlayService.positions.mergeConfigs(
            this.overlayService.positions.DEFAULTS.dialog,
            {
              maxHeight: 'min(calc(100% - 4rem), 80rem)',
              maxWidth: 'min(95rem, calc(100vw - 4rem))',
              width: '100%',
            }
          ),
        },
      ],
    });
  }
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain('injectOverlayManager');
      expect(content).toContain('injectFullscreenDialogStrategy');
      expect(content).toContain('injectDialogStrategy');
      expect(content).toContain('mergeOverlayBreakpointConfigs');
      expect(content).toContain('strategies: () => {');
      expect(content).toContain('const fullscreenDialogStrategy = injectFullscreenDialogStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain('strategy: fullscreenDialogStrategy.build()');
      expect(content).toContain('strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs({');
    });

    it('should migrate helper method returning OverlayBreakpointConfigEntry[]', async () => {
      tree.write(
        'test.ts',
        `
import { OverlayBreakpointConfig, OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';

class Example {
  private overlayService = inject(OverlayService);

  openOverlay() {
    this.overlayService.open(Component, {
      positions: this.transformingDialog({ maxWidth: '50rem' }),
    });
  }

  private transformingDialog(extraConfig: OverlayBreakpointConfig = {}): OverlayBreakpointConfigEntry[] {
    return [
      {
        config: this.overlayService.positions.DEFAULTS.fullScreenDialog,
      },
      {
        breakpoint: 'sm',
        config: this.overlayService.positions.mergeConfigs(
          this.overlayService.positions.DEFAULTS.dialog,
          extraConfig,
        ),
      },
    ];
  }
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain('injectOverlayManager');
      expect(content).toContain('injectFullscreenDialogStrategy');
      expect(content).toContain('injectDialogStrategy');
      expect(content).toContain('OverlayStrategyBreakpoint');
      expect(content).toContain('mergeOverlayBreakpointConfigs');

      // Check return type changed to factory function
      expect(content).toContain(
        'private transformingDialog(extraConfig: OverlayBreakpointConfig = {}): () => OverlayStrategyBreakpoint[] {',
      );

      // Check factory function body
      expect(content).toContain('return () => {');
      expect(content).toContain('const fullscreenDialogStrategy = injectFullscreenDialogStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');
      expect(content).toContain('strategy: fullscreenDialogStrategy.build()');
      expect(content).toContain('strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs(extraConfig))');
    });

    it('should preserve multi-property object structure', async () => {
      tree.write(
        'test.ts',
        `
class Example {
  openMobileNavWithRouting() {
    const ref = this.overlayService.open(MobileAppNavigationComponent, {
      positions: this.overlayService.positions.leftSheet({
        width: '100%',
        maxWidth: '35rem',
        containerClass: 'mobile-admin-nav',
      }),
      providers: [
        provideOverlayRouterConfig({
          routes: []
        }),
      ],
    });
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain('strategies: leftSheetOverlayStrategy({');
      expect(content).toContain("width: '100%'");
      expect(content).toContain("maxWidth: '35rem'");
      expect(content).toContain("containerClass: 'mobile-admin-nav'");
      expect(content).toContain('}),');
      expect(content).toContain('providers: [');
      expect(content).toContain('provideOverlayRouterConfig');
      expect(content).not.toContain('})rs:');
      expect(content).not.toContain('positions:');
    });

    it('should preserve multi-property object structure with transforming preset', async () => {
      tree.write(
        'test.ts',
        `
class Example {
  private _openMediaViewer(viewContainerRef: ViewContainerRef) {
    return this._overlayService.open<OverlayBynderMediaViewerComponent>(OverlayBynderMediaViewerComponent, {
      positions: this._overlayService.positions.transformingFullScreenDialogToDialog({
        dialog: { height: 'min-content', maxHeight: '90vh', width: '102.4rem' },
      }),
      viewContainerRef,
    });
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      expect(content).toContain('strategies: transformingFullScreenDialogToDialogOverlayStrategy({');
      expect(content).toContain("dialog: { height: 'min-content', maxHeight: '90vh', width: '102.4rem' }");
      expect(content).toContain('}),');
      expect(content).toContain('viewContainerRef,');
      expect(content).not.toContain('})ainerRef');
      expect(content).not.toContain('positions:');
    });

    it('should migrate service constructor injection and DEFAULTS with mergeConfigs', async () => {
      tree.write(
        'test.ts',
        `
import { Injectable } from '@angular/core';
import { OverlayService } from '@ethlete/cdk';

@Injectable()
export class ShortNewsOverlayService {
  constructor(private _overlayService: OverlayService) {}

  showShortNewsDialog(data: ShortNewsOverlayData) {
    this._overlayService.open(ShortNewsOverlayComponent, {
      data,
      positions: [
        {
          config: this._overlayService.positions.DEFAULTS.fullScreenDialog,
        },
        {
          breakpoint: 'md',
          config: this._overlayService.positions.mergeConfigs(this._overlayService.positions.DEFAULTS.dialog, {
            maxHeight: 'min(calc(100% - 4rem), 80rem)',
            maxWidth: 'min(95rem, calc(100vw - 4rem))',
            width: '100%',
          }),
        },
      ],
    });
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain(
        "import { injectDialogStrategy, injectFullscreenDialogStrategy, injectOverlayManager, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';",
      );

      // Check constructor injection changed to field injection
      expect(content).toContain('private _overlayService = injectOverlayManager();');
      expect(content).not.toContain('constructor(private _overlayService: OverlayService)');
      expect(content).not.toContain('constructor()');

      // Check positions changed to strategies with factory function
      expect(content).toContain('strategies: () => {');
      expect(content).toContain('const fullscreenDialogStrategy = injectFullscreenDialogStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');

      // Check DEFAULTS migration
      expect(content).toContain('strategy: fullscreenDialogStrategy.build()');

      // Check mergeConfigs migration
      expect(content).toContain("breakpoint: 'md',");
      expect(content).toContain('strategy: dialogStrategy.build(mergeOverlayBreakpointConfigs({');
      expect(content).toContain("maxHeight: 'min(calc(100% - 4rem), 80rem)'");
      expect(content).toContain("maxWidth: 'min(95rem, calc(100vw - 4rem))'");
      expect(content).toContain("width: '100%'");

      // Check that the method signature is preserved
      expect(content).toContain('showShortNewsDialog(data: ShortNewsOverlayData)');
      expect(content).toContain('data,');

      // Verify no syntax corruption
      expect(content).not.toContain('})onfig');
      expect(content).not.toContain('positions:');
    });

    it('should migrate service with private readonly field and helper method with multiple mergeConfigs', async () => {
      tree.write(
        'test.ts',
        `
import { Injectable, Injector } from '@angular/core';
import { OverlayBreakpointConfig, OverlayBreakpointConfigEntry, OverlayService } from '@ethlete/cdk';

@Injectable()
export class CompetitionDataMatchupService {
  private readonly _overlayService = inject(OverlayService);

  openSetResultOverlay(matchData: CompetitionMatchupSetResultOverlayData, injector: Injector, origin?: MouseEvent) {
    return this._overlayService.open<
      CompetitionMatchupSetResultOverlayComponent,
      CompetitionMatchupSetResultOverlayData,
      CompetitionMatchupSetResultOverlayResponse
    >(CompetitionMatchupSetResultOverlayComponent, {
      positions: this._transformingFullscreenDialogToDialog(),
      data: matchData,
      injector: injector,
      autoFocus: 'gg-searchbar input',
      origin,
    });
  }

  private _transformingFullscreenDialogToDialog(
    extraConfig: OverlayBreakpointConfig = {},
  ): OverlayBreakpointConfigEntry[] {
    return [
      {
        config: this._overlayService.positions.DEFAULTS.fullScreenDialog,
      },
      {
        breakpoint: 'sm',
        config: this._overlayService.positions.mergeConfigs(
          this._overlayService.positions.DEFAULTS.dialog,
          OVERLAY_CONFIG_BELOW_LG,
          extraConfig,
        ),
      },
      {
        breakpoint: 'lg',
        config: this._overlayService.positions.mergeConfigs(
          this._overlayService.positions.DEFAULTS.dialog,
          OVERLAY_CONFIG_ABOVE_LG,
          extraConfig,
        ),
      },
    ];
  }
}
    `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain(
        "import { OverlayBreakpointConfig, OverlayStrategyBreakpoint, injectDialogStrategy, injectFullscreenDialogStrategy, injectOverlayManager, mergeOverlayBreakpointConfigs } from '@ethlete/cdk';",
      );
      expect(content).not.toContain('OverlayService');
      expect(content).not.toContain('OverlayBreakpointConfigEntry');

      // Check readonly field injection is preserved
      expect(content).toContain('private readonly _overlayService = injectOverlayManager();');
      expect(content).not.toContain('inject(OverlayService)');

      // Check helper method return type changed to factory function
      expect(content).toContain(
        'private _transformingFullscreenDialogToDialog(\n    extraConfig: OverlayBreakpointConfig = {},\n  ): () => OverlayStrategyBreakpoint[] {',
      );

      // Check factory function structure
      expect(content).toContain('return () => {');
      expect(content).toContain('const fullscreenDialogStrategy = injectFullscreenDialogStrategy();');
      expect(content).toContain('const dialogStrategy = injectDialogStrategy();');

      // Check DEFAULTS migration
      expect(content).toContain('strategy: fullscreenDialogStrategy.build()');

      // Check multiple mergeConfigs migrations with multiple arguments
      expect(content).toContain("breakpoint: 'sm',");
      expect(content).toContain('dialogStrategy.build(mergeOverlayBreakpointConfigs(OVERLAY_CONFIG_BELOW_LG,');

      expect(content).toContain("breakpoint: 'lg',");
      expect(content).toContain('dialogStrategy.build(mergeOverlayBreakpointConfigs(OVERLAY_CONFIG_ABOVE_LG,');

      // Check that the calling code is properly migrated
      expect(content).toContain('strategies: this._transformingFullscreenDialogToDialog()');

      // Check that other properties are preserved
      expect(content).toContain('data: matchData,');
      expect(content).toContain('injector: injector,');
      expect(content).toContain("autoFocus: 'gg-searchbar input',");
      expect(content).toContain('origin,');

      // Verify generic types are preserved in open call
      expect(content).toContain('this._overlayService.open<');
      expect(content).toContain('CompetitionMatchupSetResultOverlayComponent,');
      expect(content).toContain('CompetitionMatchupSetResultOverlayData,');
      expect(content).toContain('CompetitionMatchupSetResultOverlayResponse');

      // Verify no syntax corruption
      expect(content).not.toContain('})onfig');
      expect(content).not.toContain('positions:');
    });
  });

  describe('import source validation', () => {
    it('should only migrate OverlayService from @ethlete/cdk', async () => {
      tree.write(
        'test.ts',
        `
import { OverlayService } from '@my-company/overlay';
import { SomeService } from '@ethlete/cdk';

class Example {
  private myOverlayService = inject(OverlayService);

  openDialog() {
    this.myOverlayService.openConfirmDialog()
  }
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Should NOT migrate - OverlayService is from @my-company/overlay
      expect(content).toContain("import { OverlayService } from '@my-company/overlay';");
      expect(content).toContain('inject(OverlayService)');
      expect(content).not.toContain('injectOverlayManager');
    });

    it('should migrate OverlayService from @ethlete/cdk but not from other sources', async () => {
      tree.write(
        'test.ts',
        `
import { OverlayService as EthleteOverlay } from '@ethlete/cdk';
import { OverlayService as CustomOverlay } from '@my-company/overlay';

class Example {
  private ethleteService = inject(EthleteOverlay);
  private customService = inject(CustomOverlay);

  openEthleteDialog() {
    this.ethleteService.open(Component, {
      positions: this.ethleteService.positions.dialog()
    });
  }

  openCustomDialog() {
    this.customService.openSomething()
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Should migrate ethlete service
      expect(content).toContain('injectOverlayManager');
      expect(content).toContain('private ethleteService = injectOverlayManager();');
      expect(content).toContain('strategies: dialogOverlayStrategy()');

      // Should NOT migrate custom service
      expect(content).toContain("import { OverlayService as CustomOverlay } from '@my-company/overlay';");
      expect(content).toContain('private customService = inject(CustomOverlay);');
      expect(content).toContain('this.customService.openSomething()');
    });

    it('should handle constructor injection only from @ethlete/cdk', async () => {
      tree.write(
        'test.ts',
        `
import { Injectable } from '@angular/core';
import { OverlayService } from '@my-company/overlay';

@Injectable()
export class MyService {
  constructor(private overlayService: OverlayService) {}

  openDialog() {
    this.overlayService.open(Component, {
      positions: this.overlayService.positions.dialog()
    });
  }
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Should NOT migrate - OverlayService is from @my-company/overlay
      expect(content).toContain("import { OverlayService } from '@my-company/overlay';");
      expect(content).toContain('constructor(private overlayService: OverlayService)');
      expect(content).not.toContain('injectOverlayManager');
    });

    it('should migrate when OverlayService is imported from @ethlete/cdk alongside other imports', async () => {
      tree.write(
        'test.ts',
        `
import { Injectable } from '@angular/core';
import { OverlayService, createOverlayHandler } from '@ethlete/cdk';

@Injectable()
export class MyService {
  constructor(private overlayService: OverlayService) {}

  openDialog() {
    this.overlayService.open(Component, {
      positions: this.overlayService.positions.dialog()
    });
  }
}
      `,
      );

      await migrateOverlayPositions(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Should migrate - OverlayService is from @ethlete/cdk
      expect(content).toContain(
        "import { createOverlayHandler, dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';",
      );
      expect(content).toContain('private overlayService = injectOverlayManager();');
      expect(content).toContain('strategies: dialogOverlayStrategy()');
      expect(content).not.toContain('constructor');
      expect(content).not.toContain('OverlayService');
    });
  });
});
