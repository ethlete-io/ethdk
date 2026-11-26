import * as ts from 'typescript';

export type CreateDestroyTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

export type CreateDestroyResult = {
  content: string;
  changed: boolean;
  tasks: CreateDestroyTask[];
};

type Edit = { start: number; end: number; text: string };

type Needs = { takeUntilDestroyed: boolean; destroyRef: boolean };

type FieldUse = { node: ts.PropertyAccessExpression; injection: boolean };

const isEthleteModule = (specifier: string) => specifier.startsWith('@ethlete/');
const isRxjsModule = (specifier: string) => specifier === 'rxjs' || specifier === 'rxjs/operators';

const importedLocalNames = (sourceFile: ts.SourceFile, accepts: (module: string) => boolean, importedName: string) => {
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!accepts(statement.moduleSpecifier.text)) continue;

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === importedName) names.add(element.name.text);
    }
  }

  return names;
};

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

const isCallTo = (node: ts.Node | undefined, names: Set<string>): node is ts.CallExpression =>
  !!node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text);

const hasModifier = (node: ts.HasModifiers, kind: ts.SyntaxKind) => !!node.modifiers?.some((m) => m.kind === kind);

type Context = {
  sourceFile: ts.SourceFile;
  content: string;
  filePath: string;
  destroyFns: Set<string>;
  takeUntilFns: Set<string>;
  edits: Edit[];
  tasks: CreateDestroyTask[];
  handledCalls: Set<ts.Node>;
  needs: Needs;
};

const rebindsThis = (node: ts.Node) =>
  ts.isClassLike(node) ||
  ts.isFunctionExpression(node) ||
  ts.isFunctionDeclaration(node) ||
  ((ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) &&
    ts.isObjectLiteralExpression(node.parent));

const collectThisAccesses = (cls: ts.ClassLikeDeclaration, names: Set<string>) => {
  const uses = new Map<string, FieldUse[]>();

  const visit = (node: ts.Node, injection: boolean): void => {
    if (rebindsThis(node)) return;

    if (ts.isArrowFunction(node)) injection = false;

    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ThisKeyword &&
      names.has(node.name.text)
    ) {
      const list = uses.get(node.name.text) ?? [];
      list.push({ node, injection });
      uses.set(node.name.text, list);
    }

    ts.forEachChild(node, (child) => visit(child, injection));
  };

  for (const member of cls.members) {
    if (hasModifier(member as ts.HasModifiers, ts.SyntaxKind.StaticKeyword)) continue;

    if (ts.isPropertyDeclaration(member)) {
      if (member.initializer) visit(member.initializer, true);
    } else if (ts.isConstructorDeclaration(member)) {
      if (member.body) visit(member.body, true);
    } else {
      ts.forEachChild(member, (child) => visit(child, false));
    }
  }

  return uses;
};

const memberName = (member: ts.ClassElement) =>
  member.name && (ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name)) ? member.name.text : null;

const lineRange = (content: string, node: ts.Node, sourceFile: ts.SourceFile) => {
  let start = node.getStart(sourceFile, true);
  let end = node.getEnd();

  while (start > 0 && content[start - 1] !== '\n') start--;
  while (end < content.length && content[end] !== '\n') end++;
  if (content[end] === '\n') end++;

  return { start, end };
};

const migrateClass = (cls: ts.ClassLikeDeclaration, ctx: Context) => {
  const destroyFields: ts.PropertyDeclaration[] = [];
  const takenNames = new Set<string>();
  let existingRefName: string | null = null;

  for (const member of cls.members) {
    const name = memberName(member);
    if (name) takenNames.add(name);

    if (!ts.isPropertyDeclaration(member) || !name || hasModifier(member, ts.SyntaxKind.StaticKeyword)) continue;

    const initializer = member.initializer;

    if (isCallTo(initializer, ctx.destroyFns) && initializer.arguments.length === 0) {
      destroyFields.push(member);
      ctx.handledCalls.add(initializer);
    } else if (
      initializer &&
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === 'inject' &&
      initializer.arguments.length === 1 &&
      ts.isIdentifier(initializer.arguments[0]!) &&
      (initializer.arguments[0] as ts.Identifier).text === 'DestroyRef' &&
      existingRefName === null &&
      !ts.isPrivateIdentifier(member.name)
    ) {
      existingRefName = name;
    }
  }

  if (destroyFields.length === 0) return;

  const uses = collectThisAccesses(cls, new Set(destroyFields.map((field) => memberName(field)!)));

  const isTakeUntilArg = (use: FieldUse) =>
    isCallTo(use.node.parent, ctx.takeUntilFns) &&
    use.node.parent.arguments.length === 1 &&
    use.node.parent.arguments[0] === use.node;

  const needsRef = [...uses.values()].some((list) => list.some((use) => isTakeUntilArg(use) && !use.injection));

  let refName = existingRefName;

  if (needsRef && !refName) {
    const first = memberName(destroyFields[0]!)!;
    const base = first.startsWith('_') || first.startsWith('#') ? '_destroyRef' : 'destroyRef';
    let candidate = base;
    let suffix = 2;

    while (takenNames.has(candidate)) candidate = `${base}${suffix++}`;

    refName = candidate;
  }

  let refDeclared = existingRefName !== null || !needsRef;

  for (const field of destroyFields) {
    const name = memberName(field)!;
    const fieldUses = uses.get(name) ?? [];
    const takeUntilUses = fieldUses.filter(isTakeUntilArg);
    const otherUses = fieldUses.filter((use) => !isTakeUntilArg(use));
    const isPrivate = hasModifier(field, ts.SyntaxKind.PrivateKeyword) || ts.isPrivateIdentifier(field.name);
    const removable = isPrivate && otherUses.length === 0;

    for (const use of takeUntilUses) {
      const call = use.node.parent as ts.CallExpression;

      ctx.edits.push({
        start: call.getStart(ctx.sourceFile),
        end: call.getEnd(),
        text: `takeUntilDestroyed(${use.injection ? '' : `this.${refName}`})`,
      });
      ctx.needs.takeUntilDestroyed = true;
    }

    for (const use of otherUses) {
      ctx.tasks.push({
        id: `create-destroy:${ctx.filePath}:${lineOf(ctx.sourceFile, use.node)}`,
        file: ctx.filePath,
        line: lineOf(ctx.sourceFile, use.node),
        message: `\`this.${name}\` is used other than as \`takeUntil(this.${name})\`, so the field stays. Replace the use by hand.`,
      });
    }

    if (!isPrivate) {
      ctx.tasks.push({
        id: `create-destroy:${ctx.filePath}:${lineOf(ctx.sourceFile, field)}`,
        file: ctx.filePath,
        line: lineOf(ctx.sourceFile, field),
        message: `\`${name}\` is not private, so it may be used outside this class and the field stays.`,
      });
    }

    const readonly = hasModifier(field, ts.SyntaxKind.ReadonlyKeyword) ? 'readonly ' : '';
    const refDeclaration = `private ${readonly}${refName} = inject(DestroyRef);`;
    const placesRef = !refDeclared;

    if (placesRef) {
      refDeclared = true;
      ctx.needs.destroyRef = true;
    }

    if (removable && placesRef) {
      ctx.edits.push({
        start: field.getStart(ctx.sourceFile),
        end: field.getEnd(),
        text: refDeclaration,
      });
    } else if (removable) {
      const { start, end } = lineRange(ctx.content, field, ctx.sourceFile);

      ctx.edits.push({ start, end, text: '' });
    } else if (placesRef) {
      ctx.edits.push({ start: field.getEnd(), end: field.getEnd(), text: `\n${refDeclaration}` });
    }
  }
};

const countIdentifier = (sourceFile: ts.SourceFile, name: string) => {
  let count = 0;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && node.text === name) count++;
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return count;
};

const applyEdits = (content: string, edits: Edit[]) =>
  [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), content);

const removeUnusedImports = (filePath: string, content: string) => {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const edits: Edit[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    const removeName = isEthleteModule(module) ? 'createDestroy' : isRxjsModule(module) ? 'takeUntil' : null;
    if (!removeName) continue;

    const unused = bindings.elements.filter(
      (element) =>
        (element.propertyName ?? element.name).text === removeName &&
        countIdentifier(sourceFile, element.name.text) === 0,
    );
    if (unused.length === 0) continue;

    const kept = bindings.elements.filter((element) => !unused.includes(element));

    if (kept.length === 0 && !statement.importClause?.name) {
      const { start, end } = lineRange(content, statement, sourceFile);

      edits.push({ start, end, text: '' });
    } else {
      edits.push({
        start: bindings.getStart(sourceFile),
        end: bindings.getEnd(),
        text: `{ ${kept.map((element) => element.getText(sourceFile)).join(', ')} }`,
      });
    }
  }

  return applyEdits(content, edits);
};

const addImports = (filePath: string, content: string, wanted: { module: string; name: string }[]) => {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const edits: Edit[] = [];
  const fresh = new Map<string, string[]>();
  const joined = new Map<ts.ImportDeclaration, string[]>();

  for (const { module, name } of wanted) {
    const declaration = sourceFile.statements.find(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === module &&
        !statement.importClause?.isTypeOnly &&
        !!statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings),
    );
    const bindings = declaration?.importClause?.namedBindings as ts.NamedImports | undefined;

    if (!declaration || !bindings) {
      fresh.set(module, [...(fresh.get(module) ?? []), name]);
      continue;
    }

    if (bindings.elements.some((element) => element.name.text === name && !element.propertyName)) continue;

    joined.set(declaration, [...(joined.get(declaration) ?? []), name]);
  }

  for (const [declaration, names] of joined) {
    const bindings = declaration.importClause!.namedBindings as ts.NamedImports;
    const texts = bindings.elements.map((element) => element.getText(sourceFile));
    const sorted = [...texts].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const wasSorted = texts.every((text, index) => text === sorted[index]);
    const merged = wasSorted
      ? [...texts, ...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      : [...texts, ...names];

    edits.push({ start: bindings.getStart(sourceFile), end: bindings.getEnd(), text: `{ ${merged.join(', ')} }` });
  }

  if (fresh.size > 0) {
    const anchor = sourceFile.statements.filter(ts.isImportDeclaration).at(-1);
    const position = anchor ? anchor.getEnd() : 0;
    const lines = [...fresh].map(([module, names]) => `import { ${[...new Set(names)].join(', ')} } from '${module}';`);

    edits.push({
      start: position,
      end: position,
      text: anchor ? `\n${lines.join('\n')}` : `${lines.join('\n')}\n`,
    });
  }

  return applyEdits(content, edits);
};

/**
 * Rewrites `takeUntil(this.<createDestroy field>)` into `takeUntilDestroyed(…)` in one file and drops
 * the field once nothing else uses it. Every other use of the field is reported, never rewritten.
 */
export const migrateCreateDestroyInFile = (filePath: string, content: string): CreateDestroyResult => {
  if (!content.includes('createDestroy')) return { content, changed: false, tasks: [] };

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const destroyFns = importedLocalNames(sourceFile, isEthleteModule, 'createDestroy');

  if (destroyFns.size === 0) return { content, changed: false, tasks: [] };

  const ctx: Context = {
    sourceFile,
    content,
    filePath,
    destroyFns,
    takeUntilFns: importedLocalNames(sourceFile, isRxjsModule, 'takeUntil'),
    edits: [],
    tasks: [],
    handledCalls: new Set(),
    needs: { takeUntilDestroyed: false, destroyRef: false },
  };

  const visit = (node: ts.Node) => {
    if (ts.isClassLike(node)) migrateClass(node, ctx);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const visitCalls = (node: ts.Node) => {
    if (isCallTo(node, destroyFns) && !ctx.handledCalls.has(node)) {
      ctx.tasks.push({
        id: `create-destroy:${filePath}:${lineOf(sourceFile, node)}`,
        file: filePath,
        line: lineOf(sourceFile, node),
        message: 'This `createDestroy()` call is not a plain class field, so it was left alone.',
      });
    }

    ts.forEachChild(node, visitCalls);
  };

  visitCalls(sourceFile);

  if (ctx.edits.length === 0) return { content, changed: false, tasks: ctx.tasks };

  const wanted = [
    ...(ctx.needs.takeUntilDestroyed ? [{ module: '@angular/core/rxjs-interop', name: 'takeUntilDestroyed' }] : []),
    ...(ctx.needs.destroyRef
      ? [
          { module: '@angular/core', name: 'DestroyRef' },
          { module: '@angular/core', name: 'inject' },
        ]
      : []),
  ];

  const updated = addImports(filePath, removeUnusedImports(filePath, applyEdits(content, ctx.edits)), wanted);

  return { content: updated, changed: updated !== content, tasks: ctx.tasks };
};
