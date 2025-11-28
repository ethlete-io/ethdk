import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import migrateDialogBottomSheet from './dialog-bottom-sheet.js';

describe('migrate-to-v5 -> dialog & bottom sheet', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

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
      // no-op
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('inject() support', () => {
    it('should migrate inject(DialogRef) to inject(OverlayRef)', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DialogRef } from '@ethlete/cdk';

@Component({})
export class MyDialog {
  private dialogRef = inject(DialogRef<MyDialog>);

  close() {
    this.dialogRef.close();
  }
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
      expect(content).toContain('private dialogRef = inject(OverlayRef<MyDialog>);');
      expect(content).not.toContain('DialogRef');
    });

    it('should migrate inject(BottomSheetRef) to inject(OverlayRef)', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { BottomSheetRef } from '@ethlete/cdk';

@Component({})
export class MyBottomSheet {
  private ref = inject(BottomSheetRef<MyBottomSheet>);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
      expect(content).toContain('private ref = inject(OverlayRef<MyBottomSheet>);');
      expect(content).not.toContain('BottomSheetRef');
    });

    it('should migrate inject(DialogService) to injectOverlayManager()', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DialogService } from '@ethlete/cdk';

@Component({})
export class MyComponent {
  private dialogService = inject(DialogService);

  openDialog() {
    this.dialogService.open(Component);
  }
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('private dialogService = injectOverlayManager();');
      expect(content).not.toContain('inject(');
      expect(content).not.toContain('DialogService');
    });

    it('should migrate inject(BottomSheetService) to injectOverlayManager()', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { BottomSheetService } from '@ethlete/cdk';

@Component({})
export class MyComponent {
  private bottomSheetService = inject(BottomSheetService);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('private bottomSheetService = injectOverlayManager();');
      expect(content).not.toContain('inject(');
      expect(content).not.toContain('BottomSheetService');
    });

    it('should migrate inject(DynamicOverlayService) to injectOverlayManager()', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DynamicOverlayService } from '@ethlete/cdk';

@Component({})
export class MyComponent {
  private dynamicOverlayService = inject(DynamicOverlayService);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('private dynamicOverlayService = injectOverlayManager();');
      expect(content).not.toContain('inject(');
      expect(content).not.toContain('DynamicOverlayService');
    });

    it('should migrate inject(DIALOG_DATA) to inject(OVERLAY_DATA)', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DIALOG_DATA } from '@ethlete/cdk';

@Component({})
export class MyDialog {
  private data = inject(DIALOG_DATA);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OVERLAY_DATA } from '@ethlete/cdk';");
      expect(content).toContain('private data = inject(OVERLAY_DATA);');
      expect(content).not.toContain('DIALOG_DATA');
    });

    it('should migrate inject(BOTTOM_SHEET_DATA) to inject(OVERLAY_DATA)', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { BOTTOM_SHEET_DATA } from '@ethlete/cdk';

@Component({})
export class MyBottomSheet {
  private data = inject(BOTTOM_SHEET_DATA);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OVERLAY_DATA } from '@ethlete/cdk';");
      expect(content).toContain('private data = inject(OVERLAY_DATA);');
      expect(content).not.toContain('BOTTOM_SHEET_DATA');
    });

    it('should handle inject() with generic types', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DialogRef } from '@ethlete/cdk';

interface MyData {
  foo: string;
}

@Component({})
export class MyDialog {
  private dialogRef = inject(DialogRef<MyDialog, MyData>);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
      expect(content).toContain('private dialogRef = inject(OverlayRef<MyDialog, MyData>);');
      expect(content).not.toContain('DialogRef');
    });

    it('should only migrate inject() calls from @ethlete/cdk', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DialogService } from '@my-company/dialog';

@Component({})
export class MyComponent {
  private dialogService = inject(DialogService);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { DialogService } from '@my-company/dialog';");
      expect(content).toContain('private dialogService = inject(DialogService);');
      expect(content).not.toContain('OverlayService');
    });

    it('should handle multiple inject() calls in same file', async () => {
      tree.write(
        'test.ts',
        `
import { inject } from '@angular/core';
import { DialogRef, DIALOG_DATA, DialogService } from '@ethlete/cdk';

@Component({})
export class MyDialog {
  private dialogRef = inject(DialogRef);
  private data = inject(DIALOG_DATA);
  private dialogService = inject(DialogService);
}
      `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { OVERLAY_DATA, OverlayRef, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('private dialogRef = inject(OverlayRef);');
      expect(content).toContain('private data = inject(OVERLAY_DATA);');
      expect(content).toContain('private dialogService = injectOverlayManager();');
      expect(content).not.toContain('DialogRef');
      expect(content).not.toContain('DIALOG_DATA');
      expect(content).not.toContain('DialogService');
    });
  });

  describe('symbol migrations', () => {
    describe('private field syntax (#) support', () => {
      it('should migrate private field with # syntax', async () => {
        tree.write(
          'test.ts',
          `
import { DialogService } from '@ethlete/cdk';

class MyService {
  #dialogService = inject(DialogService);

  openDialog() {
    this.#dialogService.open(Component, {
      data: { foo: 'bar' }
    });
  }
}
      `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
        expect(content).toContain('#dialogService = injectOverlayManager();');
        expect(content).toContain('this.#dialogService.open(Component, {');
        expect(content).not.toContain('inject(DialogService)');
      });

      it('should handle multiple private fields with # syntax', async () => {
        tree.write(
          'test.ts',
          `
import { DialogService, BottomSheetService } from '@ethlete/cdk';

class MyService {
  #dialogService = inject(DialogService);
  #bottomSheetService = inject(BottomSheetService);
  #viewContainerRef = inject(ViewContainerRef);

  openDialog() {
    this.#dialogService.open(Component, {
      viewContainerRef: this.#viewContainerRef,
      data: { foo: 'bar' }
    });
  }
}
      `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain('#dialogService = injectOverlayManager();');
        expect(content).toContain('#bottomSheetService = injectOverlayManager();');
        expect(content).toContain('#viewContainerRef = inject(ViewContainerRef);');
      });

      it('should track private field variables for .open() transformation', async () => {
        tree.write(
          'test.ts',
          `
import { DialogService } from '@ethlete/cdk';

class MyService {
  #dialogService = inject(DialogService);

  openDialog() {
    this.#dialogService.open(Component, {
      panelClass: 'my-panel',
      data: { foo: 'bar' }
    });
  }
}
      `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain('#dialogService = injectOverlayManager();');
        expect(content).toContain('strategies: dialogOverlayStrategy({');
        expect(content).toContain("panelClass: 'my-panel'");
      });
    });

    describe('DialogRef and BottomSheetRef -> OverlayRef', () => {
      it('should migrate DialogRef to OverlayRef', async () => {
        tree.write(
          'test.ts',
          `
import { DialogRef } from '@ethlete/cdk';

class MyDialog {
  constructor(private dialogRef: DialogRef<MyDialog>) {}

  close() {
    this.dialogRef.close();
  }
}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
        expect(content).toContain('constructor(private dialogRef: OverlayRef<MyDialog>)');
        expect(content).not.toContain('DialogRef');
      });

      it('should migrate BottomSheetRef to OverlayRef', async () => {
        tree.write(
          'test.ts',
          `
import { BottomSheetRef } from '@ethlete/cdk';

class MyBottomSheet {
  constructor(private ref: BottomSheetRef<MyBottomSheet>) {}

  close() {
    this.ref.close();
  }
}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
        expect(content).toContain('constructor(private ref: OverlayRef<MyBottomSheet>)');
        expect(content).not.toContain('BottomSheetRef');
      });

      it('should migrate both DialogRef and BottomSheetRef in same file', async () => {
        tree.write(
          'test.ts',
          `
import { DialogRef, BottomSheetRef } from '@ethlete/cdk';

class MyDialog {
  constructor(private dialogRef: DialogRef<MyDialog>) {}
}

class MyBottomSheet {
  constructor(private ref: BottomSheetRef<MyBottomSheet>) {}
}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayRef } from '@ethlete/cdk';");
        expect(content).toContain('constructor(private dialogRef: OverlayRef<MyDialog>)');
        expect(content).toContain('constructor(private ref: OverlayRef<MyBottomSheet>)');
        expect(content).not.toContain('DialogRef');
        expect(content).not.toContain('BottomSheetRef');
      });
    });

    describe('DialogService and BottomSheetService -> injectOverlayManager', () => {
      it('should migrate DialogService constructor injection to injectOverlayManager', async () => {
        tree.write(
          'test.ts',
          `
import { Injectable } from '@angular/core';
import { DialogService } from '@ethlete/cdk';

@Injectable()
export class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component);
  }
}
        `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
        expect(content).toContain('private dialogService = injectOverlayManager();');
        expect(content).not.toContain('constructor');
        expect(content).not.toContain('DialogService');
      });

      it('should migrate BottomSheetService constructor injection to injectOverlayManager', async () => {
        tree.write(
          'test.ts',
          `
import { Injectable } from '@angular/core';
import { BottomSheetService } from '@ethlete/cdk';

@Injectable()
export class MyService {
  constructor(private bottomSheetService: BottomSheetService) {}

  openBottomSheet() {
    this.bottomSheetService.open(Component);
  }
}
        `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { bottomSheetOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
        expect(content).toContain('private bottomSheetService = injectOverlayManager();');
        expect(content).not.toContain('constructor');
        expect(content).not.toContain('BottomSheetService');
      });

      it('should migrate DynamicOverlayService constructor injection to injectOverlayManager', async () => {
        tree.write(
          'test.ts',
          `
import { Injectable } from '@angular/core';
import { DynamicOverlayService } from '@ethlete/cdk';

@Injectable()
export class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}
}
        `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
        expect(content).toContain('private dynamicOverlayService = injectOverlayManager();');
        expect(content).not.toContain('constructor');
        expect(content).not.toContain('DynamicOverlayService');
      });

      it('should migrate constructor with multiple service parameters', async () => {
        tree.write(
          'test.ts',
          `
import { Injectable } from '@angular/core';
import { DialogService, BottomSheetService } from '@ethlete/cdk';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class MyService {
  constructor(
    private dialogService: DialogService,
    private bottomSheetService: BottomSheetService,
    private http: HttpClient
  ) {}
}
        `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
        expect(content).toContain('private dialogService = injectOverlayManager();');
        expect(content).toContain('private bottomSheetService = injectOverlayManager();');
        expect(content).toContain('constructor(\n    private http: HttpClient\n  ) {}');
        expect(content).not.toContain('DialogService');
        expect(content).not.toContain('BottomSheetService');
      });

      it('should remove constructor entirely if only service parameters remain', async () => {
        tree.write(
          'test.ts',
          `
import { Injectable } from '@angular/core';
import { DialogService } from '@ethlete/cdk';

@Injectable()
export class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component);
  }
}
        `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain('private dialogService = injectOverlayManager();');
        expect(content).not.toContain('constructor');
      });
    });

    describe('DialogImports and BottomSheetImports -> OverlayImports', () => {
      it('should migrate DialogImports to OverlayImports', async () => {
        tree.write(
          'test.ts',
          `
import { DialogImports } from '@ethlete/cdk';

@Component({
  imports: [DialogImports]
})
export class MyComponent {}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayImports } from '@ethlete/cdk';");
        expect(content).toContain('imports: [OverlayImports]');
        expect(content).not.toContain('DialogImports');
      });

      it('should migrate BottomSheetImports to OverlayImports', async () => {
        tree.write(
          'test.ts',
          `
import { BottomSheetImports } from '@ethlete/cdk';

@Component({
  imports: [BottomSheetImports]
})
export class MyComponent {}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayImports } from '@ethlete/cdk';");
        expect(content).toContain('imports: [OverlayImports]');
        expect(content).not.toContain('BottomSheetImports');
      });
    });

    describe('provideDialog and provideBottomSheet -> provideOverlay', () => {
      it('should migrate provideDialog to provideOverlay', async () => {
        tree.write(
          'test.ts',
          `
import { provideDialog } from '@ethlete/cdk';

export const appConfig = {
  providers: [
    provideDialog()
  ]
};
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { provideOverlay } from '@ethlete/cdk';");
        expect(content).toContain('provideOverlay()');
        expect(content).not.toContain('provideDialog');
      });

      it('should migrate provideBottomSheet to provideOverlay', async () => {
        tree.write(
          'test.ts',
          `
import { provideBottomSheet } from '@ethlete/cdk';

export const appConfig = {
  providers: [
    provideBottomSheet()
  ]
};
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { provideOverlay } from '@ethlete/cdk';");
        expect(content).toContain('provideOverlay()');
        expect(content).not.toContain('provideBottomSheet');
      });
    });

    describe('DialogConfig and BottomSheetConfig -> OverlayConfig', () => {
      it('should migrate DialogConfig to OverlayConfig', async () => {
        tree.write(
          'test.ts',
          `
import { DialogConfig } from '@ethlete/cdk';

const config: DialogConfig = {
  width: '400px'
};
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayConfig } from '@ethlete/cdk';");
        expect(content).toContain('const config: OverlayConfig = {');
        expect(content).not.toContain('DialogConfig');
      });

      it('should migrate BottomSheetConfig to OverlayConfig', async () => {
        tree.write(
          'test.ts',
          `
import { BottomSheetConfig } from '@ethlete/cdk';

const config: BottomSheetConfig = {
  width: '400px'
};
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayConfig } from '@ethlete/cdk';");
        expect(content).toContain('const config: OverlayConfig = {');
        expect(content).not.toContain('BottomSheetConfig');
      });
    });

    describe('DIALOG_DATA and BOTTOM_SHEET_DATA -> OVERLAY_DATA', () => {
      it('should migrate DIALOG_DATA to OVERLAY_DATA', async () => {
        tree.write(
          'test.ts',
          `
import { DIALOG_DATA } from '@ethlete/cdk';

@Component({})
export class MyDialog {
  constructor(@Inject(DIALOG_DATA) public data: MyData) {}
}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OVERLAY_DATA } from '@ethlete/cdk';");
        expect(content).toContain('@Inject(OVERLAY_DATA)');
        expect(content).not.toContain('DIALOG_DATA');
      });

      it('should migrate BOTTOM_SHEET_DATA to OVERLAY_DATA', async () => {
        tree.write(
          'test.ts',
          `
import { BOTTOM_SHEET_DATA } from '@ethlete/cdk';

@Component({})
export class MyBottomSheet {
  constructor(@Inject(BOTTOM_SHEET_DATA) public data: MyData) {}
}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OVERLAY_DATA } from '@ethlete/cdk';");
        expect(content).toContain('@Inject(OVERLAY_DATA)');
        expect(content).not.toContain('BOTTOM_SHEET_DATA');
      });
    });
  });

  describe('directive migrations', () => {
    describe('DialogCloseDirective -> OverlayCloseDirective', () => {
      it('should migrate DialogCloseDirective import', async () => {
        tree.write(
          'test.ts',
          `
import { DialogCloseDirective } from '@ethlete/cdk';

@Component({
  imports: [DialogCloseDirective]
})
export class MyComponent {}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayCloseDirective } from '@ethlete/cdk';");
        expect(content).toContain('imports: [OverlayCloseDirective]');
        expect(content).not.toContain('DialogCloseDirective');
      });
    });

    describe('DialogTitleDirective and BottomSheetTitleDirective -> OverlayTitleDirective', () => {
      it('should migrate DialogTitleDirective to OverlayTitleDirective', async () => {
        tree.write(
          'test.ts',
          `
import { DialogTitleDirective } from '@ethlete/cdk';

@Component({
  imports: [DialogTitleDirective]
})
export class MyComponent {}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayTitleDirective } from '@ethlete/cdk';");
        expect(content).toContain('imports: [OverlayTitleDirective]');
        expect(content).not.toContain('DialogTitleDirective');
      });

      it('should migrate BottomSheetTitleDirective to OverlayTitleDirective', async () => {
        tree.write(
          'test.ts',
          `
import { BottomSheetTitleDirective } from '@ethlete/cdk';

@Component({
  imports: [BottomSheetTitleDirective]
})
export class MyComponent {}
          `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).toContain("import { OverlayTitleDirective } from '@ethlete/cdk';");
        expect(content).toContain('imports: [OverlayTitleDirective]');
        expect(content).not.toContain('BottomSheetTitleDirective');
      });
    });
  });

  describe('BottomSheetDragHandleComponent removal', () => {
    it('should remove BottomSheetDragHandleComponent import', async () => {
      tree.write(
        'test.ts',
        `
import { BottomSheetDragHandleComponent } from '@ethlete/cdk';

@Component({
  imports: [BottomSheetDragHandleComponent]
})
export class MyComponent {}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).not.toContain('BottomSheetDragHandleComponent');
      expect(content).toContain('imports: []');
    });

    it('should remove BottomSheetDragHandleComponent from imports array with other imports', async () => {
      tree.write(
        'test.ts',
        `
import { BottomSheetDragHandleComponent, DialogCloseDirective } from '@ethlete/cdk';

@Component({
  imports: [BottomSheetDragHandleComponent, DialogCloseDirective]
})
export class MyComponent {}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).not.toContain('BottomSheetDragHandleComponent');
      expect(content).toContain("import { OverlayCloseDirective } from '@ethlete/cdk';");
      expect(content).toContain('imports: [OverlayCloseDirective]');
    });
  });

  describe('HTML template migrations', () => {
    it('should migrate etDynamicOverlayTitle to etOverlayTitle', async () => {
      tree.write(
        'test.html',
        `
<div etDynamicOverlayTitle>Dynamic Title</div>
<h2 et-dynamic-overlay-title>Another Title</h2>
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('etOverlayTitle');
      expect(content).toContain('et-overlay-title');
      expect(content).not.toContain('etDynamicOverlayTitle');
      expect(content).not.toContain('et-dynamic-overlay-title');
    });

    it('should migrate all title directive variants in same file', async () => {
      tree.write(
        'test.html',
        `
<h1 etDialogTitle>Dialog Title</h1>
<h2 etBottomSheetTitle>Bottom Sheet Title</h2>
<h3 etDynamicOverlayTitle>Dynamic Overlay Title</h3>
<h4 et-dialog-title>Kebab Dialog</h4>
<h5 et-bottom-sheet-title>Kebab Bottom Sheet</h5>
<h6 et-dynamic-overlay-title>Kebab Dynamic</h6>
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');

      // All should be migrated to etOverlayTitle
      expect(content).toContain('<h1 etOverlayTitle>Dialog Title</h1>');
      expect(content).toContain('<h2 etOverlayTitle>Bottom Sheet Title</h2>');
      expect(content).toContain('<h3 etOverlayTitle>Dynamic Overlay Title</h3>');
      expect(content).toContain('<h4 et-overlay-title>Kebab Dialog</h4>');
      expect(content).toContain('<h5 et-overlay-title>Kebab Bottom Sheet</h5>');
      expect(content).toContain('<h6 et-overlay-title>Kebab Dynamic</h6>');

      // None of the old directives should remain
      expect(content).not.toContain('etDialogTitle');
      expect(content).not.toContain('etBottomSheetTitle');
      expect(content).not.toContain('etDynamicOverlayTitle');
      expect(content).not.toContain('et-dialog-title');
      expect(content).not.toContain('et-bottom-sheet-title');
      expect(content).not.toContain('et-dynamic-overlay-title');
    });

    it('should remove et-bottom-sheet-drag-handle element', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <et-bottom-sheet-drag-handle />
  <h2>Title</h2>
  <p>Content</p>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).not.toContain('et-bottom-sheet-drag-handle');
      expect(content).toContain('<h2>Title</h2>');
    });

    it('should remove etBottomSheetDragHandle directive', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <div etBottomSheetDragHandle></div>
  <h2>Title</h2>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).not.toContain('etBottomSheetDragHandle');
      expect(content).not.toContain('<div></div>');
    });

    it('should remove element with et-bottom-sheet-drag-handle directive in kebab-case', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <div et-bottom-sheet-drag-handle class="handle"></div>
  <h2>Title</h2>
</div>
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).not.toContain('et-bottom-sheet-drag-handle');
      expect(content).not.toContain('class="handle"');
      expect(content).toContain('<h2>Title</h2>');
    });

    it('should remove self-closing element with etBottomSheetDragHandle directive', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <div etBottomSheetDragHandle class="drag-handle" />
  <h2>Title</h2>
  <p>Content</p>
</div>
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).not.toContain('etBottomSheetDragHandle');
      expect(content).not.toContain('drag-handle');
      expect(content).toContain('<h2>Title</h2>');
      expect(content).toContain('<p>Content</p>');
    });

    it('should migrate et-bottom-sheet-title to et-overlay-title', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <h1 et-bottom-sheet-title>My Title</h1>
  <p>Content</p>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('<h1 et-overlay-title>My Title</h1>');
      expect(content).not.toContain('et-bottom-sheet-title');
    });

    it('should migrate etBottomSheetTitle to etOverlayTitle', async () => {
      tree.write(
        'test.html',
        `
<div class="bottom-sheet">
  <h2 etBottomSheetTitle>My Title</h2>
  <p>Content</p>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('<h2 etOverlayTitle>My Title</h2>');
      expect(content).not.toContain('etBottomSheetTitle');
    });

    it('should migrate et-dialog-title to et-overlay-title', async () => {
      tree.write(
        'test.html',
        `
<div class="dialog">
  <et-dialog-title>My Title</et-dialog-title>
  <p>Content</p>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('<et-overlay-title>My Title</et-overlay-title>');
      expect(content).not.toContain('et-dialog-title');
    });

    it('should migrate etDialogTitle to etOverlayTitle', async () => {
      tree.write(
        'test.html',
        `
<div class="dialog">
  <h2 etDialogTitle>My Title</h2>
  <p>Content</p>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('<h2 etOverlayTitle>My Title</h2>');
      expect(content).not.toContain('etDialogTitle');
    });

    it('should migrate etDialogClose to etOverlayClose', async () => {
      tree.write(
        'test.html',
        `
<div class="dialog">
  <button etDialogClose>Close</button>
</div>
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.html', 'utf-8');
      expect(content).toContain('<button etOverlayClose>Close</button>');
      expect(content).not.toContain('etDialogClose');
    });
  });

  describe('DialogService.open() transformation', () => {
    it('should add dialogOverlayStrategy to simple dialog open call', async () => {
      tree.write(
        'test.ts',
        `
import { DialogService } from '@ethlete/cdk';

class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component);
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('this.dialogService.open(Component, { strategies: dialogOverlayStrategy() })');
    });

    it('should move style properties to dialogOverlayStrategy config', async () => {
      tree.write(
        'test.ts',
        `
import { DialogService } from '@ethlete/cdk';

class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component, {
      panelClass: 'my-panel',
      backdropClass: 'my-backdrop',
      width: '400px',
      data: { foo: 'bar' }
    });
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('this.dialogService.open(Component, {');
      expect(content).toContain("data: { foo: 'bar' }");
      expect(content).toContain('strategies: dialogOverlayStrategy({');
      expect(content).toContain("panelClass: 'my-panel',");
      expect(content).toContain("backdropClass: 'my-backdrop',");
      expect(content).toContain("width: '400px'");
      expect(content).toContain('})');
    });

    it('should handle all style properties', async () => {
      tree.write(
        'test.ts',
        `
import { DialogService } from '@ethlete/cdk';

class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component, {
      panelClass: 'panel',
      containerClass: 'container',
      overlayClass: 'overlay',
      backdropClass: 'backdrop',
      width: '400px',
      height: '300px',
      minWidth: '200px',
      minHeight: '100px',
      maxWidth: '600px',
      maxHeight: '500px',
      position: { top: '10px', left: '10px' }
    });
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('strategies: dialogOverlayStrategy({');
      expect(content).toContain("panelClass: 'panel',");
      expect(content).toContain("containerClass: 'container',");
      expect(content).toContain("overlayClass: 'overlay',");
      expect(content).toContain("backdropClass: 'backdrop',");
      expect(content).toContain("width: '400px',");
      expect(content).toContain("height: '300px',");
      expect(content).toContain("minWidth: '200px',");
      expect(content).toContain("minHeight: '100px',");
      expect(content).toContain("maxWidth: '600px',");
      expect(content).toContain("maxHeight: '500px',");
      expect(content).toContain("position: { top: '10px', left: '10px' }");
    });
  });

  describe('BottomSheetService.open() transformation', () => {
    it('should add bottomSheetOverlayStrategy to simple bottom sheet open call', async () => {
      tree.write(
        'test.ts',
        `
import { BottomSheetService } from '@ethlete/cdk';

class MyService {
  constructor(private bottomSheetService: BottomSheetService) {}

  openBottomSheet() {
    this.bottomSheetService.open(Component);
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { bottomSheetOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain(
        'this.bottomSheetService.open(Component, { strategies: bottomSheetOverlayStrategy() })',
      );
    });

    it('should move style properties to bottomSheetOverlayStrategy config', async () => {
      tree.write(
        'test.ts',
        `
import { BottomSheetService } from '@ethlete/cdk';

class MyService {
  constructor(private bottomSheetService: BottomSheetService) {}

  openBottomSheet() {
    this.bottomSheetService.open(Component, {
      panelClass: 'my-panel',
      backdropClass: 'my-backdrop',
      width: '400px',
      data: { foo: 'bar' }
    });
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { bottomSheetOverlayStrategy, injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('this.bottomSheetService.open(Component, {');
      expect(content).toContain("data: { foo: 'bar' }");
      expect(content).toContain('strategies: bottomSheetOverlayStrategy({');
      expect(content).toContain("panelClass: 'my-panel',");
      expect(content).toContain("backdropClass: 'my-backdrop',");
      expect(content).toContain("width: '400px'");
      expect(content).toContain('})');
    });
  });

  describe('DynamicOverlayService transformation', () => {
    it('should migrate DynamicOverlayService with isDialogFrom and separate configs', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

export class MyComponent {
  private _dynamicOverlayService = inject(DynamicOverlayService);
  private _viewContainerRef = inject(ViewContainerRef);

  openSelectedCollectionDialog() {
    const formData = this.creatorSuite.form();
    if (formData?.type === 'player') {
      this._dynamicOverlayService.open<DialogSelectedPlayerComponent>(DialogSelectedPlayerComponent, {
        isDialogFrom: 'sm',
        bottomSheetConfig: {
          viewContainerRef: this._viewContainerRef,
        },
        dialogConfig: {
          minWidth: '59.2rem',
          viewContainerRef: this._viewContainerRef,
        },
      });
    }
  }
}
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');

      // Check imports
      expect(content).toContain(
        "import { injectOverlayManager, transformingBottomSheetToDialogOverlayStrategy } from '@ethlete/cdk';",
      );

      // Check DynamicOverlayService migration
      expect(content).toContain('private _dynamicOverlayService = injectOverlayManager();');
      expect(content).not.toContain('inject(DynamicOverlayService)');

      // Check strategies with factory function
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');

      expect(content).toContain('viewContainerRef: this._viewContainerRef,');

      // Verify old properties are removed
      expect(content).not.toContain('isDialogFrom');
      expect(content).not.toContain('bottomSheetConfig');
      expect(content).not.toContain('dialogConfig');

      // Verify no syntax corruption
      expect(content).not.toContain('})ContainerRef');

      // Verify the conditional logic is preserved
      expect(content).toContain("if (formData?.type === 'player')");
    });

    it('should preserve data and other non-style properties', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}

  open() {
    const data = { foo: 'bar' };
    
    this.dynamicOverlayService.open(Component, {
      isDialogFrom: 'md',
      bottomSheetConfig: {
        overlayClass: 'gg-wrapped-share-overlay',
        data,
      },
      dialogConfig: {
        data,
      },
    });
  }
}
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain('data,');
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain('bottomSheet: {');
      expect(content).toContain("overlayClass: 'gg-wrapped-share-overlay'");
      expect(content).toContain("breakpoint: 'md'");
    });

    it('should remove scrollStrategy from configs', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}

  open() {
    const scrollStrategy = new BlockScrollStrategy();
    const data = { foo: 'bar' };
    
    this.dynamicOverlayService.open(Component, {
      isDialogFrom: 'md',
      bottomSheetConfig: {
        overlayClass: 'gg-wrapped-share-overlay',
        scrollStrategy,
        data,
      },
      dialogConfig: {
        scrollStrategy,
        data,
      },
    });
  }
}
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).not.toContain('scrollStrategy,');
      expect(content).toContain('data,');
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain('bottomSheet: {');
      expect(content).toContain("overlayClass: 'gg-wrapped-share-overlay'");
    });

    it('should handle complex real-world case with data and scrollStrategy', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}

  protected openShareOverlay() {
    const scrollStrategy = new BlockScrollStrategy(this._viewportRuler, document);

    const data: WrappedShareOverlayData = {
      story: this.story,
      cardPosition: this.cardPosition,
      wrapped: wrappedData,
    };

    this._dynamicOverlayService.open<WrappedShareOverlayComponent, WrappedShareOverlayData>(
      WrappedShareOverlayComponent,
      {
        isDialogFrom: 'md',
        bottomSheetConfig: {
          overlayClass: 'gg-wrapped-share-overlay',
          scrollStrategy,
          data,
        },
        dialogConfig: {
          scrollStrategy,
          data,
        },
      },
    );
  }
}
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).not.toContain('scrollStrategy,');
      expect(content).toContain('data,');
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain('bottomSheet: {');
      expect(content).toContain("overlayClass: 'gg-wrapped-share-overlay'");
      expect(content).toContain("breakpoint: 'md'");
    });

    // Also add scrollStrategy removal tests for DialogService and BottomSheetService
    describe('scrollStrategy removal', () => {
      it('should remove scrollStrategy from DialogService.open config', async () => {
        tree.write(
          'test.ts',
          `
import { DialogService } from '@ethlete/cdk';

class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    const scrollStrategy = new BlockScrollStrategy();
    
    this.dialogService.open(Component, {
      panelClass: 'my-panel',
      scrollStrategy,
      data: { foo: 'bar' }
    });
  }
}
      `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).not.toContain('scrollStrategy,');
        expect(content).toContain("data: { foo: 'bar' }");
        expect(content).toContain('strategies: dialogOverlayStrategy({');
      });

      it('should remove scrollStrategy from BottomSheetService.open config', async () => {
        tree.write(
          'test.ts',
          `
import { BottomSheetService } from '@ethlete/cdk';

class MyService {
  constructor(private bottomSheetService: BottomSheetService) {}

  openBottomSheet() {
    const scrollStrategy = new BlockScrollStrategy();
    
    this.bottomSheetService.open(Component, {
      panelClass: 'my-panel',
      scrollStrategy,
      data: { foo: 'bar' }
    });
  }
}
      `,
        );

        await migrateDialogBottomSheet(tree);

        const content = tree.read('test.ts', 'utf-8');
        expect(content).not.toContain('scrollStrategy,');
        expect(content).toContain("data: { foo: 'bar' }");
        expect(content).toContain('strategies: bottomSheetOverlayStrategy({');
      });
    });

    it('should migrate DynamicOverlayService to injectOverlayManager', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { injectOverlayManager } from '@ethlete/cdk';");
      expect(content).toContain('private dynamicOverlayService = injectOverlayManager();');
      expect(content).not.toContain('DynamicOverlayService');
    });

    it('should transform DynamicOverlayService.open to use transformingBottomSheetToDialogOverlayStrategy', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}

  open() {
    this.dynamicOverlayService.open(Component, {
      isDialogFrom: 'md',
      bottomSheetConfig: {
        data: { foo: 'bar' },
        panelClass: 'et-bottom-sheet--no-padding',
      },
      dialogConfig: {
        data: { foo: 'bar' },
        width: '400px',
        panelClass: 'et-dialog--no-padding',
      },
    });
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain(
        "import { injectOverlayManager, transformingBottomSheetToDialogOverlayStrategy } from '@ethlete/cdk';",
      );
      expect(content).toContain('this.dynamicOverlayService.open(Component, {');
      expect(content).toContain("data: { foo: 'bar' },");
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain('bottomSheet: {');
      expect(content).toContain("panelClass: 'et-bottom-sheet--no-padding'");
      expect(content).toContain('dialog: {');
      expect(content).toContain("width: '400px',");
      expect(content).toContain("panelClass: 'et-dialog--no-padding'");
      expect(content).toContain("breakpoint: 'md'");
      expect(content).toContain('})');
    });

    it('should extract data from configs and merge into main config', async () => {
      tree.write(
        'test.ts',
        `
import { DynamicOverlayService } from '@ethlete/cdk';

class MyService {
  constructor(private dynamicOverlayService: DynamicOverlayService) {}

  open() {
    this.dynamicOverlayService.open(Component, {
      isDialogFrom: 'md',
      bottomSheetConfig: {
        data: { foo: 'bar', baz: 'qux' },
        panelClass: 'bottom-sheet-class',
      },
      dialogConfig: {
        data: { foo: 'bar', baz: 'qux' },
        panelClass: 'dialog-class',
      },
    });
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("data: { foo: 'bar', baz: 'qux' },");
      expect(content).toContain('strategies: transformingBottomSheetToDialogOverlayStrategy({');
      expect(content).toContain('bottomSheet: {');
      expect(content).toContain("panelClass: 'bottom-sheet-class'");
      expect(content).toContain('dialog: {');
      expect(content).toContain("panelClass: 'dialog-class'");
    });
  });

  describe('import source validation', () => {
    it('should only migrate symbols from @ethlete/cdk', async () => {
      tree.write(
        'test.ts',
        `
import { DialogService } from '@my-company/dialog';
import { SomeService } from '@ethlete/cdk';

class MyService {
  constructor(private dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(Component);
  }
}
        `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8');
      expect(content).toContain("import { DialogService } from '@my-company/dialog';");
      expect(content).not.toContain('OverlayService');
      expect(content).not.toContain('dialogOverlayStrategy');
    });

    it('should deduplicate all three Imports types to single OverlayImports', async () => {
      tree.write(
        'test.ts',
        `
import { DialogImports, BottomSheetImports, DynamicOverlayImports } from '@ethlete/cdk';

@Component({
  imports: [DialogImports, BottomSheetImports, DynamicOverlayImports]
})
export class MyComponent {}
    `,
      );

      await migrateDialogBottomSheet(tree);

      const content = tree.read('test.ts', 'utf-8')!;
      expect(content).toContain("import { OverlayImports } from '@ethlete/cdk';");
      expect(content).toContain('imports: [OverlayImports]');
      expect(content).not.toContain('DialogImports');
      expect(content).not.toContain('BottomSheetImports');
      expect(content).not.toContain('DynamicOverlayImports');

      // Verify only one OverlayImports in the imports array
      const importsArrayMatch = content.match(/imports:\s*\[(.*?)\]/s);
      expect(importsArrayMatch).toBeTruthy();
      const importsContent = importsArrayMatch![1]!;
      const overlayImportsCount = (importsContent.match(/OverlayImports/g) || []).length;
      expect(overlayImportsCount).toBe(1);
    });
  });
});
