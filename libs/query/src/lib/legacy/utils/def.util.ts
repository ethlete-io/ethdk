/**
 * Dummy function for providing types while not breaking inference.
 * **This function always returns null.**
 * @see https://github.com/microsoft/TypeScript/issues/26242
 * @returns null
 */
export const def = <Data>() => null as unknown as Data;
