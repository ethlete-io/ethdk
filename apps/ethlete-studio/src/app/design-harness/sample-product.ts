/**
 * Farn, an invented plant shop: the content every frame of Studio's own sketch view shows, so a pin or a change
 * in a frame never reads as a change to Studio itself. Plain markup with Studio's theme tokens, shared by the
 * design parts and the harness.
 */

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

const accountOf = (who: string) =>
  who === 'member'
    ? `<span class="flex items-center gap-space-2 text-ui-sm text-et-surface"><span class="flex size-7 items-center justify-center rounded-full bg-et-surface-interaction text-ui-xs font-ui-medium">LM</span>Lena</span>`
    : who === 'checkout'
      ? `<span class="flex items-center gap-space-2 text-ui-sm text-et-surface-muted"><span class="text-et-surface">Korb</span>·<span>Lieferung</span>·<span>Zahlung</span></span>`
      : `<span class="text-ui-sm text-et-surface">Anmelden</span>`;

/** Farn's top bar, 1440 px wide: wordmark, shop navigation, search, the account and the basket. */
export const sampleBar = (state: string) => {
  const [who = 'guest', basket] = state.split('-');

  return `<div
  class="box-border flex h-12 w-360 items-center gap-space-8 bg-et-surface-bg px-space-6 text-et-surface shadow-[inset_0_-1px_0_var(--et-surface-border-solid)]"
  data-farn-bar
>
  ${mark}
  <span class="flex items-center gap-space-5 text-ui-sm text-et-surface-muted" data-farn-nav
    ><span class="text-et-surface">Pflanzen</span><span>Töpfe</span><span>Pflege</span><span>Geschenke</span></span
  >
  <span
    class="ml-auto flex h-8 w-2xl items-center gap-space-2 rounded-full bg-et-surface-interaction px-space-4 text-ui-sm text-et-surface-muted"
    data-farn-search
    ><span class="size-2.5 rounded-full shadow-[0_0_0_1.5px_currentColor]"></span>Monstera, Farn, Kaktus …</span
  >
  ${accountOf(who)} ${basket ? basketPill(who === 'checkout' ? 3 : 2) : emptyBasket}
</div>`;
};

const stepperTone = (interaction: string) =>
  interaction === 'hover'
    ? 'bg-et-surface-interaction'
    : interaction === 'active'
      ? 'bg-et-surface-border'
      : interaction === 'focus-visible'
        ? 'ring-2 ring-et-theme ring-inset'
        : '';

const addTone = (interaction: string) =>
  interaction === 'hover'
    ? 'bg-et-theme-hover'
    : interaction === 'active'
      ? 'bg-et-theme-active'
      : interaction === 'focus-visible'
        ? 'bg-et-theme ring-2 ring-et-surface ring-inset'
        : 'bg-et-theme';

/** Farn's quantity stepper with the add button, 176 × 30 px; a state names its target and interaction, as `count-hover`. */
export const sampleStepper = (state: string) => {
  const [target = 'count', ...rest] = state.split('-');
  const interaction = rest.join('-');
  const toneOf = (own: string) => (own === target ? stepperTone(interaction) : '');
  const disabled = interaction === 'disabled' ? 'opacity-40' : '';

  return `<div
  class="box-border flex h-7.5 w-44 items-center overflow-hidden rounded-control-md bg-et-surface-bg text-ui-sm text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
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

const plantArt = (
  size: string,
) => `<span class="relative flex ${size} items-end justify-center overflow-hidden rounded-control-md bg-et-theme/10">
  <span class="absolute bottom-[38%] left-[30%] block h-[34%] w-[22%] -rotate-30 rounded-tl-full rounded-br-full bg-et-theme"></span>
  <span class="absolute bottom-[44%] left-[46%] block h-[40%] w-[24%] rotate-20 rounded-tl-full rounded-br-full bg-et-theme-ink"></span>
  <span class="absolute bottom-[36%] left-[54%] block h-[26%] w-[18%] rotate-60 rounded-tl-full rounded-br-full bg-et-theme/70"></span>
  <span class="relative mb-[10%] block h-[26%] w-[34%] rounded-t-sm rounded-b-[40%] bg-et-surface-border"></span>
</span>`;

const card = (name: string, price: string) => `<span class="flex flex-col gap-space-2">
  ${plantArt('h-50 w-full')}
  <span class="flex items-baseline justify-between text-ui-md text-et-surface"><span class="font-ui-medium">${name}</span><span class="text-et-surface-muted">${price}</span></span>
</span>`;

/** A Farn shop page, 1440 × 900 px, featuring the plant the state's number picks. */
export const samplePage = (state: string) => {
  const index = Number(/\d+/.exec(state)?.[0] ?? '1') - 1;
  const plant = PLANTS[index % PLANTS.length] ?? 'Monstera';
  const others = [1, 2, 3, 4].map((step) => PLANTS[(index + step) % PLANTS.length] ?? 'Pilea');

  return `<div class="box-border flex h-225 w-360 flex-col overflow-hidden bg-et-surface-bg text-et-surface" data-farn-page="${state}">
  ${sampleBar('member')}
  <div class="flex items-center gap-space-12 px-space-16 py-space-12">
    <span class="flex flex-1 flex-col gap-space-4">
      <span class="text-ui-sm font-ui-medium text-et-theme-ink">Pflanze der Woche</span>
      <span class="text-h1">${plant}</span>
      <span class="max-w-md text-ui-md text-et-surface-muted">Robust, dankbar und in drei Topfgrößen lieferbar. Mit Pflegekarte und Erde aus der Gärtnerei in Bremen.</span>
      <span class="flex items-center gap-space-4">${sampleStepper('count')}<span class="text-ui-md text-et-surface-muted">ab 24 €</span></span>
    </span>
    ${plantArt('h-90 w-120')}
  </div>
  <div class="grid grid-cols-4 gap-space-6 px-space-16">
    ${others.map((name, step) => card(name, `${18 + step * 6} €`)).join('')}
  </div>
</div>`;
};

/** One Farn pot-size tile, as a page row shows four of them. */
export const samplePotTile = (size: string, price: string) =>
  `<span class="flex items-baseline gap-space-2 text-ui-sm"><span class="text-et-surface">Ø ${size} cm</span><span class="text-et-surface-muted">${price}</span></span>`;

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
