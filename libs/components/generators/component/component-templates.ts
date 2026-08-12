import { ComponentNames } from './component-names';

export const TIERS = ['both', 'component', 'headless'] as const;

/**
 * Which tiers of the three-tier architecture the domain gets: `both` is a headless directive plus
 * the default component that applies it, `component` a presentational component only, `headless` a
 * behavior directive only.
 */
export type Tier = (typeof TIERS)[number];

export type TemplateOptions = {
  tier: Tier;
  errors: boolean;
};

const TICK = '`';

export function directiveFile(n: ComponentNames): string {
  return `import { Directive } from '@angular/core';

/**
 * Describe the behavior and state this directive owns, and the markup it expects around it.
 *
 * @example
 * <div ${n.attributeSelector}>…</div>
 */
@Directive({
  selector: '[${n.attributeSelector}]',
})
export class ${n.className}Directive {}
`;
}

export function componentFile(n: ComponentNames, options: TemplateOptions): string {
  const headless = options.tier === 'both';
  const importPath = `./headless/${n.fileName}.directive`;

  return `import { Component, ViewEncapsulation } from '@angular/core';
${headless ? `import { ${n.className}Directive } from '${importPath}';\n` : ''}
/**
 * Describe what this component renders and when to reach for it.
 *
 * @example
 * <${n.elementSelector}>…</${n.elementSelector}>
 */
@Component({
  selector: '${n.elementSelector}',
  template: ${TICK}<ng-content />${TICK},
  styleUrl: './${n.fileName}.component.css',
  encapsulation: ViewEncapsulation.None,
${headless ? `  hostDirectives: [${n.className}Directive],\n` : ''}  host: {
    class: '${n.elementSelector}',
  },
})
export class ${n.className}Component {}
`;
}

export function stylesFile(n: ComponentNames): string {
  return `@layer components {
  .${n.elementSelector} {
    display: block;
  }
}
`;
}

export function errorsFile(n: ComponentNames, block: number): string {
  return `// codes ${block}-${block + 99}
export const ${n.constantName}_ERROR_CODES = {
  /** Describe the misuse this code reports. */
  PLACEHOLDER: ${block},
} as const;
`;
}

export function importsFile(n: ComponentNames, options: TemplateOptions): string {
  const component = `import { ${n.className}Component } from './${n.fileName}.component';`;
  const directive =
    options.tier === 'both'
      ? `import { ${n.className}Directive } from './headless/${n.fileName}.directive';`
      : `import { ${n.className}Directive } from './${n.fileName}.directive';`;

  const imports =
    options.tier === 'both' ? `${directive}\n${component}` : options.tier === 'component' ? component : directive;

  const members =
    options.tier === 'both'
      ? `${n.className}Component, ${n.className}Directive`
      : options.tier === 'component'
        ? `${n.className}Component`
        : `${n.className}Directive`;

  return `${imports}

export const ${n.constantName}_IMPORTS = [${members}] as const;
`;
}

export function headlessBarrelFile(n: ComponentNames): string {
  return `export * from './${n.fileName}.directive';\n`;
}

export function barrelFile(n: ComponentNames, options: TemplateOptions): string {
  const exports: string[] = [];

  if (options.tier === 'both') exports.push(`export * from './headless';`);
  if (options.tier === 'headless') exports.push(`export * from './${n.fileName}.directive';`);
  if (options.tier !== 'headless') exports.push(`export * from './${n.fileName}.component';`);
  if (options.errors) exports.push(`export * from './${n.fileName}-errors';`);

  exports.push(`export * from './${n.fileName}.imports';`);

  return `${exports.join('\n')}\n`;
}

export function specFile(n: ComponentNames, options: TemplateOptions): string {
  if (options.tier === 'headless') {
    return `import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { ${n.className}Directive } from './${n.fileName}.directive';
import { ${n.constantName}_IMPORTS } from './${n.fileName}.imports';

@Component({
  selector: 'et-test-${n.fileName}-host',
  template: ${TICK}<div ${n.attributeSelector}>Content</div>${TICK},
  imports: [${n.constantName}_IMPORTS],
})
class ${n.className}HostComponent {}

describe('${n.className}Directive', () => {
  it('applies to its host', () => {
    const fixture = TestBed.createComponent(${n.className}HostComponent);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(${n.className}Directive))).not.toBeNull();
  });
});
`;
  }

  return `import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ${n.constantName}_IMPORTS } from './${n.fileName}.imports';

@Component({
  selector: 'et-test-${n.fileName}-host',
  template: ${TICK}<${n.elementSelector}>Content</${n.elementSelector}>${TICK},
  imports: [${n.constantName}_IMPORTS],
})
class ${n.className}HostComponent {}

describe('${n.className}Component', () => {
  it('renders its projected content', () => {
    const fixture = TestBed.createComponent(${n.className}HostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('${n.elementSelector}') as HTMLElement;

    expect(host.classList.contains('${n.elementSelector}')).toBe(true);
    expect(host.textContent?.trim()).toBe('Content');
  });
});
`;
}

export function storybookComponentFile(n: ComponentNames, options: TemplateOptions): string {
  const markup =
    options.tier === 'headless'
      ? `<div ${n.attributeSelector}>${n.title}</div>`
      : `<${n.elementSelector}>${n.title}</${n.elementSelector}>`;

  return `import { Component, ViewEncapsulation } from '@angular/core';
import { ${n.constantName}_IMPORTS } from '../${n.fileName}.imports';

@Component({
  selector: 'et-sb-${n.fileName}',
  template: ${TICK}
    <div class="p-8 font-sans">
      ${markup}
    </div>
  ${TICK},
  encapsulation: ViewEncapsulation.None,
  imports: [${n.constantName}_IMPORTS],
})
export class ${n.className}StorybookComponent {}
`;
}

export function storiesFile(n: ComponentNames): string {
  return `import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ${n.className}StorybookComponent } from './${n.fileName}-storybook.component';

export default {
  title: 'Components/${n.category}/${n.title}',
  component: ${n.className}StorybookComponent,
  decorators: [moduleMetadata({ imports: [${n.className}StorybookComponent] })],
} as Meta<${n.className}StorybookComponent>;

type Story = StoryObj<${n.className}StorybookComponent>;

export const Default: Story = {};
`;
}

export function docsFile(n: ComponentNames, options: TemplateOptions): string {
  const subject =
    options.tier === 'headless' ? `${TICK}[${n.attributeSelector}]${TICK}` : `${TICK}${n.elementSelector}${TICK}`;
  const markup =
    options.tier === 'headless'
      ? `<div ${n.attributeSelector}>…</div>`
      : `<${n.elementSelector}>…</${n.elementSelector}>`;

  return `# ${n.title}

${subject} is … Say what it is in one sentence, then when to reach for it over the alternatives. Import ${TICK}${n.constantName}_IMPORTS${TICK}.

${TICK}${TICK}${TICK}ts
import { ${n.constantName}_IMPORTS } from '@ethlete/components';
${TICK}${TICK}${TICK}

${TICK}${TICK}${TICK}html
${markup}
${TICK}${TICK}${TICK}

## Live demo

<StoryEmbed id="${n.storyIdPrefix}--default" height="240px" />

## Options

| Input | Type | Default | Description |
| ----- | ---- | ------- | ----------- |

## Accessibility

Describe the roles, the keyboard model and what a screen reader announces.

## Theming

List the public ${TICK}--et-${n.fileName}-*${TICK} design tokens and their defaults, and which theming tokens the
colors resolve from. See [theming](/core/theming).
`;
}
