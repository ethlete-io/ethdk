/**
 * Farn, an invented plant shop: the content every frame of Studio's own sketch view shows, so a pin or a change
 * in a frame never reads as a change to Studio itself. Plain markup under Farn's own surface and colour theme, shared
 * by the design parts and the harness.
 */

export const FARN_SCOPE = 'et-surface--farn et-color--farn';

export const SAMPLE_BAR_STATES = ['guest', 'guest-basket', 'member', 'member-basket', 'checkout', 'checkout-basket'];

export const SAMPLE_BAR_HEIGHT = 48;

export const SAMPLE_STEPPER_WIDTH = 176;

export const SAMPLE_STEPPER_HEIGHT = 30;

const STEPPER_TARGETS = ['minus', 'count', 'plus', 'add'] as const;

const INTERACTIONS = ['', '-hover', '-active', '-focus-visible'] as const;

export const SAMPLE_STEPPER_STATES = STEPPER_TARGETS.flatMap((target) =>
  INTERACTIONS.map((interaction) => `${target}${interaction}`),
);

const PLANTS = [
  'Monstera',
  'Calathea',
  'Geigenfeige',
  'Zamioculcas',
  'Pilea',
  'Strelitzie',
  'Bogenhanf',
  'Efeutute',
  'Kentia',
  'Alocasia',
];

const leaf = (size: string, tone: string) =>
  `<span class="block ${size} rounded-tl-full rounded-br-full ${tone}"></span>`;

const mark = `<span class="flex items-center gap-space-2">${leaf('size-4.5', 'bg-et-theme')}<span class="text-ui-lg font-ui-strong tracking-tight text-et-surface">farn</span></span>`;

const basketPill = (count: number) =>
  `<span class="flex h-8 items-center gap-space-2 rounded-full bg-et-theme px-space-3 text-ui-sm font-ui-medium text-et-on-theme">Korb<span class="flex size-5 items-center justify-center rounded-full bg-et-surface-bg text-ui-xs text-et-theme-ink">${count}</span></span>`;

const emptyBasket = `<span class="flex h-8 items-center rounded-full px-space-3 text-ui-sm text-et-surface-muted shadow-[0_0_0_1px_var(--et-surface-border-solid)]">Korb</span>`;

const accountOf = (who: string, place: string) =>
  who === 'member'
    ? `<span class="${place} flex items-center gap-space-2 text-ui-sm text-et-surface"><span class="flex size-7 items-center justify-center rounded-full bg-et-theme/20 text-ui-xs font-ui-medium text-et-theme-ink">LM</span>Lena</span>`
    : who === 'checkout'
      ? `<span class="${place} flex items-center gap-space-2 text-ui-sm text-et-surface-muted"><span class="text-et-surface">Korb</span>·<span>Lieferung</span>·<span>Zahlung</span></span>`
      : `<span class="${place} text-ui-sm text-et-surface">Anmelden</span>`;

/** Farn's top bar, 1440 px wide: wordmark, shop navigation, search, the account and the basket. */
export const sampleBar = (state: string, fluid = false) => {
  const [who = 'guest', basket] = state.split('-');

  return `<div
  class="${FARN_SCOPE} box-border flex h-12 ${fluid ? 'w-full' : 'w-360'} items-center ${fluid ? 'gap-space-4 px-space-4 md:gap-8 md:px-space-6' : 'gap-8 px-space-6'} bg-et-surface-bg text-et-surface shadow-[inset_0_-1px_0_var(--et-surface-border-solid)]"
  data-farn-bar
>
  ${mark}
  <span class="${fluid ? 'hidden md:flex' : 'flex'} items-center gap-space-5 text-ui-sm text-et-surface-muted" data-farn-nav
    ><span class="text-et-surface">Pflanzen</span><span>Töpfe</span><span>Pflege</span><span>Geschenke</span></span
  >
  <span
    class="ml-auto ${fluid ? 'hidden md:flex' : 'flex'} h-9 w-2xl items-center gap-space-2 rounded-full bg-et-surface-interaction/8 px-space-4 text-ui-sm text-et-surface-muted inset-ring inset-ring-et-surface-border"
    data-farn-search
    ><svg viewBox="0 0 16 16" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg
    >Pflanzen suchen</span
  >
  ${accountOf(who, fluid ? 'ml-auto md:ml-0' : '')} ${basket ? basketPill(who === 'checkout' ? 3 : 2) : emptyBasket}
</div>`;
};

const stepperTone = (interaction: string) =>
  interaction === 'hover'
    ? 'bg-et-surface-interaction/14'
    : interaction === 'active'
      ? 'bg-et-surface-border'
      : interaction === 'focus-visible'
        ? 'inset-ring-2 inset-ring-et-theme'
        : '';

const addTone = (interaction: string) =>
  interaction === 'hover'
    ? 'bg-et-theme-hover'
    : interaction === 'active'
      ? 'bg-et-theme-active'
      : interaction === 'focus-visible'
        ? 'bg-et-theme inset-ring-2 inset-ring-et-surface'
        : 'bg-et-theme';

/** Farn's quantity stepper with the add button, 176 × 30 px; a state names its target and interaction, as `count-hover`. */
export const sampleStepper = (state: string) => {
  const [target = 'count', ...rest] = state.split('-');
  const interaction = rest.join('-');
  const toneOf = (own: string) => (own === target ? stepperTone(interaction) : '');
  const disabled = interaction === 'disabled' ? 'opacity-40' : '';

  return `<div
  class="${FARN_SCOPE} box-border flex h-7.5 w-44 items-center overflow-hidden rounded-control-md bg-et-surface-bg text-ui-sm text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
  data-farn-stepper
>
  <span class="flex h-full w-7.5 items-center justify-center text-et-surface-muted ${toneOf('minus')}" data-farn-minus>−</span>
  <span class="flex h-full w-7 items-center justify-center tabular-nums ${toneOf('count')}" data-farn-count>2</span>
  <span class="flex h-full w-7.5 items-center justify-center text-et-surface-muted ${toneOf('plus')}" data-farn-plus>+</span>
  <span
    class="flex h-full flex-1 items-center justify-center text-ui-xs font-ui-medium text-et-on-theme ${
      target === 'add' ? `${addTone(interaction)} ${disabled}` : 'bg-et-theme'
    }"
    data-farn-add
    >In den Korb</span
  >
</div>`;
};

type Leaf = {
  x?: number;
  y?: number;
  length?: number;
  width?: number;
  angle: number;
  scale?: number;
  tone: string;
};

const blade = ({ x = 100, y = 132, length = 20, width = 7, angle, tone }: Leaf) =>
  `<path d="M0 0C${width} ${-length * 0.25} ${width} ${-length * 0.75} 0 ${-length}C${-width} ${-length * 0.75} ${-width} ${-length * 0.25} 0 0Z" transform="translate(${x} ${y}) rotate(${angle})" class="${tone}" />`;

const stem = (x: number, y: number) =>
  `<path d="M100 132Q${(100 + x) / 2} ${y + 24} ${x} ${y}" fill="none" stroke-width="2" class="stroke-et-theme-ink/70" />`;

const monsteraLeaf = ({ x = 100, y = 132, length = 60, angle, tone }: Leaf) => {
  const slits = [
    [0.22, 0.5, 0.12],
    [0.45, 0.55, 0.14],
    [0.68, 0.5, 0.12],
  ]
    .flatMap(([at = 0, edge = 0, inner = 0]) =>
      [1, -1].map((side) => `M${side * edge * length} ${-at * length}L${side * inner * length} ${-at * length + 7}`),
    )
    .join('');
  const cut = `farn-monstera-cut-${length}`;

  return `<g transform="translate(${x} ${y}) rotate(${angle})"><mask id="${cut}"><rect x="${-length}" y="${-length * 1.2}" width="${length * 2}" height="${length * 1.4}" fill="white" /><path d="${slits}" stroke-width="3.5" stroke="black" /></mask><path d="M0 0C${length * 0.55} ${-length * 0.05} ${length * 0.6} ${-length * 0.8} 0 ${-length}C${-length * 0.6} ${-length * 0.8} ${-length * 0.55} ${-length * 0.05} 0 0Z" mask="url(#${cut})" class="${tone}" /></g>`;
};

const calatheaLeaf = ({ length = 60, angle, tone }: Leaf) => {
  const stripes = [0.25, 0.45, 0.65]
    .flatMap((at) => [1, -1].map((side) => `M0 ${-at * length}l${side * length * 0.16} ${-length * 0.08}`))
    .join('');

  return `<g transform="translate(100 132) rotate(${angle})"><path d="M0 0V-16" stroke-width="2" class="stroke-et-theme-ink/70" /><g transform="translate(0 -16)"><path d="M0 0C${length * 0.3} ${-length * 0.1} ${length * 0.32} ${-length * 0.85} 0 ${-length}C${-length * 0.32} ${-length * 0.85} ${-length * 0.3} ${-length * 0.1} 0 0Z" class="${tone}" /><path d="M0 -3V${-length + 4}${stripes}" fill="none" stroke-width="2.5" stroke-linecap="round" class="stroke-et-theme-ink" /></g></g>`;
};

const fiddleLeaf = ({ x = 100, y = 132, angle, scale = 1, tone }: Leaf) =>
  `<path d="M0 0C6 -6 4 -18 12 -28C20 -40 14 -52 0 -50C-14 -52 -20 -40 -12 -28C-4 -18 -6 -6 0 0Z" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" class="${tone}" />`;

const zamioStem = ({ length = 90, angle, tone }: Leaf) => {
  const leaflets = [0.45, 0.65, 0.85]
    .flatMap((at) => [55, -55].map((tilt) => blade({ x: 0, y: -at * length, angle: tilt, tone })))
    .join('');

  return `<g transform="translate(100 132) rotate(${angle})"><path d="M0 0V${-length}" stroke-width="2.5" class="stroke-et-theme-ink/70" />${leaflets}${blade({ x: 0, y: -length, angle: 0, tone })}</g>`;
};

const PILEA_COINS = [
  { x: 70, y: 112, r: 11, tone: 'fill-et-theme/80' },
  { x: 56, y: 84, r: 15, tone: 'fill-et-theme' },
  { x: 80, y: 56, r: 17, tone: 'fill-et-theme-ink' },
  { x: 108, y: 42, r: 19, tone: 'fill-et-theme' },
  { x: 138, y: 64, r: 16, tone: 'fill-et-theme-ink' },
  { x: 148, y: 98, r: 13, tone: 'fill-et-theme/80' },
  { x: 124, y: 104, r: 12, tone: 'fill-et-theme' },
];

const PLANT_DRAWINGS: Record<string, string> = {
  Monstera: [
    stem(122, 100),
    stem(74, 92),
    stem(100, 80),
    monsteraLeaf({ x: 122, y: 100, length: 56, angle: 48, tone: 'fill-et-theme/70' }),
    monsteraLeaf({ x: 74, y: 92, length: 62, angle: -40, tone: 'fill-et-theme' }),
    monsteraLeaf({ x: 100, y: 80, length: 70, angle: 6, tone: 'fill-et-theme-ink' }),
  ].join(''),
  Calathea: [
    calatheaLeaf({ angle: -62, length: 52, tone: 'fill-et-theme/80' }),
    calatheaLeaf({ angle: 58, length: 52, tone: 'fill-et-theme/80' }),
    calatheaLeaf({ angle: -32, length: 64, tone: 'fill-et-theme' }),
    calatheaLeaf({ angle: 30, length: 64, tone: 'fill-et-theme' }),
    calatheaLeaf({ angle: 0, length: 76, tone: 'fill-et-theme' }),
  ].join(''),
  Geigenfeige: [
    '<path d="M100 134C98 112 104 88 100 62" fill="none" stroke-width="4" stroke-linecap="round" class="stroke-et-surface-subtle" />',
    fiddleLeaf({ y: 124, angle: -64, scale: 0.85, tone: 'fill-et-theme/70' }),
    fiddleLeaf({ x: 101, y: 112, angle: 60, scale: 0.95, tone: 'fill-et-theme/70' }),
    fiddleLeaf({ x: 102, y: 98, angle: -46, scale: 1.05, tone: 'fill-et-theme' }),
    fiddleLeaf({ x: 101, y: 86, angle: 44, scale: 1.05, tone: 'fill-et-theme' }),
    fiddleLeaf({ y: 72, angle: -18, tone: 'fill-et-theme-ink' }),
    fiddleLeaf({ y: 64, angle: 16, scale: 0.95, tone: 'fill-et-theme-ink' }),
  ].join(''),
  Zamioculcas: [
    zamioStem({ angle: -22, length: 80, tone: 'fill-et-theme/70' }),
    zamioStem({ angle: 22, length: 86, tone: 'fill-et-theme' }),
    zamioStem({ angle: 0, length: 104, tone: 'fill-et-theme-ink' }),
  ].join(''),
  Pilea: [
    ...PILEA_COINS.map(({ x, y }) => stem(x, y)),
    ...PILEA_COINS.map(
      ({ x, y, r, tone }) =>
        `<circle cx="${x}" cy="${y}" r="${r}" class="${tone}" /><circle cx="${x}" cy="${y}" r="2" class="fill-et-surface-bg/40" />`,
    ),
  ].join(''),
};

const SPIKY_PLANT = [
  blade({ length: 78, width: 9, angle: -22, tone: 'fill-et-theme/70' }),
  blade({ length: 84, width: 9, angle: 20, tone: 'fill-et-theme/70' }),
  blade({ length: 96, width: 10, angle: -9, tone: 'fill-et-theme' }),
  blade({ length: 90, width: 10, angle: 8, tone: 'fill-et-theme-ink' }),
  blade({ length: 104, width: 10, angle: 0, tone: 'fill-et-theme' }),
].join('');

const plantArt = (name: string, size: string) => `<span
  class="flex ${size} items-center justify-center overflow-hidden rounded-control-md bg-et-theme/10"
  data-farn-plant="${name}"
  ><svg viewBox="0 0 200 200" class="aspect-square h-full" aria-hidden="true"
    ><circle cx="100" cy="92" r="72" class="fill-et-theme/8" />${PLANT_DRAWINGS[name] ?? SPIKY_PLANT}<rect
      x="66"
      y="128"
      width="68"
      height="10"
      rx="3"
      class="fill-et-surface-border"
    /><path d="M70 138H130L124 182Q100 188 76 182Z" class="fill-et-surface-border/70" /></svg
></span>`;

const card = ({
  name,
  price,
  art,
}: {
  name: string;
  price: string;
  art: string;
}) => `<span class="flex flex-col gap-space-2">
  ${plantArt(name, art)}
  <span class="flex items-baseline justify-between text-ui-md text-et-surface"><span class="font-ui-medium">${name}</span><span class="text-et-surface-muted">${price}</span></span>
</span>`;

const PERKS = ['Versand in 2 Tagen', '30 Tage Anwachsgarantie', 'Pflegekarte inklusive'];

/** A Farn shop page, 1440 × 900 px, featuring the plant the state's number picks. */
export const samplePage = (state: string, fluid = false) => {
  const index = Number(/\d+/.exec(state)?.[0] ?? '1') - 1;
  const plant = PLANTS[index % PLANTS.length] ?? 'Monstera';
  const others = [1, 2, 3, 4].map((step) => PLANTS[(index + step) % PLANTS.length] ?? 'Pilea');

  return `<div class="${FARN_SCOPE} box-border flex ${fluid ? 'min-h-225 w-full' : 'h-225 w-360'} flex-col overflow-hidden bg-et-surface-bg text-et-surface" data-farn-page="${state}">
  ${sampleBar('member', fluid)}
  <div class="mx-auto flex w-full max-w-320 flex-col ${fluid ? 'gap-space-7 px-space-6 pb-space-6 md:gap-10 md:px-16 md:pb-12' : 'gap-10 px-16'}">
    <div class="grid ${fluid ? 'gap-space-6 pt-space-6 md:grid-cols-2 md:items-center md:gap-16 md:pt-12' : 'grid-cols-2 items-center gap-16 pt-12'}" data-farn-hero>
      <span class="flex flex-col gap-space-5">
        <span class="w-fit rounded-full bg-et-theme/15 px-space-3 py-space-1 text-ui-xs font-ui-medium text-et-theme-ink">Pflanze der Woche</span>
        <span class="${fluid ? 'text-h1 md:text-[5.6rem]/[1.05]' : 'text-[5.6rem]/[1.05]'} font-ui-strong tracking-tight">${plant}</span>
        <span class="max-w-xl text-ui-lg text-et-surface-muted">Robust, dankbar und in drei Topfgrößen lieferbar. Mit Pflegekarte und Erde aus der Gärtnerei in Bremen.</span>
        <span class="flex items-center gap-space-4">${sampleStepper('count')}<span class="text-ui-md text-et-surface-muted">ab <span class="font-ui-medium text-et-surface">24 €</span></span></span>
        <span class="flex flex-wrap gap-x-space-5 gap-y-space-2 text-ui-sm text-et-surface-muted">${PERKS.map((perk) => `<span class="flex items-center gap-space-2">${leaf('size-2.5', 'bg-et-theme')}${perk}</span>`).join('')}</span>
      </span>
      ${plantArt(plant, fluid ? 'h-60 w-full md:h-100' : 'h-100 w-full')}
    </div>
    <div class="flex flex-col gap-space-4">
      <span class="flex items-baseline justify-between"><span class="text-ui-lg font-ui-strong">Beliebt diese Woche</span><span class="text-ui-sm font-ui-medium text-et-theme-ink">Alle Pflanzen</span></span>
      <div class="grid ${fluid ? 'grid-cols-2 gap-space-4 md:grid-cols-4 md:gap-space-6' : 'grid-cols-4 gap-space-6'}">
        ${others.map((name, step) => card({ name, price: `${18 + step * 6} €`, art: fluid ? 'h-40 w-full md:h-50' : 'h-50 w-full' })).join('')}
      </div>
    </div>
  </div>
</div>`;
};

/** One Farn pot-size tile, as a page row shows four of them. */
export const samplePotTile = (size: string, price: string) =>
  `<span class="${FARN_SCOPE} flex items-baseline gap-space-2 text-ui-sm"><span class="text-et-surface">Ø ${size} cm</span><span class="text-et-surface-muted">${price}</span></span>`;

export const SAMPLE_POT_SIZES = [
  { size: '12', price: '18 €' },
  { size: '17', price: '29 €' },
  { size: '21', price: '44 €' },
  { size: '27', price: '69 €' },
];

export const SAMPLE_PLANT_ROWS = [
  { name: 'Monstera deliciosa', note: 'Fensterblatt, halbschattig, alle zwei Wochen gießen.' },
  { name: 'Calathea orbifolia', note: 'Gestreifte Blätter, mag hohe Luftfeuchte.' },
  { name: 'Geigenfeige', note: 'Großes Blatt, hell, aber ohne pralle Sonne.' },
];

export const SAMPLE_CATEGORIES = ['Zimmerpflanzen', 'Große Pflanzen', 'Hängepflanzen', 'Kakteen', 'Töpfe', 'Pflege'];

export const sampleLeaf = leaf;
