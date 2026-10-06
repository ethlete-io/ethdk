const COMPONENTS_IMPORT = /from\s*['"]@ethlete\/components(?:\/[^'"]*)?['"]/;
const START_TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /(\s+)([^\s"'>/=]+)((?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)/g;

export const TEMPLATE_URL = /templateUrl\s*:\s*['"]([^'"]+)['"]/g;

export type InputRename = {
  /** Element names (`et-select`) or attribute selectors (`etSelect`) that carry the input. */
  hosts: readonly string[];
  from: string;
  to: string;
};

export const SELECT_INPUT_RENAMES: readonly InputRename[] = [
  { hosts: ['et-select', 'etSelect'], from: 'error', to: 'loadError' },
  { hosts: ['et-select', 'etSelect'], from: 'customValueSeparators', to: 'separators' },
  { hosts: ['et-select', 'etSelect'], from: 'normalizeCustomValue', to: 'normalizeValue' },
  { hosts: ['et-tag-input', 'etTagInput'], from: 'maxTags', to: 'maxSelection' },
  { hosts: ['et-tag-input', 'etTagInput'], from: 'normalizeTag', to: 'normalizeValue' },
];

export const importsEthleteComponents = (content: string) => COMPONENTS_IMPORT.test(content);

const unwrapBinding = (name: string) => {
  const bracketed = /^\[([^\]]+)\]$/.exec(name);

  if (bracketed?.[1]) return { name: bracketed[1], wrap: (inner: string) => `[${inner}]` };
  if (name.startsWith('bind-')) return { name: name.slice(5), wrap: (inner: string) => `bind-${inner}` };

  return { name, wrap: (inner: string) => inner };
};

/** Returns the template or source with every renamed input binding rewritten on its host element, or `null` when there is none. */
export const renameSelectInputs = (content: string, renames: readonly InputRename[] = SELECT_INPUT_RENAMES) => {
  const next = content.replace(START_TAG, (tag, tagName: string, attributes: string) => {
    const attributeNames = [...attributes.matchAll(ATTRIBUTE)].map((match) => unwrapBinding(match[2] ?? '').name);
    const applicable = renames.filter((rename) =>
      rename.hosts.some((host) => host === tagName || attributeNames.includes(host)),
    );

    if (!applicable.length) return tag;

    const renamed = attributes.replace(ATTRIBUTE, (attribute, space: string, rawName: string, value: string) => {
      const binding = unwrapBinding(rawName);
      const rename = applicable.find((candidate) => candidate.from === binding.name);

      return rename ? `${space}${binding.wrap(rename.to)}${value}` : attribute;
    });

    return `<${tagName}${renamed}${tag.slice(tagName.length + attributes.length + 1)}`;
  });

  return next === content ? null : next;
};
