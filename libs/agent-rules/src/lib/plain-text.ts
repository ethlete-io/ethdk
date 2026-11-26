/** Tab and newline are the only control characters a printed line may hold. */
const isControl = (code: number) => (code < 0x20 ? code !== 0x09 && code !== 0x0a : code >= 0x7f && code <= 0x9f);

/**
 * One line as a terminal prints it literally.
 *
 * A Jira summary, a stand-in name and an error message all reach the terminal as somebody typed them.
 * An escape sequence in one of them can clear the screen, move the cursor or redraw a line that has
 * already been printed, so output could be made to say something the app never answered. Every control
 * character apart from tab and newline is printed as its own escaped form instead.
 */
export const plain = (text: string) =>
  [...text]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;

      return isControl(code) ? `\\x${code.toString(16).padStart(2, '0')}` : character;
    })
    .join('');
