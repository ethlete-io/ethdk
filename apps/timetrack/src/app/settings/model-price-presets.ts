import { BUILT_IN_PRICES, BUILT_IN_PRICES_CHECKED, ModelPrice } from '@ethlete/timetrack';

export type ModelPricePreset = Pick<ModelPrice, 'provider' | 'model' | 'input' | 'output' | 'cacheWrite' | 'cacheRead'>;

export const MODEL_PRICE_PRESETS_CHECKED = BUILT_IN_PRICES_CHECKED;

export const MODEL_PRICE_PRESETS: readonly ModelPricePreset[] = BUILT_IN_PRICES;

export const presetKey = (preset: Pick<ModelPricePreset, 'provider' | 'model'>) => `${preset.provider}:${preset.model}`;

export const presetByKey = (key: string) => MODEL_PRICE_PRESETS.find((preset) => presetKey(preset) === key) ?? null;
