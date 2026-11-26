import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from '../migrate-provider-shape/migration-scope.js';
import { collectFiles, TransformReport } from './migration-files.js';

export const REMOVED_EXPORTS = new Map<string, string>([
  ...['Memo', 'MemoConfig', 'MemoResolver', 'MapLike'].map(
    (name) => [name, 'together with the @Memo decorator and has no replacement.'] as const,
  ),
  ...[
    'createProps',
    'createHostProps',
    'createPropHandlers',
    'createSetup',
    'createDependencyStash',
    'createElementDictionary',
    'bindProps',
    'unbindProps',
    'PropsDirective',
    'templateComputed',
    'ComponentType',
    'AnyTemplateType',
    'TemplateRefWithContext',
    'ComponentTypeWithInputs',
    'StringTemplate',
    'NgTemplateTemplate',
    'ComponentTemplate',
    'Props',
    'PropsAttachedElements',
    'PropsAttachedElementsInternal',
    'PropsInternal',
    'CreatePropsOptions',
    'HostProps',
    'PropHandlers',
    'BindPropsOptions',
    'UnbindPropsOptions',
  ].map((name) => [name, 'together with the props module and has no replacement.'] as const),
  ...['LetDirective', 'LetContext'].map(
    (name) =>
      [
        name,
        "in v5. Use Angular's `@let`. `@ethlete/cdk:migrate-to-v5` rewrites `*etLet` templates; without the cdk, rewrite them by hand.",
      ] as const,
  ),
  ...['IsActiveElementDirective', 'IS_ACTIVE_ELEMENT', 'IsElementDirective', 'IS_ELEMENT'].map(
    (name) =>
      [
        name,
        'in v5. Inside a scrollable, use `ScrollableIsActiveChildDirective`; `@ethlete/cdk:migrate-to-v5` rewrites it.',
      ] as const,
  ),
  ...['ObserveResizeDirective', 'ResizeObserverService', 'ResizeObserverFactory', 'createResizeObservable'].map(
    (name) => [name, 'in v5. Use `signalElementDimensions()`.'] as const,
  ),
  ...['ObserveContentDirective', 'ContentObserverService', 'MutationObserverFactory', 'createMutationObservable'].map(
    (name) => [name, 'in v5. Use `signalElementMutations()`.'] as const,
  ),
  ...[
    'ObserveVisibilityDirective',
    'OBSERVE_VISIBILITY_TOKEN',
    'ObserveVisibilityChange',
    'IntersectionObserverService',
    'IntersectionObserverFactory',
    'getIntersectionInfo',
    'signalVisibilityChangeClasses',
  ].map((name) => [name, 'in v5. Use `signalElementIntersection()`.'] as const),
  ...[
    'ObserveScrollStateDirective',
    'OBSERVE_SCROLL_STATE',
    'ScrollObserverFirstElementDirective',
    'ScrollObserverLastElementDirective',
    'ScrollObserverIgnoreTargetDirective',
    'SCROLL_OBSERVER_FIRST_ELEMENT_CLASS',
    'SCROLL_OBSERVER_IGNORE_TARGET_CLASS',
    'SCROLL_OBSERVER_LAST_ELEMENT_CLASS',
    'SCROLL_OBSERVER_OBSERVING_FIRST_ELEMENT_CLASS',
    'SCROLL_OBSERVER_OBSERVING_LAST_ELEMENT_CLASS',
    'ScrollObserverScrollState',
    'ObservedScrollableChild',
    'areScrollStatesEqual',
  ].map(
    (name) =>
      [
        name,
        'in v5. Use `signalElementScrollState()`, or `ScrollableScrollState` of the `@ethlete/components` scrollable.',
      ] as const,
  ),
  ...['CursorDragScrollDirective', 'CURSOR_DRAG_SCROLLING_CLASS', 'CURSOR_DRAG_SCROLLING_PREPARED_CLASS'].map(
    (name) => [name, 'in v5. Use `useCursorDragScroll()`.'] as const,
  ),
  ...['RootBoundaryDirective', 'ROOT_BOUNDARY_TOKEN'].map(
    (name) => [name, 'in v5. Use `provideBoundaryElement()`.'] as const,
  ),
  ...['DelayableDirective', 'DELAYABLE_TOKEN'].map(
    (name) => [name, 'in v5. Use `provideInfinityQueryResponseDelay()` from `@ethlete/query`.'] as const,
  ),
  ...[
    'SeoDirective',
    'SEO_DIRECTIVE_TOKEN',
    'SeoConfig',
    'mergeSeoConfig',
    'OpenGraph',
    'TwitterCard',
    'FacebookCard',
    'AlternateLink',
  ].map(
    (name) => [name, 'in v5. Use the `apply*Binding` functions; the SEO guide has a per-key migration table.'] as const,
  ),
  ...['AnimatedOverlayDirective', 'AnimatedOverlayComponentBase'].map(
    (name) =>
      [
        name,
        'in v5. It moved to `@ethlete/cdk`; `@ethlete/components` overlays use the overlay strategy controller.',
      ] as const,
  ),
  ...[
    'SelectionModel',
    'ActiveSelectionModel',
    'SelectionModelBinding',
    'SelectionModelOptionValueFn',
    'SelectionModelPropertyPath',
    'SelectionModelTypes',
  ].map((name) => [name, 'in v5. It moved into the `@ethlete/cdk` select and has no public replacement.'] as const),
  ...['FocusVisibleService'].map((name) => [name, 'in v5. Use `injectFocusVisibleTracker()`.'] as const),
  ...['createMediaQueryObservable'].map(
    (name) => [name, 'in v5. Use `injectBreakpointIsMatched()` or the other media query signals.'] as const,
  ),
  ...['createReactiveBindings', 'ReactiveAttributes', 'ReactiveBindingResult'].map(
    (name) => [name, 'in v5. Use `signalHostClasses()` / `signalHostAttributes()`.'] as const,
  ),
  ...['debouncedControlValueSignal', 'DebouncedControlValueSignalOptions'].map(
    (name) =>
      [name, 'in v5. Debounce the `controlValueSignal()` value with `toObservable()` and `debounceTime()`.'] as const,
  ),
  ...['ProviderResult', 'RootProviderResult', 'StaticProviderResult', 'CreateProviderOptions'].map(
    (name) =>
      [
        name,
        'in v5. It belonged to the removed `create*Provider` factories, which `@ethlete/core:migrate-provider-shape` rewrites.',
      ] as const,
  ),
  ...['VIEWPORT_CONFIG'].map((name) => [name, 'in v5. Use `provideViewportConfig()`.'] as const),
  ...[
    'ClickObserverService',
    'ClickObserverFactory',
    'DebugDirective',
    'DEBUG_TOKEN',
    'HostDirective',
    'MaybeObservable',
    'Primitive',
    'Reference',
    'Size',
    'Validators',
    'isEmptyArray',
    'isObjectArray',
    'isPrimitiveArray',
    'ScrollEnhancementsConfig',
    'SmartBlockScrollStrategy',
  ].map((name) => [name, 'in v5. It has no replacement.'] as const),
]);

const ET_PROPS_ATTRIBUTE = /\betProps\b/;

export default async function reportRemovedExports(tree: Tree, scope?: MigrationScope): Promise<TransformReport> {
  const review: string[] = [];

  for (const filePath of collectFiles(tree, scope, ['.ts', '.html'])) {
    const messages = filePath.endsWith('.ts') ? findRemovedImports(tree, filePath) : findEtPropsUsage(tree, filePath);

    review.push(...messages.map((message) => `${filePath}: ${message}`));
  }

  return { filesChanged: 0, review };
}

function findRemovedImports(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('@ethlete/core')) return [];

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const messages: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;

    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || specifier.text !== '@ethlete/core') continue;

    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : statement.exportClause;
    if (!bindings || ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings)) continue;

    for (const element of bindings.elements) {
      const name = (element.propertyName ?? element.name).text;
      const successor = REMOVED_EXPORTS.get(name);

      if (successor) {
        messages.push(`${name} was removed from @ethlete/core ${successor}`);
      }
    }
  }

  return messages;
}

function findEtPropsUsage(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !ET_PROPS_ATTRIBUTE.test(content)) return [];

  return ['[etProps] (PropsDirective) was removed from @ethlete/core together with the props module.'];
}
