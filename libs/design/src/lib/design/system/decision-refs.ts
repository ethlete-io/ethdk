const REF = /Impl Q\d+|finding \d+/gu;

/** The decision refs in `text` an agent may act on: `Impl Qn`, `finding n`. */
export const decisionRefsOf = (options: { target: string; text: string }) =>
  [...options.text.matchAll(REF)].map((match) => match[0]);
