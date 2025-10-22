import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateEtLet } from './et-let';

describe('migrate-to-v5 -> *etLet', () => {
  let tree: Tree;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('HTML templates', () => {
    it('should handle nested divs and update all variable references in deep content', () => {
      tree.write(
        'test.component.html',
        `<div class="outer">
  <div *ngLet="data$ | async as side">
    <div class="inner">
      @if (side?.participant) {
        <span>{{ side.name }}</span>
      }
    </div>
  </div>
  <div *ngLet="otherData$ | async as side">
    <div class="inner">
      @if (side?.participant) {
        <span>{{ side.name }}</span>
      }
    </div>
  </div>
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check @let statements created
      expect(result).toContain('@let side = data$ | async;');
      expect(result).toContain('@let side2 = otherData$ | async;');

      // Verify first block uses 'side'
      const firstBlock = result!.substring(result!.indexOf('@let side ='), result!.indexOf('@let side2'));
      expect(firstBlock).toContain('@if (side?.participant)');
      expect(firstBlock).toContain('{{ side.name }}');

      // Verify second block uses 'side2'
      const secondBlock = result!.substring(result!.indexOf('@let side2'));
      expect(secondBlock).toContain('@if (side2?.participant)');
      expect(secondBlock).toContain('{{ side2.name }}');

      // Ensure no unrenamed variables in second block
      expect(secondBlock).not.toMatch(/@if \(side\?/);
      expect(secondBlock).not.toMatch(/\{\{ side\./);

      // Verify no directives remain
      expect(result).not.toContain('*ngLet');
    });

    it('should handle duplicate variable names in separate ng-containers within control flow blocks', () => {
      tree.write(
        'test.component.html',
        `<div>
  <ol>
    <ng-container *ngLet="selectedStagesMap() as selectedStages">
      @for (stage of stages?.items; track trackByStageFn($index, stage)) {
        <li>
          @if (stage | normalizeStage; as normalizedStage) {
            <div
              *ngLet="normalizedStage.root?.media?.['brand'] as logoMedia"
              [ngClass]="{ 'rounded': !logoMedia, 'opacity-30': selectedStages?.[stage!.id] }"
            >
              @if (logoMedia) {
                <img [src]="logoMedia.url" [alt]="normalizedStage.fullName" />
              }
            </div>
            <span [ngClass]="{ 'text-gray': selectedStages?.[stage!.id] }">
              {{ normalizedStage.fullName }}
            </span>
          }
        </li>
      }
    </ng-container>
  </ol>
  <ol>
    @for (stage of selectedStages(); track stage.id) {
      <li>
        @if (stage | normalizeStage; as normalizedStage) {
          <div
            *ngLet="normalizedStage.root?.media?.['brand'] as logoMedia"
            [ngClass]="{ 'rounded': !logoMedia }"
          >
            @if (logoMedia) {
              <img [src]="logoMedia.url" [alt]="normalizedStage.fullName" />
            }
          </div>
          <span>{{ normalizedStage.fullName }}</span>
        </li>
      }
    </ol>
  </ol>
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that all @let statements are created with unique names
      expect(result).toContain('@let selectedStages = selectedStagesMap();');
      expect(result).toContain("@let logoMedia = normalizedStage.root?.media?.['brand'];");
      expect(result).toContain("@let logoMedia2 = normalizedStage.root?.media?.['brand'];");

      // Verify first logoMedia block
      const firstLogoMediaBlock = result!.substring(
        result!.indexOf('@let logoMedia ='),
        result!.indexOf('@let logoMedia2'),
      );
      expect(firstLogoMediaBlock).toContain(
        "[ngClass]=\"{ 'rounded': !logoMedia, 'opacity-30': selectedStages?.[stage!.id] }\"",
      );
      expect(firstLogoMediaBlock).toContain('@if (logoMedia)');
      expect(firstLogoMediaBlock).toContain('[src]="logoMedia.url"');

      // Verify second logoMedia block (should use logoMedia2)
      const secondLogoMediaBlock = result!.substring(result!.indexOf('@let logoMedia2'));
      expect(secondLogoMediaBlock).toContain("[ngClass]=\"{ 'rounded': !logoMedia2 }");
      expect(secondLogoMediaBlock).toContain('@if (logoMedia2)');
      expect(secondLogoMediaBlock).toContain('[src]="logoMedia2.url"');

      // Ensure the second block doesn't reference the original logoMedia
      const secondBlockContent = secondLogoMediaBlock.substring(0, secondLogoMediaBlock.indexOf('</ol>'));
      expect(secondBlockContent).not.toMatch(/\blogoMedia\b(?!2)/);

      // Verify selectedStages is used correctly throughout
      expect(result).toContain('selectedStages?.[stage!.id]');

      // Verify no directives remain
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');

      // Count @let statements
      const letStatements = result!.match(/@let \w+ = .+?;/g);
      expect(letStatements).toHaveLength(3); // selectedStages, logoMedia, logoMedia2
    });

    it('should update variable references in inner content when variable is renamed in ng-container', () => {
      tree.write(
        'test.component.html',
        `<ng-container *ngLet="data$ | async as logoMedia">
  <div [ngClass]="{ 'rounded': !logoMedia }">
    @if (logoMedia) {
      <img [src]="logoMedia.url" [alt]="logoMedia.name" />
    }
    <span>{{ logoMedia.title }}</span>
  </div>
</ng-container>
<ng-container *ngLet="otherData$ | async as logoMedia">
  <div [ngClass]="{ 'hidden': !logoMedia }">
    @if (logoMedia) {
      <img [src]="logoMedia.url" />
    }
  </div>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that both @let statements are created with unique names
      expect(result).toContain('@let logoMedia = data$ | async;');
      expect(result).toContain('@let logoMedia2 = otherData$ | async;');

      // Verify first block uses logoMedia
      const firstBlock = result!.substring(0, result!.indexOf('@let logoMedia2'));
      expect(firstBlock).toContain('[ngClass]="{ \'rounded\': !logoMedia }"');
      expect(firstBlock).toContain('@if (logoMedia)');
      expect(firstBlock).toContain('[src]="logoMedia.url"');
      expect(firstBlock).toContain('[alt]="logoMedia.name"');
      expect(firstBlock).toContain('{{ logoMedia.title }}');

      // Verify second block uses logoMedia2
      const secondBlock = result!.substring(result!.indexOf('@let logoMedia2'));
      expect(secondBlock).toContain('[ngClass]="{ \'hidden\': !logoMedia2 }"');
      expect(secondBlock).toContain('@if (logoMedia2)');
      expect(secondBlock).toContain('[src]="logoMedia2.url"');

      // Ensure no unreplaced original variable in second block
      expect(secondBlock).not.toMatch(/\blogoMedia\b/);

      // Verify no *ngLet directives remain
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');
    });

    it('should handle duplicate variable names by appending numbers', () => {
      tree.write(
        'test.component.html',
        `<a
  *etLet="
    wrappedDataService.previousStoryIndex() === null || !wrappedDataService.storyBackgroundsLoaded() as disabled
  "
  [disabled]="disabled"
  [class.pointer-events-none]="disabled"
  [attr.inert]="disabled || null"
>
  Previous
</a>
<a
  *etLet="
    (wrappedDataService.nextStoryIndex() === null && wrappedDataService.previousStoryIndex() === null) ||
    !wrappedDataService.storyBackgroundsLoaded() as disabled
  "
  [disabled]="disabled"
  [class.pointer-events-none]="disabled"
  [attr.inert]="disabled || null"
>
  Next
</a>
<a
  *etLet="wrappedDataService.isLoading() as disabled"
  [disabled]="disabled"
>
  Submit
</a>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that all three @let statements are created with unique names
      expect(result).toContain('@let disabled =');
      expect(result).toContain('@let disabled2 =');
      expect(result).toContain('@let disabled3 =');

      // Verify the first directive uses 'disabled'
      expect(result).toContain(
        '@let disabled = wrappedDataService.previousStoryIndex() === null || !wrappedDataService.storyBackgroundsLoaded();',
      );

      // Verify the second directive uses 'disabled2'
      expect(result).toContain(
        '@let disabled2 = (wrappedDataService.nextStoryIndex() === null && wrappedDataService.previousStoryIndex() === null) || !wrappedDataService.storyBackgroundsLoaded();',
      );

      // Verify the third directive uses 'disabled3'
      expect(result).toContain('@let disabled3 = wrappedDataService.isLoading();');

      // Check that attribute names are NOT renamed
      expect(result).toContain('[disabled]="disabled"');
      expect(result).toContain('[disabled]="disabled2"');
      expect(result).toContain('[disabled]="disabled3"');

      // Ensure we don't have renamed attribute names like [disabled2]
      expect(result).not.toContain('[disabled2]');
      expect(result).not.toContain('[disabled3]');

      // Verify all attribute values reference the correct renamed variables
      const lines = result!.split('\n');
      const disabled2Section = result!.substring(result!.indexOf('@let disabled2'), result!.indexOf('@let disabled3'));
      expect(disabled2Section).toContain('[class.pointer-events-none]="disabled2"');
      expect(disabled2Section).toContain('[attr.inert]="disabled2 || null"');

      // Verify no *etLet directives remain
      expect(result).not.toContain('*etLet');
    });

    it('should remove consecutive blank lines between @let statements', () => {
      tree.write(
        'test.component.html',
        `@let isAdmin = userContext.isAdmin();

<ng-container *ngLet="competitionData$ | async as competitionData">
  <ng-container *ngLet="competitionActionStore$ | async as action">
    <ng-container *ngLet="competitionAdminActionStore$ | async as adminAction">
      <ng-container *ngLet="action?.store | suspense as actionStore">
        <ng-container *ngLet="adminAction?.store | suspense as adminActionStore">
          <div>Content</div>
        </ng-container>
      </ng-container>
    </ng-container>
  </ng-container>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that @let statements are grouped together without multiple blank lines between them
      const letStatements = result!.match(/@let [^;]+;/g);
      expect(letStatements).toHaveLength(6);

      // Verify no double blank lines between consecutive @let statements
      expect(result).not.toMatch(/@let [^;]+;\n\n\n+@let/);

      // Verify @let statements are grouped with single newlines
      expect(result).toMatch(/@let isAdmin = userContext\.isAdmin\(\);\n@let competitionData/);
      expect(result).toMatch(/@let competitionData[^;]+;\n {2}@let action/);
      // Verify there's proper spacing between @let block and content
      expect(result).toMatch(/@let adminActionStore[^;]+;\n+\s*<div>Content<\/div>/);

      // Verify no *ngLet directives remain
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');
    });

    it('should handle deeply nested ng-containers with 5 levels', () => {
      tree.write(
        'test.component.html',
        `@let isAdmin = userContext.isAdmin();

<ng-container *ngLet="competitionData$ | async as competitionData">
  <ng-container *ngLet="competitionActionStore$ | async as action">
    <ng-container *ngLet="competitionAdminActionStore$ | async as adminAction">
      <ng-container *ngLet="action?.store | suspense as actionStore">
        <ng-container *ngLet="adminAction?.store | suspense as adminActionStore">
          <gg-app-header-actions> 
            <ng-container />
          </gg-app-header-actions>
        </ng-container>
      </ng-container>
    </ng-container>
  </ng-container>
  <gg-app-subheader class="flex h-10 border-t border-b border-t-gg-dark-0 border-b-gg-dark-3 md:border-t-0">
  </gg-app-subheader>

  <gg-layout-default> </gg-layout-default>
</ng-container>
<ng-template #supportButtonTpl> </ng-template>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that all 5 @let statements are created
      expect(result).toContain('@let competitionData = competitionData$ | async;');
      expect(result).toContain('@let action = competitionActionStore$ | async;');
      expect(result).toContain('@let adminAction = competitionAdminActionStore$ | async;');
      expect(result).toContain('@let actionStore = action?.store | suspense;');
      expect(result).toContain('@let adminActionStore = adminAction?.store | suspense;');

      // Check that the existing @let is preserved
      expect(result).toContain('@let isAdmin = userContext.isAdmin();');

      // Check that all ng-containers with *ngLet are removed
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('<ng-container *ngLet');

      // Check that the content structure is preserved
      expect(result).toContain('<gg-app-header-actions>');
      expect(result).toContain('<gg-app-subheader');
      expect(result).toContain('<gg-layout-default>');
      expect(result).toContain('<ng-template #supportButtonTpl>');

      // Verify all 5 @let statements exist
      const letStatements = result!.match(/@let \w+ = .+?;/g);
      expect(letStatements).toHaveLength(6); // 5 converted + 1 existing
    });

    it('should handle nested ng-containers and only convert those with *etLet directives', () => {
      tree.write(
        'test.component.html',
        `<ng-container *etLet="foo as bar">
  <div>
    @if (bar) {
      <ng-container someOtherStuff>
        <a *etLet="baz as taz" href="#">
          {{ taz }}
        </a>
      </ng-container>
    }
  </div>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that both @let statements are created
      expect(result).toContain('@let bar = foo;');
      expect(result).toContain('@let taz = baz;');

      // The ng-container with *etLet should be removed
      expect(result).not.toContain('*etLet');

      // The ng-container WITHOUT *etLet should be preserved
      expect(result).toContain('<ng-container someOtherStuff>');
      expect(result).toContain('</ng-container>');

      // Verify structure
      expect(result).toContain('@if (bar)');
      expect(result).toContain('<a href="#">');
      expect(result).toContain('{{ taz }}');
    });

    it('should convert *etLet on ng-container to @let', () => {
      tree.write(
        'test.component.html',
        `<ng-container *etLet="user$ | async as user">
  <div>{{ user.name }}</div>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let user = user$ | async;');
      expect(result).toContain('<div>{{ user.name }}</div>');
      expect(result).not.toContain('ng-container');
      expect(result).not.toContain('*etLet');
    });

    it('should convert *ngLet on ng-container to @let', () => {
      tree.write(
        'test.component.html',
        `<ng-container *ngLet="value$ | async as value">
  <span>{{ value }}</span>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let value = value$ | async;');
      expect(result).not.toContain('*ngLet');
    });

    it('should convert *etLet on regular element', () => {
      tree.write('test.component.html', `<div *etLet="value as v">{{ v }}</div>`);

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let v = value;');
      expect(result).toContain('<div>{{ v }}</div>');
      expect(result).not.toContain('*etLet');
    });

    it('should preserve indentation', () => {
      tree.write(
        'test.component.html',
        `  <ng-container *etLet="value as v">
    <div>{{ v }}</div>
  </ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('  @let v = value;');
    });

    it('should handle multiple *etLet directives in the same file', () => {
      tree.write(
        'test.component.html',
        `<ng-container *etLet="user$ | async as user">
  <div>{{ user.name }}</div>
</ng-container>

<ng-container *etLet="items$ | async as items">
  <div>{{ items.length }}</div>
</ng-container>

<div *etLet="count as c">{{ c }}</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that all three @let statements are present
      expect(result).toContain('@let user = user$ | async;');
      expect(result).toContain('@let items = items$ | async;');
      expect(result).toContain('@let c = count;');

      // Check that content is preserved
      expect(result).toContain('<div>{{ user.name }}</div>');
      expect(result).toContain('<div>{{ items.length }}</div>');
      expect(result).toContain('<div>{{ c }}</div>');

      // Check that no *etLet directives remain
      expect(result).not.toContain('*etLet');
      expect(result).not.toContain('ng-container');

      // Verify the structure is not corrupted
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(3);
    });

    it('should handle complex nested structure with multiple *ngLet directives', () => {
      tree.write(
        'test.component.html',
        `<div class="container">
  <ol class="list">
    <ng-container *ngLet="selectedMemberAssociationsMap$ | async as selectedMemberAssociations">
      @if (store.response$ | async; as response) {
        @for (memberAssociation of response.items; track trackByFn($index, memberAssociation)) {
          <li>
            <button
              [disabled]="selectedMemberAssociations?.[memberAssociation!.id]"
              (click)="addItem(memberAssociation!.id)"
              class="button"
            >
              <div
                *ngLet="memberAssociation?.countryFlag | parseImage as countryFlag"
                [ngClass]="{
                  'rounded': !countryFlag,
                  'opacity-30': selectedMemberAssociations?.[memberAssociation!.id],
                }"
                class="flag-container"
              >
                @if (countryFlag) {
                  <img [src]="countryFlag" [alt]="memberAssociation?.countryName" />
                }
              </div>
              <span>{{ memberAssociation?.countryName }}</span>
            </button>
          </li>
        }
      }
    </ng-container>
  </ol>
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that both @let statements are present
      expect(result).toContain('@let selectedMemberAssociations = selectedMemberAssociationsMap$ | async;');
      expect(result).toContain('@let countryFlag = memberAssociation?.countryFlag | parseImage;');

      // Check that the nested structure is preserved
      expect(result).toContain('@if (store.response$ | async; as response)');
      expect(result).toContain('@for (memberAssociation of response.items;');
      expect(result).toContain('[disabled]="selectedMemberAssociations?.[memberAssociation!.id]"');
      expect(result).toContain('selectedMemberAssociations?.[memberAssociation!.id]');
      expect(result).toContain('@if (countryFlag)');

      // Check that no *ngLet or ng-container remains
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');

      // Verify both @let statements exist
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(2);
    });

    it('should handle deeply nested *etLet with control flow', () => {
      tree.write(
        'test.component.html',
        `<div class="wrapper">
  @if (listStore$ | async; as store) {
    <ol class="list">
      <ng-container *etLet="selectedItems$ | async as selectedItems">
        @for (item of store.items; track item.id) {
          <li>
            <div *etLet="item.image | parseImage as parsedImage" class="image-wrapper">
              @if (parsedImage) {
                <img [src]="parsedImage" />
              }
              <span>{{ item.name }}</span>
              @if (!selectedItems?.[item.id]) {
                <button (click)="select(item.id)">Select</button>
              }
            </div>
          </li>
        }
      </ng-container>
    </ol>
  }
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check both @let statements
      expect(result).toContain('@let selectedItems = selectedItems$ | async;');
      expect(result).toContain('@let parsedImage = item.image | parseImage;');

      // Verify structure preservation
      expect(result).toContain('@if (listStore$ | async; as store)');
      expect(result).toContain('@for (item of store.items; track item.id)');
      expect(result).toContain('@if (parsedImage)');
      expect(result).toContain('@if (!selectedItems?.[item.id])');

      // No directives remain
      expect(result).not.toContain('*etLet');
      expect(result).not.toContain('ng-container');

      // Count @let statements
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(2);
    });

    it('should handle nested ng-containers with *ngLet directives', () => {
      tree.write(
        'test.component.html',
        `  @if (contentful.fields.image.sys | contentfulAsset: assets; as asset) {
    <ng-container *ngLet="asset?.fields?.file?.url as imageUrl">
      <ng-container *ngLet="asset?.fields?.title as title">
        <picture class="w-full rounded-gg-l sm:w-6/12">
          <source
            class="h-full w-full rounded-gg-l object-cover"
            srcset="{{imageUrl}}?fm=webp&w=342 342w, {{imageUrl}}?fm=webp&w=512 512w, {{imageUrl}}?fm=webp&w=1024 1024w"
            type="image/webp"
          />
          <img
            [src]="imageUrl + '?w=342'"
            [alt]="title"
            class="h-full w-full rounded-gg-l object-cover"
            srcset="{{imageUrl}}?w=342 342w, {{imageUrl}}?w=512 512w, {{imageUrl}}?w=1024 1024w"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </ng-container>
    </ng-container>
  }`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that both @let statements are present
      expect(result).toContain('@let imageUrl = asset?.fields?.file?.url;');
      expect(result).toContain('@let title = asset?.fields?.title;');

      // Verify the picture element and its content are preserved
      expect(result).toContain('<picture class="w-full rounded-gg-l sm:w-6/12">');
      expect(result).toContain('srcset="{{imageUrl}}?fm=webp&w=342 342w');
      expect(result).toContain('[src]="imageUrl + \'?w=342\'"');
      expect(result).toContain('[alt]="title"');

      // Check that no *ngLet or ng-container remains
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');

      // Verify both @let statements exist
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(2);
    });

    it('should handle multiline *ngLet expressions', () => {
      tree.write(
        'test.component.html',
        `<div
  *ngLet="
    data.awardee.videoGamePlayer
      | normalizeVideoGamePlayer: { linkResolution: 'public-external' } as normalizedPlayer
  "
>
  <span>{{ normalizedPlayer.name }}</span>
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that the @let statement is created with normalized spacing
      expect(result).toContain(
        "@let normalizedPlayer = data.awardee.videoGamePlayer | normalizeVideoGamePlayer: { linkResolution: 'public-external' };",
      );
      expect(result).toContain('<span>{{ normalizedPlayer.name }}</span>');
      expect(result).not.toContain('*ngLet');
    });

    it('should not modify files without *etLet or *ngLet', () => {
      const original = '<div>No etLet here</div>';
      tree.write('test.component.html', original);

      migrateEtLet(tree);

      expect(tree.read('test.component.html', 'utf-8')).toBe(original);
    });
  });

  describe('Inline templates', () => {
    it('should convert *etLet in inline templates', () => {
      tree.write(
        'test.component.ts',
        `@Component({
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('@let v = value;');
      expect(result).not.toContain('*etLet');
    });

    it('should handle template literals', () => {
      tree.write(
        'test.component.ts',
        `@Component({
  template: \`
    <ng-container *etLet="user$ | async as user">
      <div>{{ user.name }}</div>
    </ng-container>
  \`,
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('@let user = user$ | async;');
      expect(result).not.toContain('ng-container');
    });
  });

  describe('Import removal', () => {
    it('should remove LetDirective from imports array', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain('LetDirective');
      expect(result).not.toContain('imports: [LetDirective]');
    });

    it('should remove NgLetDirective from imports array', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { NgLetDirective } from '@angular/common';

@Component({
  selector: 'app-test',
  imports: [NgLetDirective],
  template: '<ng-container *ngLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain('NgLetDirective');
    });

    it('should preserve other imports when removing LetDirective', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { CommonModule, LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [CommonModule, LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('CommonModule');
      expect(result).not.toContain('LetDirective');
      expect(result).toContain('imports: [CommonModule]');
    });

    it('should remove entire import statement if only LetDirective', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain("from '@ethlete/cdk'");
    });
  });

  describe('Console output', () => {
    it('should log when directives are converted', () => {
      tree.write('test.component.html', '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>');

      migrateEtLet(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating *etLet and *ngLet');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ test.component.html: converted 1 directive(s)'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Migrated 1 file(s)'));
    });

    it('should log when no directives are found', () => {
      tree.write('test.component.html', '<div>No etLet</div>');

      migrateEtLet(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating *etLet and *ngLet');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✅ No *etLet or *ngLet directives found that need migration');
    });
  });
});
