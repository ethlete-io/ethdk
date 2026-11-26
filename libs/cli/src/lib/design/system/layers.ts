export const LAYERS = ['foundations', 'components', 'elements', 'pages'] as const;

export type Layer = (typeof LAYERS)[number];

/** The layers a part of each layer may import. */
export const LAYER_USES: Record<Layer, readonly Layer[]> = {
  foundations: ['foundations'],
  components: ['foundations', 'components'],
  elements: ['foundations', 'components'],
  pages: ['foundations', 'components', 'elements'],
};

export const isLayer = (name: string): name is Layer => (LAYERS as readonly string[]).includes(name);

export const mayUse = (options: { from: Layer; to: Layer }) => LAYER_USES[options.from].includes(options.to);
