const LOG_ERROR = /Error when evaluating SSR module (\S+): (.*)/;

/**
 * The cause a failed shot reports. A 500 whose body is the failure picture carries no text, so the cause is the
 * `x-et-error` header when the server sets one, else the design server's log line for the view's sketch and variant.
 */
export const failureCauseOf = ({ view, answer, body, log }) => {
  const type = answer.headers?.get('content-type') ?? '';
  if (!type.startsWith('image/')) return `${answer.status} ${Buffer.from(body).toString('utf8').trim().slice(0, 200)}`;
  const header = answer.headers.get('x-et-error');
  if (header) return `${answer.status} ${header.slice(0, 200)}`;
  const slug = encodeURIComponent(view.sketch ?? '');
  const lines = log.split('\n').map((line) => LOG_ERROR.exec(line));
  const hit = lines.find(
    (found) =>
      found && found[1].includes(`design-sketch=${slug}`) && found[1].includes(`design-variant=${view.variant}`),
  );
  return hit
    ? `${answer.status} ${hit[2].slice(0, 200)}`
    : `${answer.status} Zelle zeichnet das Fehlerbild; Studio nennt keinen Fehlertext (judge-server.log hat keine Zeile dazu).`;
};
