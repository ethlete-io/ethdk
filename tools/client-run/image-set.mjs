import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TRAPS = JSON.parse(readFileSync(join(import.meta.dirname, 'trap-titles.json'), 'utf8'));

/**
 * Picks the titles of `traps` (the hot-spot traps of the old Tomflix design, call 46 B) from a tomflix catalog
 * folder (`www/titles/*.json`), then fills up to `count` with the newest titles with a title logo, plus one without.
 * Each picked trap title carries its trap fields in `trap`.
 */
export const pickTitles = (titles, count, traps = TRAPS) => {
  const usable = titles
    .filter((t) => t.posterLarge && t.poster && t.backdrop && t.path)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  const picked = traps.flatMap((trap) => {
    const title = usable.find((t) => t.title === trap.title);
    return title ? [{ ...title, trap }] : [];
  });
  const rest = usable.filter((t) => !picked.some((p) => p.title === t.title));
  const free = Math.max(count - picked.length, 0);
  const withLogo = rest.filter((t) => logoOf(t)).slice(0, Math.max(free - 1, 0));
  const withoutLogo = picked.some((t) => !logoOf(t)) ? undefined : rest.find((t) => !logoOf(t));
  return [...picked, ...withLogo, ...(withoutLogo ? [withoutLogo] : [])];
};

const logoOf = (title) => [title.logo, title.logoEn].find((file) => file && !file.startsWith('mock'));

const slugOf = (title) => title.path.replace(/\/$/, '').split('/').pop();

/**
 * One entry of `katalog.json`: the files the image set holds for a title, `logo: null` when it has none and
 * `plakat: null` when it has no poster.
 */
export const entryOf = (title) => {
  const slug = slugOf(title);
  const logo = logoOf(title);
  const { trap = {} } = title;
  const poster = trap.poster !== false;
  const series = title.kind === 'series';
  return {
    title: title.title,
    year: title.year,
    kind: title.kind,
    genres: title.genres ?? [],
    runtimeMinutes: title.runtimeMinutes ?? null,
    certification: title.certification ?? null,
    versions: trap.versions ?? title.versions ?? [],
    isNew: trap.isNew ?? false,
    ...(series
      ? {
          seasonCount: trap.seasonCount ?? title.seasonCount ?? null,
          episodeCount: trap.episodeCount ?? title.episodeCount ?? null,
          newContent: trap.newContent ?? null,
          ...(trap.addedEpisodeCount ? { addedEpisodeCount: trap.addedEpisodeCount } : {}),
        }
      : {}),
    plakat: poster ? `${slug}-plakat.webp` : null,
    plakatKlein: poster ? `${slug}-plakat-klein.webp` : null,
    hintergrund: `${slug}-hintergrund.webp`,
    logo: logo ? `${slug}-logo.png` : null,
  };
};

/** Writes the image set (poster, small poster, backdrop and title logo per title, plus `katalog.json`) into `out`. */
export const writeImageSet = ({ catalog, out, count }) => {
  const titlesDir = join(catalog, 'www/titles');
  const images = join(catalog, 'images');
  const titles = readdirSync(titlesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(titlesDir, f), 'utf8')));
  const picked = pickTitles(titles, count);
  mkdirSync(out, { recursive: true });
  const entries = picked.map((title) => {
    const entry = entryOf(title);
    if (entry.plakat) {
      copyFileSync(join(images, title.posterLarge), join(out, entry.plakat));
      copyFileSync(join(images, title.poster), join(out, entry.plakatKlein));
    }
    copyFileSync(join(images, title.backdrop), join(out, entry.hintergrund));
    const logo = logoOf(title);
    if (logo && existsSync(join(images, logo))) copyFileSync(join(images, logo), join(out, entry.logo));
    else entry.logo = null;
    return entry;
  });
  writeFileSync(join(out, 'katalog.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries;
};
