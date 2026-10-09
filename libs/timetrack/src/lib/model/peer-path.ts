/** A machine's checkouts, each keyed by `repoKeyOf` of its origin and path. */
export type CheckoutKeys = Readonly<Record<string, string>>;

const SEPARATORS = /[\\/]+/;

/** `keys` with each checkout the user set an alias for keyed by that alias instead. A path `keys` lacks is left out. */
export const withRepoAliases = (options: {
  keys: CheckoutKeys;
  aliases: Readonly<Record<string, string>>;
}): CheckoutKeys =>
  Object.fromEntries(Object.entries(options.keys).map(([path, key]) => [path, options.aliases[path] ?? key]));

const trimRoot = (root: string) => root.replace(/[\\/]+$/, '') || root;

const remainderUnder = (path: string, root: string) => {
  const trimmed = trimRoot(root);

  if (path === trimmed) return '';

  return path.startsWith(trimmed) && /^[\\/]/.test(path.slice(trimmed.length)) ? path.slice(trimmed.length) : null;
};

const separatorOf = (root: string) => (root.includes('\\') && !root.includes('/') ? '\\' : '/');

/**
 * Maps a path a paired machine reported onto this machine's checkout with the same repository key,
 * keeping whatever lies below the peer's checkout, a trailing separator included. A path under no
 * peer checkout, or under one whose key no local checkout has, comes back unchanged. With several
 * local checkouts of one key the shortest path wins.
 */
export const translatePeerPath = (options: { path: string; peerKeys: CheckoutKeys; localKeys: CheckoutKeys }) => {
  const { path, peerKeys, localKeys } = options;
  const peer = Object.keys(peerKeys)
    .map((root) => ({ root, rest: remainderUnder(path, root) }))
    .filter((match): match is { root: string; rest: string } => match.rest !== null)
    .sort((left, right) => right.root.length - left.root.length)[0];

  if (!peer) return path;

  const local = Object.keys(localKeys)
    .filter((root) => localKeys[root] === peerKeys[peer.root])
    .sort((left, right) => left.length - right.length || left.localeCompare(right))[0];

  if (local === undefined) return path;

  const root = trimRoot(local);
  const separator = separatorOf(root);
  const rest = peer.rest.split(SEPARATORS).filter(Boolean).join(separator);
  const trailing = rest && /[\\/]$/.test(peer.rest) ? separator : '';

  return rest ? `${root}${separator}${rest}${trailing}` : root;
};
