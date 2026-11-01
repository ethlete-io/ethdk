import { readdirSync, readFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, join } from 'path';
import { chromiumOf } from '../browser';
import { INTERACTIONS } from '../force-interactions';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { partFrameOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, openFrame, settled, ThumbUnavailableError } from '../thumb';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { changedSharesOf } from '../contact-sheet';
import { partHashOf } from './sketch/baseline';
import { readMerged } from './sketch/merged-parts';
import { createSystemModules, productModuleIdOf, SketchVariant, SystemModules } from './system-modules';
import { ListedException, readExceptions, withExceptions } from './exceptions';
import { inventoryReasonOf, InventoryState, inventoryStateOf, partOwnerOf, readInventory } from './inventory-approval';
import { optionValuesChecker } from './rules/option-values';

/** One requirement of a part that `design complete` finds without evidence. `target` is `<part>[.<control>[.<requirement>]]`. */
export type CompletenessGap = { code: string; target: string; detail: string };

/** A box in the pixels of a drawn frame, as its `/__design/shot` picture shows it. */
export type FrameBox = { x: number; y: number; width: number; height: number };

/**
 * An element of a drawn frame that looks interactive. `control` is a native control, an interactive role or a known
 * SDK control; `unclassified` has a pointer cursor or a matched `:hover` rule and sits in no control. `marked` is the
 * `data-et-control` that declares it, `within` every `data-et-control` around it, nearest first. `owner` is the
 * embedded part whose `data-et-part` root draws it, or `null` for the frame's own part. `label` is its accessible name
 * or text, which tells apart two controls at the same path.
 */
export type FoundControl = {
  kind: 'control' | 'unclassified';
  what: string;
  path: string;
  label?: string | null;
  marked: string | null;
  within: string[];
  owner?: string | null;
  box?: FrameBox | null;
  covered?: boolean;
};

/** A rule of the part's own stylesheet that sets `properties` on `path`, an element the embedded part `owner` draws. */
export type FoundOverride = { owner: string; selector: string; path: string; properties: string[] };

/**
 * A forced interaction on a drawn element: whether its box differs from rest, which colours change in one frame, and
 * the classes of that interaction's variant no stylesheet defines when it does not differ.
 */
export type SeenForce = { interaction: string; differs: boolean; still?: string[]; undefinedClasses?: string[] };

type ForcedSeen = { state: string; differs: boolean; undefinedClasses?: string[] };

/**
 * An option or menu item inside a drawn surface. `selected` is its ARIA selected, checked, pressed or current
 * state, `look` its computed colours, so two options can be told apart without their text. `named` is set when an
 * `aria-activedescendant` in the frame names its id, `keyboard` when it carries `data-active-source="keyboard"`.
 */
export type SeenOption = { selected: boolean; look: string; forced: SeenForce[]; named?: boolean; keyboard?: boolean };

/** What one drawn frame of a state shows of the controls and surfaces its markup marks. */
export type SeenFrame = {
  state: string;
  interaction: string | null;
  controls: {
    id: string;
    forced: SeenForce[];
    selected?: boolean;
    disabled?: boolean;
    look?: string;
    keyboard?: boolean;
    box?: FrameBox | null;
    covered?: boolean;
  }[];
  surfaces: { id: string; shown: boolean; options?: SeenOption[] }[];
  found?: FoundControl[];
  overrides?: FoundOverride[];
};

export type DeclaredControl = {
  kind: string;
  input: string[];
  part: string | null;
  surfaces: Record<string, string>;
  disabled: boolean;
};

/** The gaps of each part a control names in `part`, or why it could not be checked. */
export type ReferencedParts = Record<string, CompletenessGap[] | string>;

type ControlKind = {
  surface?: string;
  closed?: string;
  adds?: string[];
  noActive?: boolean;
  selects?: boolean;
  options?: { interactions: string[]; selected: boolean };
  virtualFocus?: boolean;
};

const KINDS: Record<string, ControlKind> = {
  disclosure: { surface: 'body', closed: 'collapsed' },
  button: { adds: ['active'] },
  select: { surface: 'open', options: { interactions: ['hover', 'focus-visible'], selected: true } },
  menu: { surface: 'open', options: { interactions: ['hover', 'focus-visible', 'active'], selected: false } },
  row: { selects: true, virtualFocus: true },
  field: { noActive: true },
  tooltip: { surface: 'tooltip' },
};

const CHECKED_KINDS = Object.keys(KINDS);

const INPUT_INTERACTIONS: Record<string, string[]> = { pointer: ['hover', 'active'], keyboard: ['focus-visible'] };

const MARKS = {
  selected: 'aria-selected="true", aria-checked="true", aria-pressed="true" or aria-current',
  disabled: 'disabled or aria-disabled="true"',
};

const CONTROL_MARKS = { ...MARKS, disabled: `${MARKS.disabled} on it or a data-et-control-part in it` };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const requiredInteractionsOf = (control: DeclaredControl) => [
  ...new Set([
    ...control.input
      .flatMap((input) => INPUT_INTERACTIONS[input] ?? [])
      .filter((interaction) => !(KINDS[control.kind]?.noActive && interaction === 'active')),
    ...(KINDS[control.kind]?.adds ?? []),
  ]),
];

const gridGapOf = (options: { grid: unknown; states: string[]; interactions: string[] }) => {
  const { grid, states, interactions } = options;
  const fix = `draw its states with interactionRows, which gives the grid a column per interaction (${interactions.join(', ')})`;

  if (!isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows']))
    return `the part has no grid - ${fix}`;

  const columns = grid['columns'];
  const missing = interactions.filter((interaction) => !columns.includes(interaction));

  if (missing.length > 0) return `its grid has no column ${missing.join(', ')} - ${fix}`;

  const holes = Object.entries(grid['rows']).flatMap(([row, cells]) =>
    interactions
      .filter((interaction) => {
        const state = isRecord(cells) ? cells[interaction] : undefined;

        return typeof state !== 'string' || !states.includes(state);
      })
      .map((interaction) => `${row} ${interaction}`),
  );

  return holes.length > 0 ? `its grid draws no state in ${holes.join(', ')} - ${fix}` : null;
};

export const declaredControlsOf = (value: unknown): Record<string, DeclaredControl> | null =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).map(([id, control]) => {
          const declared = isRecord(control) ? control : {};

          return [
            id,
            {
              kind: typeof declared['kind'] === 'string' ? declared['kind'] : '',
              part: typeof declared['part'] === 'string' ? declared['part'] : null,
              input: Array.isArray(declared['input'])
                ? declared['input'].filter((input): input is string => typeof input === 'string')
                : [],
              surfaces: isRecord(declared['surfaces'])
                ? Object.fromEntries(
                    Object.entries(declared['surfaces']).filter(
                      (entry): entry is [string, string] => typeof entry[1] === 'string',
                    ),
                  )
                : {},
              disabled: declared['disabled'] === true,
            },
          ];
        }),
      )
    : null;

const INTERACTION_WORDS = new Set(['hover', 'hovered', 'focus', 'focused', 'pressed', 'active', 'selected']);

const NAME_WORDS = new Set([...INTERACTION_WORDS, 'visible', 'within', 'invalid', 'disabled', 'checked', 'open']);

const wordsOf = (state: string) =>
  state
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word !== '');

/**
 * Whether a state name shows an interaction: its last word, split at `-`, `_`, spaces and camelCase, or the whole name
 * is hover, hovered, focus, focused, pressed, active or selected. `row-hover`, `collapseFocus` and `focus-visible`
 * are; `active-only` and `inactive` are not.
 */
export const isInteractionState = (state: string) => {
  const words = wordsOf(state);

  while (words.length > 1 && ['visible', 'within'].includes(words[words.length - 1] ?? '')) words.pop();

  return INTERACTION_WORDS.has(words[words.length - 1] ?? '');
};

/** Whether a part may draw interaction states: it is no page, and its `controls` declare a control of a checked kind. */
export const isControlPart = (options: { part: string; controls: unknown }) =>
  !options.part.startsWith('pages/') &&
  Object.values(declaredControlsOf(options.controls) ?? {}).some((control) => CHECKED_KINDS.includes(control.kind));

/**
 * One `CONTROL-STATE` gap per element whose interaction states a part draws that is no control part. The element is
 * the state name without its interaction words (`row-hover` names the row), or `control` when nothing is left.
 */
export const controlStateGapsOf = (options: {
  part: string;
  controls: unknown;
  states: string[];
}): CompletenessGap[] => {
  const { part, states } = options;

  if (isControlPart(options)) return [];

  const elements = new Map<string, string[]>();

  for (const state of states.filter(isInteractionState)) {
    const element =
      wordsOf(state)
        .filter((word) => !NAME_WORDS.has(word))
        .join('-') || 'control';

    elements.set(element, [...(elements.get(element) ?? []), state]);
  }

  const why = part.startsWith('pages/')
    ? 'a page is no control part'
    : `${part} declares no control of a kind ${CHECKED_KINDS.join(', ')}`;
  const declaresNone = Object.keys(declaredControlsOf(options.controls) ?? {}).length === 0;
  const fixOf = (element: string) =>
    part.startsWith('components/') && declaresNone
      ? `declare its controls (Q164), or extract the ${element} as its own control part`
      : `extract the ${element} as its own control part`;

  return [...elements].map(([element, shown]) => ({
    code: 'CONTROL-STATE',
    target: part,
    detail: `${shown.length === 1 ? 'state' : 'states'} ${statesShownOf(shown)} draw${shown.length === 1 ? 's' : ''} an interaction (hover, focus, pressed, active or selected), which only a control part draws, and ${why} - ${fixOf(element)} and draw ${shown.length === 1 ? 'this state' : 'these states'} there`,
  }));
};

/** How much of its frame one rest state changes against `base`, the first state of its part, from 0 to 1. */
export type StateChange = { state: string; base: string; share: number };

const SMALL_CHANGE = 0.1;

/**
 * One hint per state of an element or component that is no control part whose pixels differ from its first state in
 * under a tenth of the frame. Pages compose parts, so they get none; interaction states are left to `CONTROL-STATE`.
 */
export const smallChangeHintsOf = (options: { part: string; controls: unknown; changes: StateChange[] }): string[] =>
  options.part.startsWith('pages/') || isControlPart(options)
    ? []
    : options.changes
        .filter(({ state, share }) => share > 0 && share < SMALL_CHANGE && !isInteractionState(state))
        .map(
          ({ state, base, share }) =>
            `HINT ${options.part} ${state} - changes ${(share * 100).toFixed(1)} % of the frame against ${base} - extract the changed element as its own part`,
        );

/** Whether a discovered element is an undeclared or unclassified finding of the part, not owned or declared. */
export const isFindingOf = (declared: Record<string, DeclaredControl>) => (found: FoundControl) =>
  (found.owner ?? null) === null &&
  !found.within.some((id) => (declared[id]?.part ?? null) !== null) &&
  !(found.kind === 'control' && found.marked !== null);

export const findingKeyOf = (found: FoundControl) => `${found.kind} ${found.what} ${found.path} ${found.label ?? ''}`;

const NATIVE_CONTROLS = ['button', 'a[href]', 'input:not([type="hidden"])', 'select', 'textarea', 'summary'];

const discoveryGapsOf = (options: {
  part: string;
  declared: Record<string, DeclaredControl>;
  frames: SeenFrame[];
}): CompletenessGap[] => {
  const { part, declared, frames } = options;
  const isFinding = isFindingOf(declared);
  const groups = new Map<string, { found: FoundControl; states: string[]; count: number }>();

  for (const frame of frames.filter((seen) => seen.interaction === null)) {
    const counts = new Map<string, number>();

    for (const found of frame.found ?? []) {
      if (!isFinding(found)) continue;

      const key = findingKeyOf(found);
      const group = groups.get(key) ?? { found, states: [], count: 0 };

      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!group.states.includes(frame.state)) group.states.push(frame.state);
      group.count = Math.max(group.count, counts.get(key) ?? 0);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.found.path.localeCompare(b.found.path) || a.found.what.localeCompare(b.found.what))
    .map(({ found, states, count }) => {
      const where = `${found.what} at ${found.path} in ${statesShownOf(states)}${count > 1 ? ` (${count} of them)` : ''}`;

      return found.kind === 'control'
        ? {
            code: 'CONTROL-UNDECLARED',
            target: part,
            detail: `${where} - ${
              NATIVE_CONTROLS.includes(found.what)
                ? 'mark it with control(markup, name) from @ethlete/components/design/control and declare the name in controls'
                : 'mark it with data-et-control and declare it in controls'
            }`,
          }
        : {
            code: 'CONTROL-UNCLASSIFIED',
            target: part,
            detail: `${where} - draw it as a native control or give it an interactive role and declare it, or drop the pointer cursor and :hover style`,
          };
    });
};

const isUndeclaredControlGap = (gap: CompletenessGap) => gap.code === 'CONTROL-UNDECLARED';

const statesShownOf = (states: string[]) =>
  states.length > 4 ? `${states.slice(0, 3).join(', ')} and ${states.length - 3} more` : states.join(', ');

const overrideGapsOf = (options: { part: string; frames: SeenFrame[] }): CompletenessGap[] => {
  const groups = new Map<string, { override: FoundOverride; states: string[] }>();

  for (const frame of options.frames.filter((seen) => seen.interaction === null))
    for (const override of frame.overrides ?? []) {
      const key = `${override.owner} ${override.selector} ${override.path}`;
      const group = groups.get(key) ?? { override, states: [] };

      if (!group.states.includes(frame.state)) group.states.push(frame.state);
      groups.set(key, group);
    }

  return [...groups.values()]
    .sort((a, b) => a.override.owner.localeCompare(b.override.owner) || a.override.path.localeCompare(b.override.path))
    .map(({ override, states }) => ({
      code: 'CONTROL-OVERRIDDEN',
      target: options.part,
      detail: `"${override.selector}" sets ${override.properties.join(', ')} on ${override.path}, drawn by ${override.owner}, in ${statesShownOf(states)} - change ${override.owner} instead, or mark the control with data-et-control and declare it in controls`,
    }));
};

const ownerGapsOf = (options: {
  part: string;
  declared: Record<string, DeclaredControl>;
  frames: SeenFrame[];
  referenced: ReferencedParts;
}): CompletenessGap[] => {
  const { part, declared, frames, referenced } = options;
  const named = new Set(Object.values(declared).map((control) => control.part));
  const owned = new Map<string, Set<string>>();

  for (const frame of frames.filter((seen) => seen.interaction === null))
    for (const found of frame.found ?? []) {
      const owner = found.owner ?? null;

      if (owner === null || named.has(owner)) continue;

      owned.set(owner, (owned.get(owner) ?? new Set()).add(`${found.what} ${found.path}`));
    }

  return [...owned.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([owner, controls]) => {
      const used = referenced[owner];
      const drawn = `${owner} draws ${controls.size} control(s) here`;

      if (typeof used === 'string')
        return [{ code: 'CONTROL-PART-INCOMPLETE', target: part, detail: `${drawn}: ${used}` }];
      if (!used || used.length === 0) return [];

      return [
        {
          code: 'CONTROL-PART-INCOMPLETE',
          target: part,
          detail: `${drawn} and is not design complete: ${used.length} gap(s) - run design complete ${owner}`,
        },
      ];
    });
};

const ownersOf = (frames: SeenFrame[]) => [
  ...new Set(
    frames
      .filter((seen) => seen.interaction === null)
      .flatMap((seen) => (seen.found ?? []).map((found) => found.owner ?? null))
      .filter((owner): owner is string => owner !== null),
  ),
];

const undefinedClassesGapOf = (options: { forced: ForcedSeen[]; what: string; interaction: string }) => {
  const { forced, what, interaction } = options;
  const seen = forced.find((force) => force.undefinedClasses?.length);

  if (!seen) return null;

  const classes = seen.undefinedClasses ?? [];

  return `state ${seen.state} forces ${interaction} on ${what}, but no stylesheet defines its ${classes.length === 1 ? 'class' : 'classes'} ${classes.join(', ')} - Tailwind generates no utility of that name; use a colour or value the product's theme defines`;
};

const interactionGapOf = (options: { frames: SeenFrame[]; id: string; interaction: string }) => {
  const { frames, id, interaction } = options;
  const forced = frames.flatMap((frame) =>
    frame.controls
      .filter((control) => control.id === id)
      .flatMap((control) => control.forced.filter((force) => force.interaction === interaction))
      .map((force) => ({ state: frame.state, differs: force.differs, undefinedClasses: force.undefinedClasses })),
  );

  if (forced.some((force) => force.differs)) return null;
  if (forced.length > 0)
    return (
      undefinedClassesGapOf({ forced, what: 'it', interaction }) ??
      `state ${forced[0]?.state} forces ${interaction} on it, but its box draws no different pixel than at rest - if a descendant draws ${interaction}, mark it with data-et-control-part`
    );

  return `no state draws it ${interaction} - draw a state that forces ${interaction} on the data-et-control element, e.g. with forceInteraction - a data-et-control-part in it takes the force too`;
};

const keyboardActiveRowGapOf = (options: { instances: SeenFrame['controls']; forcedGap: string }) => {
  const { instances, forcedGap } = options;
  const active = instances.filter((seen) => seen.keyboard);
  const plain = instances.filter((seen) => !seen.keyboard && !seen.selected && !seen.disabled);

  if (active.length === 0) return `${forcedGap}; no state marks it data-active-source="keyboard" either`;
  if (plain.length === 0)
    return `a state marks it data-active-source="keyboard", but no state draws it plain (not selected, active or disabled) to compare it with`;
  if (active.some((seen) => plain.some((other) => other.look !== seen.look))) return null;

  return `it looks the same with data-active-source="keyboard" as plain - give the active look its own colours`;
};

const stillGapOf = (options: { frames: SeenFrame[]; id: string; interaction: string }) => {
  const { frames, id, interaction } = options;

  for (const frame of frames)
    for (const control of frame.controls.filter((seen) => seen.id === id))
      for (const force of control.forced.filter((seen) => seen.interaction === interaction && seen.still?.length))
        return `state ${frame.state} changes ${force.still?.join(', ')} in one frame - give them a transition with the product's motion tokens`;

  return null;
};

const lookGapOf = (options: {
  seen: { look?: string; flag: boolean }[];
  flag: 'selected' | 'disabled';
  what: string;
  marks?: Record<'selected' | 'disabled', string>;
}) => {
  const { seen, flag, what, marks = MARKS } = options;
  const on = seen.filter((one) => one.flag);
  const off = seen.filter((one) => !one.flag);

  if (on.length === 0) return `no state draws ${what} ${flag} - mark it with ${marks[flag]} in a state`;
  if (off.length === 0) return `every state draws ${what} ${flag} - draw it without ${flag} too, to compare`;
  if (!on.some((one) => off.some((other) => one.look !== other.look)))
    return `${what} looks the same ${flag} as without - give the ${flag} look its own colours`;

  return null;
};

const forcedGapOf = (options: { forced: ForcedSeen[]; what: string; interaction: string }) => {
  const { forced, what, interaction } = options;

  if (forced.some((force) => force.differs)) return null;
  if (forced.length > 0)
    return (
      undefinedClassesGapOf(options) ??
      `state ${forced[0]?.state} forces ${interaction} on ${what}, but its box draws no different pixel than at rest`
    );

  return `no state draws ${what} ${interaction} - force ${interaction} on it, e.g. with forceInteraction`;
};

const surfaceGapsOf = (options: {
  frames: SeenFrame[];
  id: string;
  control: DeclaredControl;
  states: string[];
  surface: string;
  closed?: string;
}): [string, string][] => {
  const { frames, id, control, states, surface, closed } = options;
  const rest = frames.filter((frame) => frame.interaction === null);
  const state = control.surfaces[surface];
  const surfaceId = `${id}.${surface}`;
  const shows = (frame: SeenFrame) => frame.surfaces.some((seen) => seen.id === surfaceId && seen.shown);
  const drawsControl = (frame: SeenFrame) => frame.controls.some((seen) => seen.id === id);
  const gaps: [string, string][] = [];

  if (closed && !rest.some((frame) => drawsControl(frame) && !shows(frame)))
    gaps.push([closed, `every state that draws it also shows its ${surface} - draw a state with ${surfaceId} closed`]);

  if (state === undefined) gaps.push([surface, `declares no surfaces.${surface} - name the state that draws it open`]);
  else if (!states.includes(state))
    gaps.push([surface, `surfaces.${surface} names state ${state}, which the part does not declare`]);
  else if (!rest.some((frame) => frame.state === state && drawsControl(frame) && shows(frame)))
    gaps.push([
      surface,
      `state ${state} draws no visible, non-empty data-et-surface="${surfaceId}" next to data-et-control="${id}"`,
    ]);

  return gaps;
};

const KEYBOARD_ACTIVE = 'aria-activedescendant or data-active-source="keyboard"';

const isKeyboardActive = (option: SeenOption) => !!option.named || !!option.keyboard;

const isPlain = (option: SeenOption) => !option.selected && !isKeyboardActive(option) && option.forced.length === 0;

const keyboardActiveGapOf = (options: {
  frames: SeenFrame[];
  shownIn: (frame: SeenFrame) => SeenOption[];
  forcedGap: string;
}) => {
  const { frames, shownIn, forcedGap } = options;
  const active = frames
    .map((frame) => ({ state: frame.state, options: shownIn(frame) }))
    .filter((frame) => frame.options.some(isKeyboardActive));
  const compared = active.filter((frame) => frame.options.some(isPlain));

  if (active.length === 0) return `${forcedGap}; no option is marked active by ${KEYBOARD_ACTIVE} either`;
  if (compared.length === 0)
    return `state ${active[0]?.state} marks an option active by ${KEYBOARD_ACTIVE}, but draws no plain option (not selected, active or forced) to compare it with`;
  if (
    compared.some((frame) =>
      frame.options.some(
        (option) =>
          isKeyboardActive(option) && frame.options.some((plain) => isPlain(plain) && plain.look !== option.look),
      ),
    )
  )
    return null;

  return `state ${compared[0]?.state} marks an option active by ${KEYBOARD_ACTIVE}, but it looks the same as a plain option - give the active option its own look`;
};

const optionGapsOf = (options: {
  frames: SeenFrame[];
  surfaceId: string;
  interactions: string[];
  selected: boolean;
}): [string, string][] => {
  const { frames, surfaceId, interactions } = options;
  const shownIn = (frame: SeenFrame) =>
    frame.surfaces.filter((seen) => seen.id === surfaceId && seen.shown).flatMap((seen) => seen.options ?? []);
  const what = `an option in ${surfaceId}`;
  const gaps: [string, string][] = [];

  for (const interaction of interactions) {
    const forced = frames.flatMap((frame) =>
      shownIn(frame).flatMap((option) =>
        option.forced
          .filter((force) => force.interaction === interaction)
          .map((force) => ({ state: frame.state, differs: force.differs, undefinedClasses: force.undefinedClasses })),
      ),
    );
    const gap = forcedGapOf({ forced, what, interaction });
    const missing =
      gap && interaction === 'focus-visible' ? keyboardActiveGapOf({ frames, shownIn, forcedGap: gap }) : gap;

    if (missing) gaps.push([`option-${interaction}`, missing]);
  }

  if (!options.selected) return gaps;

  const seen = frames
    .filter((frame) => frame.interaction === null)
    .flatMap((frame) =>
      shownIn(frame)
        .filter((option) => option.forced.length === 0 && !isKeyboardActive(option))
        .map((option) => ({ look: option.look, flag: option.selected })),
    );
  const selected = lookGapOf({ seen, flag: 'selected', what });

  if (selected) gaps.push(['option-selected', selected]);

  return gaps;
};

const requirementGapsOf = (options: {
  frames: SeenFrame[];
  id: string;
  control: DeclaredControl;
  states: string[];
}): [string, string][] => {
  const { frames, id, control } = options;
  const kind = KINDS[control.kind] ?? {};
  const own = control.part === null;
  const instances = frames
    .filter((frame) => frame.interaction === null)
    .flatMap((frame) => frame.controls.filter((seen) => seen.id === id && seen.forced.length === 0));
  const gaps: [string, string][] = [];

  for (const interaction of own ? requiredInteractionsOf(control) : []) {
    const forcedGap = interactionGapOf({ frames, id, interaction });
    const gap =
      forcedGap && interaction === 'focus-visible' && kind.virtualFocus
        ? keyboardActiveRowGapOf({ instances, forcedGap })
        : forcedGap;

    if (gap) gaps.push([interaction, gap]);
  }

  if (own && kind.selects) {
    const selected = lookGapOf({
      seen: instances.map((seen) => ({ look: seen.look, flag: seen.selected ?? false })),
      flag: 'selected',
      what: 'it',
    });
    const forced = frames.flatMap((frame) =>
      frame.controls
        .filter((seen) => seen.id === id && seen.selected)
        .flatMap((seen) => seen.forced.filter((force) => force.interaction === 'hover'))
        .map((force) => ({ state: frame.state, differs: force.differs, undefinedClasses: force.undefinedClasses })),
    );
    const hovered = forcedGapOf({ forced, what: 'it selected', interaction: 'hover' });

    if (selected) gaps.push(['selected', selected]);
    if (hovered) gaps.push(['selected-hover', hovered]);
  }

  if (own && control.disabled) {
    const disabled = lookGapOf({
      seen: instances.map((seen) => ({ look: seen.look, flag: seen.disabled ?? false })),
      flag: 'disabled',
      what: 'it',
      marks: CONTROL_MARKS,
    });

    if (disabled) gaps.push(['disabled', disabled]);
  }

  if (kind.surface) gaps.push(...surfaceGapsOf({ ...options, surface: kind.surface, closed: kind.closed }));

  if (own && kind.options && kind.surface)
    gaps.push(...optionGapsOf({ frames, surfaceId: `${id}.${kind.surface}`, ...kind.options }));

  return gaps;
};

/**
 * The gaps of one part, from its `controls` declaration, its state names and what each drawn frame showed.
 * A part that is not `reviewed` (its files differ from its merged.json hash) has no reviewed evidence at all.
 */
export const completenessGapsOf = (options: {
  part: string;
  controls: unknown;
  states: string[];
  frames: SeenFrame[];
  reviewed: boolean;
  grid?: unknown;
  referenced?: ReferencedParts;
  inventory?: InventoryState;
}): CompletenessGap[] => {
  const { part, states, frames, reviewed, grid, referenced = {}, inventory } = options;
  const declared = declaredControlsOf(options.controls) ?? {};
  const gaps: CompletenessGap[] = [];

  if (!reviewed)
    gaps.push({
      code: 'PART-UNREVIEWED',
      target: part,
      detail:
        'its files differ from the hash merged.json records for it, so no frame of it is reviewed - merge or accept it',
    });

  const seenIds = new Set(frames.flatMap((frame) => frame.controls.map((control) => control.id)));

  for (const id of [...seenIds].filter((seen) => !(seen in declared)).sort())
    gaps.push({
      code: 'CONTROL-UNKNOWN',
      target: `${part}.${id}`,
      detail: `data-et-control="${id}" is not in controls`,
    });

  const surfaceIds = new Set(frames.flatMap((frame) => frame.surfaces.map((surface) => surface.id)));

  for (const id of [...surfaceIds].sort()) {
    const [control = '', surface = ''] = id.split('.');

    if (!declared[control] || declared[control].surfaces[surface] === undefined)
      gaps.push({
        code: 'CONTROL-UNKNOWN',
        target: `${part}.${control}`,
        detail: `data-et-surface="${id}" names no surface its control declares`,
      });
  }

  for (const [id, control] of Object.entries(declared)) {
    if (!CHECKED_KINDS.includes(control.kind)) {
      gaps.push({
        code: 'CONTROL-KIND',
        target: `${part}.${id}`,
        detail: `kind "${control.kind}" is not checked yet - kinds are ${CHECKED_KINDS.join(', ')}`,
      });
      continue;
    }

    if (control.part === null && part.startsWith('pages/'))
      gaps.push({
        code: 'CONTROL-PART-MISSING',
        target: `${part}.${id}`,
        detail:
          "a page draws no interactions of its controls - name the part that draws them, e.g. part: 'components/disclosure'",
      });

    const used = control.part === null ? undefined : referenced[control.part];

    if (typeof used === 'string')
      gaps.push({ code: 'CONTROL-PART-INCOMPLETE', target: `${part}.${id}`, detail: `${control.part}: ${used}` });
    else if (used && used.length > 0)
      gaps.push({
        code: 'CONTROL-PART-INCOMPLETE',
        target: `${part}.${id}`,
        detail: `${control.part} is not design complete: ${used.length} gap(s) - run design complete ${control.part}`,
      });

    const interactions = control.part === null && !part.startsWith('pages/') ? requiredInteractionsOf(control) : [];
    const gridGap = interactions.length > 0 ? gridGapOf({ grid, states, interactions }) : null;

    if (gridGap) gaps.push({ code: 'CONTROL-GRID-MISSING', target: `${part}.${id}`, detail: gridGap });

    if (!seenIds.has(id)) {
      gaps.push({ code: 'CONTROL-UNDRAWN', target: `${part}.${id}`, detail: `no state draws data-et-control="${id}"` });
      continue;
    }

    for (const [requirement, detail] of requirementGapsOf({ frames, id, control, states }))
      gaps.push({ code: 'REQUIREMENT-MISSING', target: `${part}.${id}.${requirement}`, detail });

    for (const interaction of interactions) {
      const gap = stillGapOf({ frames, id, interaction });

      if (gap) gaps.push({ code: 'CONTROL-TRANSITION-MISSING', target: `${part}.${id}.${interaction}`, detail: gap });
    }
  }

  return [
    ...gaps,
    ...discoveryGapsOf({ part, declared, frames }).filter((gap) => !isUndeclaredControlGap(gap)),
    ...ownerGapsOf({ part, declared, frames, referenced }),
    ...overrideGapsOf({ part, frames }),
    ...inventoryGapsOf({ part, inventory }),
  ];
};

const inventoryGapsOf = ({ part, inventory }: { part: string; inventory?: InventoryState }): CompletenessGap[] => {
  const reason = inventory ? inventoryReasonOf(inventory) : null;

  return reason === null
    ? []
    : [{ code: 'INVENTORY-UNAPPROVED', target: part, detail: `${reason} - check and approve it in Studio` }];
};

export const completenessGapLineOf = (gap: CompletenessGap) => `${gap.code} ${gap.target} - ${gap.detail}`;

const MISSING_STATE_CODES = ['CONTROL-UNDRAWN', 'CONTROL-GRID-MISSING', 'REQUIREMENT-MISSING'];

/** Whether a gap is a declared control that no state draws, or that lacks a drawn interaction, look or surface. */
export const isMissingStateGap = (gap: CompletenessGap) => MISSING_STATE_CODES.includes(gap.code);

const NO_MOTION = '*, *::before, *::after { transition: none !important; animation: none !important; }';

const PAD = 8;

const COLOUR_PROPERTIES = [
  'background-color',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'box-shadow',
];

const COLOUR = COLOUR_PROPERTIES.indexOf('color');

const colourSnapshot = (at: number) => `((at) => {
  const control = document.querySelector('[data-et-complete="' + at + '"]');
  const motionOff = [...document.querySelectorAll('style')].find((style) => style.textContent === ${JSON.stringify(NO_MOTION)});
  const elements = [control, ...control.querySelectorAll('*')];
  const colours = elements.map((element) => {
    const style = getComputedStyle(element);
    return ${JSON.stringify(COLOUR_PROPERTIES)}.map((name) => {
      const side = name.match(/^border-(\\w+)-color$/);
      return side && parseFloat(style.getPropertyValue('border-' + side[1] + '-width')) === 0 ? '' : style.getPropertyValue(name);
    });
  });
  if (motionOff) motionOff.disabled = true;
  const transitions = elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      properties: style.transitionProperty.split(',').map((name) => name.trim()),
      durations: style.transitionDuration.split(',').map((duration) => parseFloat(duration)),
    };
  });
  if (motionOff) motionOff.disabled = false;
  const parents = elements.map((element) => elements.indexOf(element.parentElement));
  const names = elements.map((element) => element.tagName.toLowerCase() + (element.classList[0] ? '.' + element.classList[0] : ''));
  return { colours, transitions, parents, names };
})(${JSON.stringify(at)})`;

type ColourSnapshot = {
  colours: string[][];
  transitions: { properties: string[]; durations: number[] }[];
  parents: number[];
  names: string[];
};

const coversOf = (property: string) => {
  if (property === 'background-color') return ['all', 'background', property];
  if (property.startsWith('border-'))
    return ['all', 'border', 'border-color', property.replace(/-color$/, ''), property];

  return ['all', property];
};

const undefinedVariantClasses = (at: number) => `((at) => {
  const control = document.querySelector('[data-et-complete="' + at + '"]');
  const selectors = [];
  const collect = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText) selectors.push(rule.selectorText);
      if (rule.cssRules) collect(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules);
    } catch {}
  }
  const tokens = new Set([control, ...control.querySelectorAll('*')].flatMap((element) => [...element.classList]));
  return [...tokens].filter((token) => token.includes(':') && !selectors.some((selector) => selector.includes('.' + CSS.escape(token))));
})(${JSON.stringify(at)})`;

const VARIANT_WORDS: Record<string, string> = { hover: 'hover', active: 'active', 'focus-visible': 'focus' };

const isVariantOf = (token: string, interaction: string) =>
  token
    .split(':')
    .slice(0, -1)
    .some((variant) => variant.includes(VARIANT_WORDS[interaction] ?? interaction));

const stillChangesOf = (rest: ColourSnapshot, forced: ColourSnapshot) =>
  forced.names.flatMap((name, element) => {
    const { properties, durations } = forced.transitions[element] ?? { properties: [], durations: [] };
    const still = COLOUR_PROPERTIES.filter((property, at) => {
      const [before, after] = [rest.colours[element] ?? [], forced.colours[element] ?? []];

      if (before[at] === after[at]) return false;
      const parent = forced.parents[element] ?? -1;
      const inherited = parent >= 0 ? [rest.colours[parent]?.[at], forced.colours[parent]?.[at]] : [];

      if (property !== 'color' && before[at] === before[COLOUR] && after[at] === after[COLOUR]) return false;
      if (property === 'color' && before[at] === inherited[0] && after[at] === inherited[1]) return false;

      return !properties.some(
        (covered, index) => coversOf(property).includes(covered) && (durations[index % durations.length] ?? 0) > 0,
      );
    });

    return still.length > 0 ? [`${still.join(', ')} of ${name}`] : [];
  });

const INTERACTIVE_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem',
];

export const SDK_CONTROLS = [
  '[et-button]',
  '[et-icon-button]',
  '[et-text-button]',
  '[et-fab]',
  '[et-window-control-button]',
  '[et-overlay-close]',
  'et-accordion',
  'et-cascader',
  'et-checkbox',
  'et-chip',
  'et-color-input',
  'et-counter',
  'et-date-input',
  'et-date-range-input',
  'et-date-time-input',
  'et-duration-input',
  'et-form-field',
  'et-input',
  'et-menu-checkbox-item',
  'et-menu-radio-item',
  'et-number-input',
  'et-otp-input',
  'et-password-input',
  'et-phone-input',
  'et-radio',
  'et-range-slider',
  'et-rating',
  'et-segmented-button',
  'et-select',
  'et-select-option',
  'et-slider',
  'et-split-button',
  'et-switch',
  'et-tab',
  'et-tag-input',
  'et-textarea',
  'et-time-input',
  'et-toggletip',
];

const PLAIN_CONTROLS = [...NATIVE_CONTROLS, '[tabindex]', ...INTERACTIVE_ROLES.map((role) => `[role="${role}"]`)];

const LIKELY_CONTROLS = [...SDK_CONTROLS, ...PLAIN_CONTROLS];

const LOOK_PROPERTIES = [...COLOUR_PROPERTIES, 'opacity', 'box-shadow', 'font-weight', 'text-decoration-line'];

const OPTION_SELECTOR = '[role="option"], [role^="menuitem"], [data-et-option]';

const COMPOSITE_ROLES = ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'];

const DIALOG_ROLES = ['dialog', 'alertdialog'];

const FOCUS_CONTAINER = [
  ...COMPOSITE_ROLES.flatMap((role) => [`[role="${role}"][tabindex="-1"]`, `[role="${role}"][aria-activedescendant]`]),
  ...DIALOG_ROLES.map((role) => `[role="${role}"][tabindex="-1"]`),
].join(', ');

export const PLAIN_CONTROL_SELECTOR = `:is(${PLAIN_CONTROLS.join(', ')}):not(${FOCUS_CONTAINER})`;

const discoverControls = `((root) => {
  const LIKELY = ${JSON.stringify(LIKELY_CONTROLS)};
  const likely = LIKELY.join(', ');
  const container = ${JSON.stringify(FOCUS_CONTAINER)};
  const isLikely = (element) => element.matches(likely) && !element.matches(container);
  const sdk = ${JSON.stringify(SDK_CONTROLS.join(', '))};
  const rendered = (element) => element.getClientRects().length > 0;
  const HOVER = /(?<!\\\\):hover(?![\\w-])/g;
  const FORCED_HOVER = /:is\\(:hover,\\s*\\[data-et-force~="?hover"?\\](?::not\\(:disabled,[^)]*\\))?\\)/g;
  const hoveredOf = (written) => {
    const selector = written.replace(FORCED_HOVER, ':hover');
    const match = new RegExp(HOVER.source).exec(selector);
    if (!match) return null;
    let depth = 0;
    let end = selector.length;
    for (let at = 0; at < selector.length; at++) {
      const char = selector[at];
      if (char === '\\\\') at++;
      else if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (at > match.index && depth === 0 && /[\\s>+~]/.test(char)) {
        end = at;
        break;
      }
    }
    return selector.slice(0, end).replace(HOVER, '').trim() || null;
  };
  const hovered = new Set();
  const walk = (rules, parent) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const own = splitTop(rule.selectorText).map((selector) =>
          nested(selector, parent),
        );
        for (const selector of own) {
          const target = hoveredOf(selector);
          if (target === null) continue;
          try {
            for (const element of root.querySelectorAll(target)) hovered.add(element);
          } catch {}
        }
        if (rule.cssRules && rule.cssRules.length > 0) walk(rule.cssRules, own.join(', '));
      } else if (rule.cssRules) walk(rule.cssRules, parent);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules, null);
    } catch {}
  }
  const markerOf = (at, element) =>
    at.getAttribute('data-et-control') ?? (element.matches(${JSON.stringify(OPTION_SELECTOR)}) ? at.getAttribute('data-et-surface')?.split('.')[0] : null) ?? null;
  const withinOf = (element) => {
    const ids = [];
    for (let at = element; at && at !== root; at = at.parentElement) {
      const id = markerOf(at, element);
      if (id !== null) ids.push(id);
    }
    return ids;
  };
  const markedOf = (element) => {
    if (element.hasAttribute('data-et-control')) return element.getAttribute('data-et-control');
    for (let at = element.parentElement; at && at !== root; at = at.parentElement) {
      if (isLikely(at)) return null;
      const id = markerOf(at, element);
      if (id !== null) return id;
    }
    return null;
  };
  const labelOf = (element) =>
    (element.getAttribute('aria-label') ?? element.innerText ?? element.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 60) || null;
  const found = [];
  for (const element of root.querySelectorAll('*')) {
    if (!rendered(element)) continue;
    const what = !element.matches(container) && LIKELY.find((selector) => element.matches(selector));
    if (what) {
      const inSdk = element.parentElement.closest(sdk);
      if (inSdk !== null && root.contains(inSdk)) continue;
      found.push({ kind: 'control', what: what.startsWith('[') ? element.tagName.toLowerCase() + what : what, path: pathOf(element), label: labelOf(element), marked: markedOf(element), within: withinOf(element), owner: ownerOf(element)?.key ?? null, box: frameBoxOf(element), covered: isCovered(element) });
      continue;
    }
    const cursor = getComputedStyle(element).cursor;
    const pointer = cursor === 'pointer' && getComputedStyle(element.parentElement).cursor !== 'pointer';
    if (!pointer && !hovered.has(element)) continue;
    let inControl = false;
    for (let at = element; at && !inControl; at = at.parentElement) inControl = at.hasAttribute('data-et-control') || isLikely(at);
    if (inControl) continue;
    const reason = [pointer ? 'cursor: pointer' : '', hovered.has(element) ? ':hover rule' : ''].filter(Boolean).join(' and ');
    found.push({ kind: 'unclassified', what: nameOf(element) + ' with ' + reason, path: pathOf(element), label: labelOf(element), marked: null, within: [], owner: ownerOf(element)?.key ?? null, box: frameBoxOf(element), covered: isCovered(element) });
  }
  return found;
})`;

const ROOT_LAYOUT = [
  '^margin',
  '^inset',
  '^(top|right|bottom|left)$',
  '^(min-|max-)?(width|height|inline-size|block-size)$',
  '^position$',
  '^z-index$',
  '^flex(-grow|-shrink|-basis)?$',
  '^grid-(area|row|column)',
  '^(align|justify|place)-self$',
  '^order$',
  '^(transform|translate|rotate|scale)$',
];

const findOverrides = `((ownCss) => {
  const LAYOUT = new RegExp(${JSON.stringify(ROOT_LAYOUT.join('|'))});
  const USER_ACTION = /(?<!\\\\):(hover|focus-visible|focus-within|focus|active)(?![\\w-])/g;
  const PSEUDO_ELEMENT = /::?(before|after|marker|placeholder|selection|backdrop|file-selector-button|first-line|first-letter)(?![\\w-])/g;
  const declaredByHost = (element) => {
    for (let at = element; at && at !== root.parentElement; at = at.parentElement)
      if (at.hasAttribute('data-et-control') && ownerOf(at) === null) return true;
    return false;
  };
  const overrides = [];
  const seen = new Set();
  const check = (selector, style) => {
    const properties = [...new Set(style.cssText.split(';').map((declaration) => declaration.split(':')[0].trim()).filter(Boolean))];
    if (properties.length === 0) return;
    let matched = [];
    try {
      matched = [...root.querySelectorAll(selector.replace(PSEUDO_ELEMENT, '').replace(USER_ACTION, ':where(*)'))];
    } catch {
      return;
    }
    for (const element of matched) {
      const owner = ownerOf(element);
      if (owner === null || declaredByHost(element)) continue;
      const look = owner.at === element ? properties.filter((property) => !LAYOUT.test(property)) : properties;
      const key = selector + ' ' + pathOf(element);
      if (look.length === 0 || seen.has(key)) continue;
      seen.add(key);
      overrides.push({ owner: owner.key, selector, path: pathOf(element), properties: look });
    }
  };
  const walk = (rules, parent) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const own = splitTop(rule.selectorText).map((selector) => nested(selector, parent));
        for (const selector of own) check(selector, rule.style);
        if (rule.cssRules && rule.cssRules.length > 0) walk(rule.cssRules, own.join(', '));
      } else if (parent !== null && rule.constructor.name === 'CSSNestedDeclarations') check(parent, rule.style);
      else if (rule.cssRules) walk(rule.cssRules, parent);
    }
  };
  for (const text of ownCss) {
    const sheet = new CSSStyleSheet();
    try {
      sheet.replaceSync(text);
    } catch {
      continue;
    }
    walk(sheet.cssRules, null);
  }
  return overrides;
})`;

/** A control root and every `data-et-control-part` whose nearest `data-et-control` is that root, in the page. */
const controlPartsOf = `((control) => [
  control,
  ...[...control.querySelectorAll('[data-et-control-part]')].filter((part) => part.parentElement.closest('[data-et-control]') === control),
])`;

export const seeFrame = (options: {
  discover: boolean;
  part: string;
  ownCss: string[];
  controlParts: Record<string, string>;
  clip: boolean;
}) => `(() => {
  const root = document.getElementById('root');
  const refused = root.innerText.trim();
  if (refused.startsWith('design-explore:')) return { refused: refused.split('\\n')[0] };
  const ORIGIN = ${options.clip} ? root.getBoundingClientRect() : { left: -scrollX, top: -scrollY };
  const frameBoxOf = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0
      ? { x: Math.round(box.left - ORIGIN.left), y: Math.round(box.top - ORIGIN.top), width: Math.round(box.width), height: Math.round(box.height) }
      : null;
  };
  const isCovered = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const x = [box.left + 1, box.left + box.width / 2, box.right - 1];
    const y = [box.top + 1, box.top + box.height / 2, box.bottom - 1];
    const points = [[x[1], y[1]], [x[0], y[0]], [x[2], y[0]], [x[0], y[2]], [x[2], y[2]]];
    let hit = false;
    const inline = element.style.getPropertyValue('pointer-events');
    const priority = element.style.getPropertyPriority('pointer-events');
    element.style.setProperty('pointer-events', 'auto', 'important');
    try {
      for (const [px, py] of points) {
        const top = document.elementFromPoint(px, py);
        if (top === null) return false;
        if (element.contains(top)) return false;
        hit = true;
      }
    } finally {
      if (inline) element.style.setProperty('pointer-events', inline, priority);
      else element.style.removeProperty('pointer-events');
    }
    return hit;
  };
  const OWN = ${JSON.stringify(options.part)};
  const CONTROL_PARTS = ${JSON.stringify(options.controlParts)};
  const tokensOf = (element, name) => (element.getAttribute(name) ?? '').split(' ').filter(Boolean);
  const ownerOf = (element) => {
    const slotted = tokensOf(element, 'data-et-slot');
    for (let at = element; at; at = at.parentElement)
      for (const key of tokensOf(at, 'data-et-part')) {
        const index = slotted.indexOf(key);
        if (index >= 0) slotted.splice(index, 1);
        else return key === OWN ? null : { key, at };
      }
    return null;
  };
  const nameOf = (element) => {
    const cls = [...element.classList].find((name) => /^[a-z][\\w-]*$/i.test(name));
    return element.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const pathOf = (element) => {
    const names = [];
    for (let at = element; at && at !== root; at = at.parentElement) names.unshift(nameOf(at));
    return (names.length > 4 ? '... > ' : '') + names.slice(-4).join(' > ');
  };
  const splitTop = (selector) => {
    const parts = [];
    let depth = 0;
    let from = 0;
    for (let at = 0; at < selector.length; at++) {
      const char = selector[at];
      if (char === '\\\\') at++;
      else if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        parts.push(selector.slice(from, at).trim());
        from = at + 1;
      }
    }
    parts.push(selector.slice(from).trim());
    return parts.filter(Boolean);
  };
  const nested = (selector, parent) =>
    parent === null ? selector : selector.includes('&') ? selector.replaceAll('&', ':is(' + parent + ')') : ':is(' + parent + ') ' + selector;
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    let { left, top, right, bottom } = box;
    if (box.width <= 0 || box.height <= 0) return false;
    if (['hidden', 'collapse'].includes(getComputedStyle(element).visibility)) return false;
    for (let at = element; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (Number(style.opacity) === 0) return false;
      if (at === element) continue;
      const clip = at.getBoundingClientRect();
      if (style.overflowX !== 'visible') [left, right] = [Math.max(left, clip.left), Math.min(right, clip.right)];
      if (style.overflowY !== 'visible') [top, bottom] = [Math.max(top, clip.top), Math.min(bottom, clip.bottom)];
      if (right <= left || bottom <= top) return false;
    }
    return element.innerText.trim() !== '' || !!element.querySelector('img, svg, canvas, video, iframe, input, select, textarea');
  };
  const LOOK = ${JSON.stringify(LOOK_PROPERTIES)};
  const lookOf = (element) => {
    const own = LOOK.map((name) => getComputedStyle(element).getPropertyValue(name));
    const inside = [...element.querySelectorAll('*')].map((child) => {
      const style = getComputedStyle(child);
      return LOOK.map((name) => style.getPropertyValue(name)).join(' ');
    });
    return JSON.stringify([own, [...new Set(inside)].sort()]);
  };
  const named = new Set([...root.querySelectorAll('[aria-activedescendant]')].filter((element) => ownerOf(element) === null).map((element) => element.getAttribute('aria-activedescendant')));
  const isSelected = (element) =>
    ['aria-selected', 'aria-checked', 'aria-pressed'].some((name) => element.getAttribute(name) === 'true') ||
    (element.hasAttribute('aria-current') && element.getAttribute('aria-current') !== 'false');
  const isDisabled = (element) =>
    element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || tokensOf(element, 'data-et-force').includes('disabled');
  const isKeyboard = (element) => element.getAttribute('data-active-source') === 'keyboard';
  let next = 0;
  const tagged = (element) => {
    const at = element.hasAttribute('data-et-complete') ? Number(element.getAttribute('data-et-complete')) : next++;
    element.setAttribute('data-et-complete', String(at));
    const box = element.getBoundingClientRect();
    const x = Math.max(0, box.x + scrollX - ${PAD});
    const y = Math.max(0, box.y + scrollY - ${PAD});
    const width = Math.min(box.x + scrollX + box.width + ${PAD}, document.documentElement.scrollWidth) - x;
    const height = Math.min(box.y + scrollY + box.height + ${PAD}, document.documentElement.scrollHeight) - y;
    return {
      at,
      forced: tokensOf(element, 'data-et-force'),
      box: box.width > 0 && box.height > 0 && width > 0 && height > 0 ? { x, y, width, height } : null,
      selected: isSelected(element),
      look: lookOf(element),
    };
  };
  const isOwnControl = (element) => {
    const owner = ownerOf(element);
    return owner === null || CONTROL_PARTS[element.getAttribute('data-et-control')] === owner.key;
  };
  const controls = [...root.querySelectorAll('[data-et-control]')].filter(isOwnControl).map((element) => {
    const parts = ${controlPartsOf}(element);
    const forced = new Set(parts.flatMap((part) => tokensOf(part, 'data-et-force')));
    for (const part of parts) if (forced.size > 0) part.setAttribute('data-et-force', [...forced].join(' '));
    return {
      id: element.getAttribute('data-et-control'),
      disabled: parts.some(isDisabled),
      keyboard: parts.some(isKeyboard),
      frameBox: frameBoxOf(element),
      covered: isCovered(element),
      ...tagged(element),
    };
  });
  const surfaces = [...root.querySelectorAll('[data-et-surface]')].filter((element) => ownerOf(element) === null).map((element) => ({
    id: element.getAttribute('data-et-surface'),
    shown: shown(element),
    options: [...element.querySelectorAll(${JSON.stringify(OPTION_SELECTOR)})].filter((option) => ownerOf(option) === null && shown(option)).map((option) => ({ ...tagged(option), named: option.id !== '' && named.has(option.id), keyboard: isKeyboard(option) })),
  }));
  const discover = ${options.discover};
  return {
    controls,
    surfaces,
    found: discover ? ${discoverControls}(root) : [],
    overrides: discover ? ${findOverrides}(${JSON.stringify(options.ownCss)}) : [],
  };
})()`;

const forceOn = ({
  at,
  interaction,
  on,
}: {
  at: number;
  interaction: string;
  on: boolean;
}) => `((at, interaction, on) => {
  const found = document.querySelector('[data-et-complete="' + at + '"]');
  for (const element of found.hasAttribute('data-et-control') ? ${controlPartsOf}(found) : [found]) {
    const tokens = new Set((element.getAttribute('data-et-force') ?? '').split(' ').filter(Boolean));
    if (on) tokens.add(interaction);
    else tokens.delete(interaction);
    if (tokens.size > 0) element.setAttribute('data-et-force', [...tokens].join(' '));
    else element.removeAttribute('data-et-force');
  }
})(${JSON.stringify(at)}, ${JSON.stringify(interaction)}, ${JSON.stringify(on)})`;

type Tagged = {
  at: number;
  forced: string[];
  box: { x: number; y: number; width: number; height: number } | null;
  selected: boolean;
  look: string;
};

type Seen =
  | { refused: string }
  | {
      controls: (Tagged & {
        id: string;
        disabled: boolean;
        keyboard: boolean;
        frameBox: FrameBox | null;
        covered: boolean;
      })[];
      surfaces: { id: string; shown: boolean; options: (Tagged & { named: boolean; keyboard: boolean })[] }[];
      found: FoundControl[];
      overrides: FoundOverride[];
    };

type CompleteFrame = {
  state: string;
  interaction: string | null;
  search: string;
  size: { width: number; height?: number } | null;
  clip: boolean;
};

const FORCEABLE = new Set(['hover', 'focus-visible', 'active']);

const seeFrames = async (options: {
  browser: Browser;
  base: string;
  frames: CompleteFrame[];
  part: string;
  ownCss: string[];
  controlParts: Record<string, string>;
}) => {
  const { browser, base, frames, part, ownCss, controlParts } = options;
  const context = await browser.newContext();
  const seen: SeenFrame[] = [];
  const refused: string[] = [];
  const shots: { state: string; png: Buffer }[] = [];

  try {
    const page = await context.newPage();

    const seeOne = async (frame: CompleteFrame) => {
      await page.setViewportSize(viewportOf(frame.size));
      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.addStyleTag({ content: NO_MOTION });
      await page.evaluate(settled);

      const found = (await page.evaluate(
        seeFrame({ discover: frame.interaction === null, part, ownCss, controlParts, clip: frame.clip }),
      )) as Seen;

      if ('refused' in found) {
        refused.push(`${frame.state}: ${found.refused}`);

        return;
      }

      if (frame.interaction === null) {
        const box = frame.clip ? await page.locator('#root').boundingBox() : null;

        shots.push({
          state: frame.state,
          png: await page.screenshot({ type: 'png', fullPage: true, animations: 'disabled', clip: box ?? undefined }),
        });
      }

      const forcedOf = async (element: Tagged) => {
        const forced: SeenForce[] = [];

        for (const interaction of element.forced.filter((name) => FORCEABLE.has(name))) {
          if (!element.box) {
            forced.push({ interaction, differs: false });
            continue;
          }

          const shot = () =>
            page.screenshot({ type: 'png', fullPage: true, clip: element.box ?? undefined, animations: 'disabled' });
          const drawn = await shot();
          const drawnColours = (await page.evaluate(colourSnapshot(element.at))) as ColourSnapshot;

          await page.evaluate(forceOn({ at: element.at, interaction, on: false }));
          await page.evaluate(settled);

          const rest = await shot();
          const restColours = (await page.evaluate(colourSnapshot(element.at))) as ColourSnapshot;

          await page.evaluate(forceOn({ at: element.at, interaction, on: true }));

          const differs = !drawn.equals(rest);
          const undefinedClasses = differs
            ? []
            : ((await page.evaluate(undefinedVariantClasses(element.at))) as string[]).filter((token) =>
                isVariantOf(token, interaction),
              );

          forced.push({
            interaction,
            differs,
            still: stillChangesOf(restColours, drawnColours),
            ...(undefinedClasses.length > 0 ? { undefinedClasses } : {}),
          });
        }

        return forced;
      };
      const controls: SeenFrame['controls'] = [];
      const surfaces: SeenFrame['surfaces'] = [];

      for (const control of found.controls)
        controls.push({
          id: control.id,
          forced: await forcedOf(control),
          selected: control.selected,
          disabled: control.disabled,
          look: control.look,
          ...(control.keyboard ? { keyboard: true } : {}),
          box: control.frameBox,
          ...(control.covered ? { covered: true } : {}),
        });

      for (const surface of found.surfaces) {
        const options: SeenOption[] = [];

        for (const option of surface.options)
          options.push({
            selected: option.selected,
            look: option.look,
            forced: await forcedOf(option),
            ...(option.named ? { named: true } : {}),
            ...(option.keyboard ? { keyboard: true } : {}),
          });

        surfaces.push({ id: surface.id, shown: surface.shown, options });
      }

      seen.push({
        state: frame.state,
        interaction: frame.interaction,
        controls,
        surfaces,
        found: found.found,
        overrides: found.overrides,
      });
    };

    for (const frame of frames) {
      try {
        await seeOne(frame);
      } catch (error) {
        refused.push(
          `${frame.state}: design check could not draw this frame (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`,
        );
      }
    }
  } finally {
    await context.close();
  }

  const [first, ...others] = shots;
  const shares = first ? await changedSharesOf({ browser, base: first.png, others: others.map(({ png }) => png) }) : [];

  return {
    seen,
    refused,
    changes: others.map(({ state }, index): StateChange => ({
      state,
      base: first?.state ?? '',
      share: shares[index] ?? 0,
    })),
  };
};

type PartModule = {
  default?: { states?: unknown; interactions?: unknown; widths?: unknown; controls?: unknown; grid?: unknown };
};

/** Where a rest frame of a part is drawn: its state at a preset, or at a width, as `/__design/shot` takes it. */
export type FrameAddress = { state: string; preset: string | null; width: number | null };

/**
 * Draws every state of one part of the product, at rest and, unless `restOnly`, in each interaction it declares,
 * once at its first preset or width, and answers what each frame showed, or why its module did not load as a string.
 */
export const seePart = async (options: {
  product: ResolvedProduct;
  part: ResolvedPart;
  system: SystemModules;
  base: string;
  load: (id: string) => Promise<unknown>;
  draw: <T>(job: (browser: Browser) => Promise<T>) => Promise<T>;
  restOnly?: boolean;
  sketch?: SketchVariant | null;
}) => {
  const { product, part, system, base, load, draw, restOnly = false, sketch = null } = options;
  const key = partKeyOf(part);
  const loaded = await load(productModuleIdOf({ file: part.file, product: product.name, sketch }))
    .then((module) => ({ module: module as PartModule }))
    .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));

  if ('error' in loaded) return loaded.error;

  const definition = loaded.module.default;
  const states = isRecord(definition?.states) ? Object.keys(definition.states) : [];
  const interactions = Array.isArray(definition?.interactions)
    ? definition.interactions.filter((name): name is string => INTERACTIONS.some((known) => known === name))
    : [];
  const widths = Array.isArray(definition?.widths)
    ? definition.widths.filter((width): width is number => typeof width === 'number')
    : [];
  const presets = Object.keys(system.drawnOf(product.name, null)?.presets ?? {});
  const preset = part.layer === 'pages' ? (presets[0] ?? null) : null;
  const width = preset === null ? (widths[0] ?? null) : null;
  const frames: CompleteFrame[] = [];

  for (const state of states)
    for (const interaction of [null, ...(restOnly ? [] : interactions)]) {
      const frame = partFrameOf({
        system,
        product: product.name,
        part: key,
        state,
        preset,
        width,
        sketch,
        interaction,
      });

      if (!(frame instanceof Error))
        frames.push({
          state,
          interaction,
          search: frame.search.toString(),
          size: frame.size ?? null,
          clip: preset === null,
        });
    }

  const dir = dirname(part.file);
  const ownCss = readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'));
  const controlParts = Object.fromEntries(
    Object.entries(declaredControlsOf(definition?.controls) ?? {}).flatMap(([id, control]) =>
      control.part === null ? [] : [[id, control.part]],
    ),
  );
  const { seen, refused, changes } = await draw((browser) =>
    seeFrames({ browser, base, frames, part: key, ownCss, controlParts }),
  );
  const owner = partOwnerOf({ product, part });

  return {
    definition,
    states,
    seen,
    refused,
    changes,
    addresses: states.map((state): FrameAddress => ({ state, preset, width })),
    owner,
    hash: partHashOf({ product: owner, dir }),
  };
};

/** The control ids a page draws at rest, the set its inventory approval holds. */
export const inventoryIdsOf = (frames: SeenFrame[]) =>
  [
    ...new Set(
      frames.filter((frame) => frame.interaction === null).flatMap((frame) => frame.controls.map(({ id }) => id)),
    ),
  ].sort();

/**
 * Draws every state of one part, at rest and in each interaction it declares, once at its first preset or width,
 * and answers the gaps of its `controls` declaration, or why it could not draw. A part a control names in `part`,
 * and an embedded part whose `data-et-part` root draws a control, is checked the same way, and its gaps fail it -
 * unless it is a part of the product's base, whose gaps stay its own.
 * A page fails until the user approves its control inventory in Studio. An exception the user approved in Studio
 * drops the gap it names until the part changes; a pending one still fails. With `sketch`, every part is drawn as
 * that variant draws it, and a part the variant changes is not merged yet, so it never fails as unreviewed.
 * A drawn control that no `controls` entry declares is a hint; the sketch check fails on one a sketch adds.
 */
export const completenessOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  sketch?: SketchVariant | null;
  chromiumOf?: typeof chromiumOf;
}): Promise<
  | { gaps: CompletenessGap[]; exceptions?: ListedException[]; hints?: string[] }
  | { unavailable: string }
  | { problem: string }
> => {
  const { target, config, product, part, sketch = null } = options;
  const system = createSystemModules({ target, config });
  const parts = (sketch ? system.drawnOf(product.name, sketch) : product)?.parts ?? [];

  if (!parts.some((candidate) => partKeyOf(candidate) === part))
    return {
      problem: sketch
        ? `variant "${sketch.variant}" of the sketch on ${sketch.target} in product "${product.name}" has no part "${part}"`
        : `product "${product.name}" has no part "${part}"`,
    };

  const checked = await partsCompletenessOf({ ...options, parts: [part] });

  if ('unavailable' in checked) return checked;

  const gaps = checked.gaps.get(part) ?? [];

  if (typeof gaps === 'string') return { problem: gaps };

  const hints = checked.hints.get(part) ?? [];

  return {
    gaps,
    ...(checked.exceptions.length > 0 ? { exceptions: checked.exceptions } : {}),
    ...(hints.length > 0 ? { hints } : {}),
  };
};

/**
 * Checks each named part as `completenessOf` does, sharing one server, browser and cache, and answers the gaps of
 * each part, or why it could not be checked as a string.
 */
export const partsCompletenessOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts: string[];
  sketch?: SketchVariant | null;
  chromiumOf?: typeof chromiumOf;
}): Promise<
  | { gaps: Map<string, CompletenessGap[] | string>; exceptions: ListedException[]; hints: Map<string, string[]> }
  | { unavailable: string }
> => {
  const { target, config, product, sketch = null } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;
  const system = createSystemModules({ target, config });
  const parts = (sketch ? system.drawnOf(product.name, sketch) : product)?.parts ?? [];
  const optionValuesOf = optionValuesChecker({ target, config, parts });

  if (!(await resolveChromium(target)))
    return { unavailable: 'neither the checkout nor this package resolves playwright or playwright-core' };

  const queue = createDrawQueue({ target, chromiumOf: resolveChromium });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;

    const checked = new Map<string, CompletenessGap[] | string>();
    const exceptions: ListedException[] = [];
    const hints = new Map<string, string[]>();
    const gapsOfPart = async (key: string, chain: string[]): Promise<CompletenessGap[] | string> => {
      const known = checked.get(key);

      if (known !== undefined && !chain.includes(key)) return known;

      const gaps = await freshGapsOfPart(key, chain);

      checked.set(key, gaps);

      return gaps;
    };
    const freshGapsOfPart = async (key: string, chain: string[]): Promise<CompletenessGap[] | string> => {
      const resolved = parts.find((candidate) => partKeyOf(candidate) === key);

      if (!resolved) return `product "${product.name}" has no part "${key}"`;
      if (chain.includes(key)) return `its controls name each other in a cycle: ${[...chain, key].join(' > ')}`;

      const sight = await seePart({
        product,
        part: resolved,
        system,
        base: `http://localhost:${port}`,
        load: (id) => server.ssrLoadModule(id),
        draw: (job) => queue.run(job),
        sketch,
      });

      if (typeof sight === 'string') return [{ code: 'RENDER', target: key, detail: sight.split('\n')[0] ?? '' }];

      const { definition, states, seen, refused, changes, owner, hash } = sight;
      const optionProblems = optionValuesOf(resolved, definition ?? {});

      hints.set(key, [
        ...smallChangeHintsOf({ part: key, controls: definition?.controls, changes }),
        ...controlStateGapsOf({ part: key, controls: definition?.controls, states }).map(completenessGapLineOf),
        ...discoveryGapsOf({ part: key, declared: declaredControlsOf(definition?.controls) ?? {}, frames: seen })
          .filter(isUndeclaredControlGap)
          .map(completenessGapLineOf),
        ...optionProblems
          .filter((gap) => gap.code === 'OPTION-VALUE-MISSING')
          .map((gap) => completenessGapLineOf({ ...gap, target: key })),
      ]);
      const sketched = product.parts.find((candidate) => partKeyOf(candidate) === key)?.file !== resolved.file;
      const reviewed = sketched || readMerged(owner.dir)[key] === hash;
      const referenced: ReferencedParts = {};
      const used = [
        ...Object.values(declaredControlsOf(definition?.controls) ?? {}).map((control) => control.part),
        ...ownersOf(seen),
      ];

      const isKitPart = (other: string) =>
        resolved.origin !== 'base' && parts.find((candidate) => partKeyOf(candidate) === other)?.origin === 'base';

      for (const other of used)
        if (other !== null && !(other in referenced))
          referenced[other] = isKitPart(other) ? [] : await gapsOfPart(other, [...chain, key]);

      const excepted = withExceptions({
        part: key,
        exceptions: readExceptions(owner.dir),
        hash,
        gaps: completenessGapsOf({
          part: key,
          controls: definition?.controls,
          states,
          frames: seen,
          reviewed,
          grid: definition?.grid,
          referenced,
          inventory:
            resolved.layer === 'pages'
              ? inventoryStateOf({ approval: readInventory(owner.dir)[key], ids: inventoryIdsOf(seen), hash })
              : undefined,
        }),
      });

      exceptions.push(...excepted.listed);

      return [
        ...refused.map((detail) => ({ code: 'RENDER', target: key, detail })),
        ...optionProblems.filter((gap) => gap.code !== 'OPTION-VALUE-MISSING').map((gap) => ({ ...gap, target: key })),
        ...excepted.gaps,
      ];
    };

    const gaps = new Map<string, CompletenessGap[] | string>();

    for (const part of options.parts) gaps.set(part, await gapsOfPart(part, []));

    return { gaps, exceptions, hints };
  } catch (error) {
    if (error instanceof ThumbUnavailableError) return { unavailable: error.message };

    throw error;
  } finally {
    await Promise.all([queue.close(), server.close()]);
  }
};
