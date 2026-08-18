import { RegisteredIconName } from '../icon';

/** One action the palette can find and run. */
export type CommandPaletteCommand = {
  /**
   * Identifies the command for the lifetime of its registration. Registering a second command with an
   * id that is already taken replaces the first.
   */
  id: string;

  /** What the row reads, and the text the query is matched against. */
  label: string;

  /** Heading the command is listed under. Commands without one are listed before any group. */
  group?: string;

  /** A second line on the row. Not matched against the query. */
  description?: string;

  /** Extra words the query matches, for names a reader might search by but the label does not use. */
  keywords?: string[];

  /** Rendered before the label. The name must be registered in the app, not in the palette. */
  icon?: RegisteredIconName;

  /**
   * The shortcut this command also answers to, in `et-kbd` syntax - `mod+s`, `shift+alt+up`. Printed on
   * the row as keycaps. The palette only displays it; binding it is the app's job.
   */
  shortcut?: string;

  /** A disabled command is listed, but cannot be run and is skipped by the arrow keys. */
  disabled?: boolean;

  /** Orders commands that match the query equally well, highest first. Defaults to `0`. */
  priority?: number;

  /** Run when the row is chosen. The palette closes first, so this may open another overlay. */
  run: () => void;
};

/** A run of the label, marked where the query matched it. */
export type CommandPaletteLabelSegment = {
  text: string;
  matched: boolean;
};

/** A command that matched the current query, with what it scored and how to render its label. */
export type CommandPaletteResult = {
  command: CommandPaletteCommand;

  /** Only comparable against other results for the same query. Do not persist it. */
  score: number;

  /** The whole label in order. Concatenating every `text` gives the label back. */
  segments: CommandPaletteLabelSegment[];
};

/** Results under one heading, in the order they should be rendered. */
export type CommandPaletteResultGroup = {
  /** `null` for the commands that declared no group. */
  label: string | null;
  results: CommandPaletteResult[];
};
