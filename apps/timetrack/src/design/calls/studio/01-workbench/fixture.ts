/** One drawn answer of the call the workbench is open on. */
export type Variant = {
  key: string;
  name: string;
  verdict: 'chosen' | 'rejected' | null;
  /** True when the variant changed after its picture was taken, so the picture is out of date. */
  stale: boolean;
  /** Where the change sits against the number. This is the one thing the drawings differ in. */
  change: 'beside' | 'under' | 'over' | 'none';
  /** True when the change carries the accent colour. */
  accent: boolean;
};

export const VARIANTS: Variant[] = [
  {
    key: 'a',
    name: 'A · The change beside the number',
    verdict: 'rejected',
    stale: false,
    change: 'beside',
    accent: true,
  },
  {
    key: 'b',
    name: 'B · A hairline frame and the change',
    verdict: 'rejected',
    stale: false,
    change: 'under',
    accent: true,
  },
  { key: 'c', name: 'C · The number alone', verdict: 'rejected', stale: false, change: 'none', accent: false },
  { key: 'd', name: 'D · The change joins the number', verdict: null, stale: false, change: 'under', accent: true },
  { key: 'e', name: 'E · The change above the label', verdict: null, stale: true, change: 'over', accent: true },
  { key: 'f', name: 'F · The change without colour', verdict: null, stale: false, change: 'under', accent: false },
  { key: 'g', name: 'G · The change beside, no colour', verdict: null, stale: true, change: 'beside', accent: false },
  { key: 'h', name: 'H · The number alone, larger', verdict: null, stale: false, change: 'none', accent: false },
];

/** The variant the reader is looking at closely. Every option draws this one large. */
export const LARGE = 'd';

/** What the tile of every variant says, so a thumbnail carries the same content in each option. */
export const TILE = { label: 'Booked this week', number: '31.5', unit: 'h', change: '+4.0' };

/** The call the workbench is open on, so every option draws the same window. */
export const CALL = {
  project: 'sandbox',
  feature: 'The summary row',
  eyebrow: 'Sandbox · call 0',
  headline: 'How a summary tile carries its number',
};

/** The verbs the workbench offers for the variant it acts on. */
export const VERBS = ['Accept', 'Iterate', 'Reject', 'More like this'];

export const GROUND = '#14161a';
export const PLATE = '#1b1e24';
export const LINE = '#2b2f36';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8ed2bb';
