import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateCdkMenu from './cdk-menu';

describe('migrate-to-v5 -> cdk menu to et menu', () => {
  let tree: Tree;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should replace all Cdk menu symbols in imports and code', async () => {
    const ts = `
import { CdkMenuTrigger, CdkMenuItem, CdkMenu, CdkMenuGroup, CdkMenuItemCheckbox, CdkMenuItemRadio, SomethingElse } from '@ethlete/cdk';

const a = CdkMenuTrigger;
const b = CdkMenuItem;
const c = CdkMenu;
const d = CdkMenuGroup;
const e = CdkMenuItemCheckbox;
const f = CdkMenuItemRadio;
const g = SomethingElse;
`;

    tree.write('libs/ui/src/lib/menu-test.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/menu-test.ts', 'utf-8')!;

    expect(result).toContain(
      "import { MenuTriggerDirective, MenuItemDirective, MenuComponent, MenuGroupDirective, MenuCheckboxItemComponent, MenuRadioItemComponent, SomethingElse } from '@ethlete/cdk';",
    );
    expect(result).not.toContain('CdkMenu');
    expect(result).toContain('const a = MenuTriggerDirective;');
    expect(result).toContain('const b = MenuItemDirective;');
    expect(result).toContain('const c = MenuComponent;');
    expect(result).toContain('const d = MenuGroupDirective;');
    expect(result).toContain('const e = MenuCheckboxItemComponent;');
    expect(result).toContain('const f = MenuRadioItemComponent;');
    expect(result).toContain('const g = SomethingElse;');
  });

  it('should deduplicate symbols in import after migration', async () => {
    const ts = `
import { CdkMenuTrigger, CdkMenuTrigger, CdkMenuItem, MenuTriggerDirective } from '@ethlete/cdk';
const a = CdkMenuTrigger;
const b = MenuTriggerDirective;
`;

    tree.write('libs/ui/src/lib/dupe-test.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/dupe-test.ts', 'utf-8')!;
    // Only one MenuTriggerDirective and one MenuItemDirective in import
    expect(result).toMatch(/import\s*{[^}]*MenuTriggerDirective[^}]*MenuItemDirective[^}]*}\s*from '@ethlete\/cdk';/);
    // No CdkMenuTrigger left
    expect(result).not.toContain('CdkMenuTrigger');
  });

  it('should not touch unrelated imports or code', async () => {
    const ts = `
import { SomethingElse } from '@ethlete/cdk';
import { Foo } from 'bar';

const x = SomethingElse;
const y = Foo;
`;

    tree.write('libs/ui/src/lib/unrelated.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/unrelated.ts', 'utf-8')!;
    expect(result).toContain("import { SomethingElse } from '@ethlete/cdk';");
    expect(result).toContain("import { Foo } from 'bar';");
    expect(result).toContain('const x = SomethingElse;');
    expect(result).toContain('const y = Foo;');
  });

  it('should replace CdkMenuTrigger with MenuTriggerDirective', async () => {
    const ts = `import { Existing, CdkMenuTrigger } from '@ethlete/cdk';

export const x = CdkMenuTrigger;
`;

    tree.write('libs/ui/src/lib/merge-test.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/merge-test.ts', 'utf-8')!;

    expect(result).toMatch(/import\s*{\s*Existing\s*,\s*MenuTriggerDirective\s*}\s*from\s*'@ethlete\/cdk';/);
    expect(result).not.toContain('CdkMenuTrigger');
    expect(result).toContain('export const x = MenuTriggerDirective');
  });

  it('replaces et menu symbols in decorator imports array with MenuImports', async () => {
    const ts = `
import { MenuCheckboxItemComponent, MenuRadioItemComponent, MenuCheckboxGroupDirective, MenuSearchTemplateDirective } from '@ethlete/cdk';

@Component({
  selector: 'x',
  imports: [MenuCheckboxItemComponent, MenuRadioItemComponent, MenuCheckboxGroupDirective, MenuSearchTemplateDirective, SomethingElse]
})
export class X {}
`;
    tree.write('libs/ui/src/lib/decorator-test.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/decorator-test.ts', 'utf-8')!;
    expect(result).toContain('imports: [MenuImports, SomethingElse]');
    expect(result).toContain("import { MenuImports } from '@ethlete/cdk';");
  });

  it('replaces menu symbols in decorator imports array with MenuImports', async () => {
    const ts = `
import { CdkMenuTrigger, CdkMenuItem } from '@ethlete/cdk';

@Component({
  selector: 'x',
  imports: [CdkMenuTrigger, CdkMenuItem, SomethingElse]
})
export class X {}
`;
    tree.write('libs/ui/src/lib/decorator-test.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/decorator-test.ts', 'utf-8')!;
    expect(result).toContain('imports: [MenuImports, SomethingElse]');
    expect(result).toContain("import { MenuImports } from '@ethlete/cdk';");
  });

  it('adds MenuImports import if missing and used in decorator', async () => {
    const ts = `
import { CdkMenuTrigger } from '@ethlete/cdk';

@Directive({
  selector: '[x]',
  imports: [CdkMenuTrigger]
})
export class X {}
`;
    tree.write('libs/ui/src/lib/add-import.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/add-import.ts', 'utf-8')!;
    expect(result).toContain("import { MenuImports } from '@ethlete/cdk';");
    expect(result).toContain('imports: [MenuImports]');
  });

  it('does not add duplicate MenuImports if already present', async () => {
    const ts = `
import { MenuImports, CdkMenuTrigger } from '@ethlete/cdk';

@Component({
  imports: [CdkMenuTrigger]
})
export class X {}
`;
    tree.write('libs/ui/src/lib/no-dupe.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/no-dupe.ts', 'utf-8')!;
    // Only one MenuImports in import
    expect(result.match(/MenuImports/g)?.length).toBe(2);
    expect(result).toContain('imports: [MenuImports]');
    expect(result).toContain("import { MenuImports } from '@ethlete/cdk';");
  });

  it('does not touch unrelated files', async () => {
    const ts = `
import { SomethingElse } from '@ethlete/cdk';
const x = SomethingElse;
`;
    tree.write('libs/ui/src/lib/unrelated.ts', ts);

    await migrateCdkMenu(tree);

    const result = tree.read('libs/ui/src/lib/unrelated.ts', 'utf-8')!;
    expect(result).toBe(ts);
  });

  it('replaces [cdkMenuTriggerFor] binding with [etMenuTrigger]', async () => {
    const html = `
<button [cdkMenuTriggerFor]="menu">Open Menu</button>
<ng-template #menu>
  <div cdkMenu>
    <button cdkMenuItem>Item 1</button>
  </div>
</ng-template>

`;
    tree.write('libs/ui/src/lib/menu.component.html', html);
    await migrateCdkMenu(tree);
    const result = tree.read('libs/ui/src/lib/menu.component.html', 'utf-8')!;
    expect(result).toContain('[etMenuTrigger]');
    expect(result).not.toContain('[cdkMenuTriggerFor]');
  });

  it('handles ng-template with cdkMenu directive', async () => {
    const html = `
<button [cdkMenuTriggerFor]="screenMenu" size="small">
  Open
</button>

<ng-template #screenMenu>
  <nav cdkMenu>
    <button (click)="confirmAndDeleteCollection()" cdkMenuItem>
      Delete compilation
    </button>
  </nav>
</ng-template>
`;
    tree.write('libs/ui/src/lib/template-menu.component.html', html);
    await migrateCdkMenu(tree);
    const result = tree.read('libs/ui/src/lib/template-menu.component.html', 'utf-8')!;

    expect(result).toContain('[etMenuTrigger]="screenMenu"');
    expect(result).toContain('<et-menu>');
    expect(result).toContain('</et-menu>');
    expect(result).not.toContain('[cdkMenuTriggerFor]');
    expect(result).not.toContain('cdkMenu');
    expect(result).not.toContain('<nav cdkMenu>');
    expect(result).toContain('<ng-template');
  });

  it('migrates cdkMenu and cdkMenuItemRadio with warning and preserves structure', async () => {
    const html = `
<ng-template #cdkMenuTpl>
  <div [lastElement]="tpl" cdkMenu dynObserveLastElementVisibility>
    <button [disabled]="!selectedCompetition" (click)="resetSelection()" class="cdk-menu-reset-item" type="button">
      Alle Wettbewerbe
    </button>
    @for (competition of competitions$ | async; track trackByFn($index, competition)) {
      <button
        [cdkMenuItemChecked]="selectedCompetition?.uuid === competition.uuid"
        (cdkMenuItemTriggered)="updateContextMenuSelection(competition.uuid)"
        type="button"
        cdkMenuItemRadio
      >
        {{ competition.name }}
        @if (selectedCompetition?.uuid === competition.uuid) {
          <i class="ml-2" dyn-icon="check" variant="light"></i>
        }
      </button>
    }
    <div #tpl class="h-0"></div>
  </div>
</ng-template>
`;
    tree.write('libs/ui/src/lib/radio-menu.html', html);
    await migrateCdkMenu(tree);
    const result = tree.read('libs/ui/src/lib/radio-menu.html', 'utf-8')!;
    expect(result).toContain('<et-menu [lastElement]="tpl"  dynObserveLastElementVisibility>');
    expect(result).toContain('<et-menu-radio-item');
    expect(result).toContain('value="TODO"');
    expect(result).toContain('@for (competition of competitions$ | async; track trackByFn($index, competition)) {');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('etMenuRadioGroup'));
  });
});
