import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Picks `count` titles from a tomflix catalog folder (`www/titles/*.json`): the newest with a title logo, plus one without. */
export const pickTitles = (titles, count) => {
  const usable = titles
    .filter((t) => t.posterLarge && t.poster && t.backdrop && t.path)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  const withLogo = usable.filter((t) => logoOf(t)).slice(0, Math.max(count - 1, 1));
  const withoutLogo = usable.find((t) => !logoOf(t));
  return withoutLogo ? [...withLogo, withoutLogo] : withLogo;
};

const logoOf = (title) => [title.logo, title.logoEn].find((file) => file && !file.startsWith('mock'));

const slugOf = (title) => title.path.replace(/\/$/, '').split('/').pop();

/** One entry of `katalog.json`: the files the image set holds for a title, `logo: null` when it has none. */
export const entryOf = (title) => {
  const slug = slugOf(title);
  const logo = logoOf(title);
  return {
    title: title.title,
    year: title.year,
    kind: title.kind,
    genres: title.genres ?? [],
    runtimeMinutes: title.runtimeMinutes ?? null,
    plakat: `${slug}-plakat.webp`,
    plakatKlein: `${slug}-plakat-klein.webp`,
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
    copyFileSync(join(images, title.posterLarge), join(out, entry.plakat));
    copyFileSync(join(images, title.poster), join(out, entry.plakatKlein));
    copyFileSync(join(images, title.backdrop), join(out, entry.hintergrund));
    const logo = logoOf(title);
    if (logo && existsSync(join(images, logo))) copyFileSync(join(images, logo), join(out, entry.logo));
    else entry.logo = null;
    return entry;
  });
  writeFileSync(join(out, 'katalog.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries;
};
