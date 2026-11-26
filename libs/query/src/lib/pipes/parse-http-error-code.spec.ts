import { HttpStatusCode } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { parseHttpErrorCodeToMessageDe, parseHttpErrorCodeToTitleDe } from './parse-http-error-code-de';
import { parseHttpErrorCodeToMessageEn, parseHttpErrorCodeToTitleEn } from './parse-http-error-code-en';

type Text = { title: string; message: string };

const CASES: [HttpStatusCode, de: Text, en: Text][] = [
  [
    HttpStatusCode.BadRequest,
    {
      title: 'Ungültige Anfrage',
      message: 'Entschuldigung, wir konnten Ihre Anfrage nicht bearbeiten. Bitte versuchen Sie es später erneut.',
    },
    { title: 'Bad request', message: 'Sorry, we could not process your request. Please try again later.' },
  ],
  [
    HttpStatusCode.Unauthorized,
    {
      title: 'Nicht autorisiert',
      message: 'Sie sind nicht berechtigt, diese Aktion auszuführen. Bitte melden Sie sich an, um fortzufahren.',
    },
    { title: 'Unauthorized', message: 'You are not authorized to perform this action. Please log in to continue.' },
  ],
  [
    HttpStatusCode.PaymentRequired,
    { title: 'Zahlung erforderlich', message: 'Zur Ausführung dieser Aktion ist eine Zahlung erforderlich.' },
    { title: 'Payment required', message: 'Payment is required to complete this action.' },
  ],
  [
    HttpStatusCode.Forbidden,
    { title: 'Verboten', message: 'Sie haben keine Berechtigung, diese Aktion auszuführen.' },
    { title: 'Forbidden', message: 'You do not have permission to perform this action.' },
  ],
  [
    HttpStatusCode.NotFound,
    { title: 'Nicht gefunden', message: 'Die angeforderte Ressource wurde nicht gefunden.' },
    { title: 'Not found', message: 'The requested resource was not found.' },
  ],
  [
    HttpStatusCode.MethodNotAllowed,
    { title: 'Methode nicht erlaubt', message: 'Die angeforderte Methode ist für diese Ressource nicht zulässig.' },
    { title: 'Method not allowed', message: 'The requested method is not allowed for this resource.' },
  ],
  [
    HttpStatusCode.NotAcceptable,
    {
      title: 'Nicht akzeptabel',
      message:
        'Die angeforderte Ressource ist nicht in der Lage, eine Antwort zu generieren, die der Liste der akzeptablen Werte entspricht.',
    },
    {
      title: 'Not acceptable',
      message: 'The requested resource is not capable of generating a response matching the list of acceptable values.',
    },
  ],
  [
    HttpStatusCode.ProxyAuthenticationRequired,
    {
      title: 'Proxy-Authentifizierung erforderlich',
      message: 'Zur Ausführung dieser Aktion ist eine Proxy-Authentifizierung erforderlich.',
    },
    { title: 'Proxy authentication required', message: 'Proxy authentication is required to complete this action.' },
  ],
  [
    HttpStatusCode.RequestTimeout,
    { title: 'Anforderungszeitüberschreitung', message: 'Der Server hat zu lange auf die Anforderung gewartet.' },
    { title: 'Request timeout', message: 'The server timed out waiting for the request.' },
  ],
  [
    HttpStatusCode.Conflict,
    { title: 'Konflikt', message: 'Die Anforderung steht im Widerspruch zum aktuellen Zustand der Ressource.' },
    { title: 'Conflict', message: 'The request conflicts with the current state of the resource.' },
  ],
  [
    HttpStatusCode.Gone,
    {
      title: 'Nicht mehr verfügbar',
      message: 'Die angeforderte Ressource ist nicht mehr verfügbar und wird auch nicht mehr verfügbar sein.',
    },
    { title: 'Gone', message: 'The requested resource is no longer available and will not be available again.' },
  ],
  [
    HttpStatusCode.LengthRequired,
    {
      title: 'Länge erforderlich',
      message:
        'Die Anforderung hat die Länge ihres Inhalts nicht angegeben, die von der angeforderten Ressource benötigt wird.',
    },
    {
      title: 'Length required',
      message: 'The request did not specify the length of its content, which is required by the requested resource.',
    },
  ],
  [
    HttpStatusCode.PreconditionFailed,
    {
      title: 'Vorbedingung fehlgeschlagen',
      message: 'Der Server erfüllt eine der Voraussetzungen nicht, die der Anforderer an die Anforderung gestellt hat.',
    },
    {
      title: 'Precondition failed',
      message: 'The server does not meet one of the preconditions that the requester put on the request.',
    },
  ],
  [
    HttpStatusCode.PayloadTooLarge,
    {
      title: 'Nutzlast zu groß',
      message: 'Die Anforderung ist größer als der Server bereit oder in der Lage ist, zu verarbeiten.',
    },
    { title: 'Payload too large', message: 'The request is larger than the server is willing or able to process.' },
  ],
  [
    HttpStatusCode.UriTooLong,
    { title: 'URI zu lang', message: 'Die bereitgestellte URL war für den Server zu lang, um sie zu verarbeiten.' },
    { title: 'URI too long', message: 'The URL provided was too long for the server to process.' },
  ],
  [
    HttpStatusCode.UnsupportedMediaType,
    {
      title: 'Nicht unterstützter Medientyp',
      message: 'Die Anforderungseinheit hat einen Medientyp, den der Server oder die Ressource nicht unterstützt.',
    },
    {
      title: 'Unsupported media type',
      message: 'The request entity has a media type which the server or resource does not support.',
    },
  ],
  [
    HttpStatusCode.RangeNotSatisfiable,
    {
      title: 'Seite nicht vorhanden',
      message: 'Die angeforderte Seite existiert nicht. Gehen Sie zurück zur ersten Seite und versuchen Sie es erneut.',
    },
    {
      title: 'Page out of range',
      message: 'The requested page does not exist. Go back to the first page and try again.',
    },
  ],
  [
    HttpStatusCode.ExpectationFailed,
    {
      title: 'Erwartung fehlgeschlagen',
      message: 'Der Server kann die Anforderungen des Erwartung-Anforderungskopffelds nicht erfüllen.',
    },
    {
      title: 'Expectation failed',
      message: 'The server cannot meet the requirements of the Expect request-header field.',
    },
  ],
  [
    HttpStatusCode.ImATeapot,
    { title: 'Ich bin eine Teekanne', message: 'Ich bin eine Teekanne.' },
    { title: 'I am a teapot', message: 'I am a teapot.' },
  ],
  [
    HttpStatusCode.MisdirectedRequest,
    {
      title: 'Fehlgeleitete Anfrage',
      message:
        'Die Anforderung wurde an einen Server gerichtet, der nicht in der Lage ist, eine Antwort zu generieren.',
    },
    {
      title: 'Misdirected request',
      message: 'The request was directed at a server that is not able to produce a response.',
    },
  ],
  [
    HttpStatusCode.UnprocessableEntity,
    {
      title: 'Unverarbeitbare Entität',
      message: 'Die Anforderung war gut formuliert, konnte aber aufgrund semantischer Fehler nicht befolgt werden.',
    },
    {
      title: 'Unprocessable entity',
      message: 'The request was well-formed but was unable to be followed due to semantic errors.',
    },
  ],
  [
    HttpStatusCode.Locked,
    { title: 'Gesperrt', message: 'Die Ressource, auf die zugegriffen wird, ist gesperrt.' },
    { title: 'Locked', message: 'The resource that is being accessed is locked.' },
  ],
  [
    HttpStatusCode.FailedDependency,
    {
      title: 'Fehlgeschlagene Abhängigkeit',
      message: 'Die Anforderung ist aufgrund eines Fehlers einer vorherigen Anforderung fehlgeschlagen.',
    },
    { title: 'Failed dependency', message: 'The request failed due to failure of a previous request.' },
  ],
  [
    HttpStatusCode.TooEarly,
    {
      title: 'Zu früh',
      message:
        'Der Server verarbeitet die Anforderung nicht, weil sie eine Wiederholung sein könnte. Bitte versuchen Sie es erneut.',
    },
    {
      title: 'Too early',
      message: 'The server refuses to process a request that could be a replay. Please try again.',
    },
  ],
  [
    HttpStatusCode.UpgradeRequired,
    {
      title: 'Upgrade erforderlich',
      message:
        'Der Client sollte zu einem anderen Protokoll wie TLS/1.0 wechseln, das im Upgrade-Anforderungskopffeld angegeben ist.',
    },
    {
      title: 'Upgrade required',
      message: 'The client should switch to a different protocol such as TLS/1.0, given in the Upgrade header field.',
    },
  ],
  [
    HttpStatusCode.PreconditionRequired,
    { title: 'Vorbedingung erforderlich', message: 'Der Ursprungsserver erfordert, dass die Anforderung bedingt ist.' },
    { title: 'Precondition required', message: 'The origin server requires the request to be conditional.' },
  ],
  [
    HttpStatusCode.TooManyRequests,
    {
      title: 'Zu viele Anfragen',
      message: 'Sie haben in einer bestimmten Zeit zu viele Anfragen gesendet. Bitte versuchen Sie es später erneut.',
    },
    {
      title: 'Too many requests',
      message: 'You have sent too many requests in a given amount of time. Please try again later.',
    },
  ],
  [
    HttpStatusCode.RequestHeaderFieldsTooLarge,
    {
      title: 'Anforderungskopffelder zu groß',
      message: 'Der Server ist nicht bereit, die Anforderung zu verarbeiten, weil seine Kopffelder zu groß sind.',
    },
    {
      title: 'Request header fields too large',
      message: 'The server is unwilling to process the request because its header fields are too large.',
    },
  ],
  [
    HttpStatusCode.UnavailableForLegalReasons,
    {
      title: 'Aus rechtlichen Gründen nicht verfügbar',
      message: 'Die Ressource ist aufgrund einer rechtlichen Forderung nicht verfügbar.',
    },
    { title: 'Unavailable for legal reasons', message: 'The resource is unavailable due to a legal demand.' },
  ],
  [
    HttpStatusCode.InternalServerError,
    { title: 'Interner Serverfehler', message: 'Etwas ist schief gelaufen. Bitte versuchen Sie es später erneut.' },
    { title: 'Internal server error', message: 'Something went wrong on our end. Please try again later.' },
  ],
  [
    HttpStatusCode.NotImplemented,
    {
      title: 'Nicht implementiert',
      message: 'Der Server unterstützt die zur Erfüllung der Anforderung erforderliche Funktionalität nicht.',
    },
    {
      title: 'Not implemented',
      message: 'The server does not support the functionality required to fulfill the request.',
    },
  ],
  [
    HttpStatusCode.BadGateway,
    { title: 'Schlechtes Gateway', message: 'Etwas ist schief gelaufen. Bitte versuchen Sie es später erneut.' },
    { title: 'Bad gateway', message: 'Something went wrong on our end. Please try again later.' },
  ],
  [
    HttpStatusCode.ServiceUnavailable,
    {
      title: 'Dienst nicht verfügbar',
      message:
        'Der Server kann die Anforderung derzeit nicht bearbeiten, da er vorübergehend überlastet oder gewartet wird.',
    },
    {
      title: 'Service unavailable',
      message:
        'The server is currently unable to handle the request due to a temporary overload or maintenance of the server.',
    },
  ],
  [
    HttpStatusCode.GatewayTimeout,
    {
      title: 'Gateway-Zeitüberschreitung',
      message:
        'Der Server hat beim Versuch, die Anforderung abzuschließen, keine rechtzeitige Antwort vom Server erhalten.',
    },
    {
      title: 'Gateway timeout',
      message:
        'The server, while acting as a gateway or proxy, did not receive a timely response from the upstream server specified by the URL or some other auxiliary server it needed to access in attempting to complete the request.',
    },
  ],
  [
    HttpStatusCode.HttpVersionNotSupported,
    {
      title: 'HTTP-Version nicht unterstützt',
      message: 'Der Server unterstützt die in der Anforderung verwendete HTTP-Protokollversion nicht.',
    },
    {
      title: 'HTTP version not supported',
      message: 'The server does not support the HTTP protocol version used in the request.',
    },
  ],
  [
    HttpStatusCode.VariantAlsoNegotiates,
    {
      title: 'Variante verhandelt auch',
      message:
        'Der Server hat einen internen Konfigurationsfehler: Die ausgewählte Variantenressource ist so konfiguriert, dass sie sich selbst in die transparente Inhaltsverhandlung einbindet, und ist daher kein geeigneter Endpunkt im Verhandlungsprozess.',
    },
    {
      title: 'Variant also negotiates',
      message:
        'The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.',
    },
  ],
  [
    HttpStatusCode.InsufficientStorage,
    {
      title: 'Unzureichender Speicher',
      message:
        'Die Methode konnte auf die Ressource nicht angewendet werden, weil der Server nicht in der Lage ist, die für die erfolgreiche Ausführung der Anforderung erforderliche Darstellung zu speichern.',
    },
    {
      title: 'Insufficient storage',
      message:
        'The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request.',
    },
  ],
  [
    HttpStatusCode.LoopDetected,
    {
      title: 'Schleifenerkennung',
      message: 'Der Server hat eine Endlosschleife erkannt, während er die Anforderung verarbeitet.',
    },
    { title: 'Loop detected', message: 'The server detected an infinite loop while processing the request.' },
  ],
  [
    HttpStatusCode.NotExtended,
    {
      title: 'Nicht erweitert',
      message: 'Weitere Erweiterungen der Anforderung sind erforderlich, damit der Server sie erfüllen kann.',
    },
    { title: 'Not extended', message: 'Further extensions to the request are required for the server to fulfill it.' },
  ],
  [
    HttpStatusCode.NetworkAuthenticationRequired,
    {
      title: 'Netzwerkauthentifizierung erforderlich',
      message: 'Sie müssen sich authentifizieren, um Zugang zum Netzwerk zu erhalten.',
    },
    { title: 'Network authentication required', message: 'You need to authenticate to gain network access.' },
  ],
];

const DEFAULT_DE: Text = {
  title: 'Etwas ist schief gelaufen',
  message: 'Etwas ist schief gelaufen. Überprüfen Sie Ihre Internetverbindung und versuchen Sie es später erneut.',
};

const DEFAULT_EN: Text = {
  title: 'Something went wrong',
  message: 'Something went wrong. Check your internet connection and try again later.',
};

const de = (code: number): Text => ({
  title: parseHttpErrorCodeToTitleDe(code),
  message: parseHttpErrorCodeToMessageDe(code),
});

const en = (code: number): Text => ({
  title: parseHttpErrorCodeToTitleEn(code),
  message: parseHttpErrorCodeToMessageEn(code),
});

const errorStatusCodes = Object.values(HttpStatusCode).filter(
  (code): code is HttpStatusCode => typeof code === 'number' && code >= 400,
);

describe('parseHttpErrorCode', () => {
  it.each(CASES)('describes %i in German and English', (code, expectedDe, expectedEn) => {
    expect(de(code)).toEqual(expectedDe);
    expect(en(code)).toEqual(expectedEn);
  });

  it.each([0, 200, 302, 499, 599, HttpStatusCode.Ok])('falls back to the generic text for %i', (code) => {
    expect(de(code)).toEqual(DEFAULT_DE);
    expect(en(code)).toEqual(DEFAULT_EN);
  });

  it('has a dedicated text for every 4xx and 5xx status Angular knows, in both languages', () => {
    const genericDe = errorStatusCodes.filter((code) => de(code).title === DEFAULT_DE.title);
    const genericEn = errorStatusCodes.filter((code) => en(code).title === DEFAULT_EN.title);

    expect(genericDe).toEqual([]);
    expect(genericEn).toEqual([]);
    expect(CASES.map(([code]) => code).sort((a, b) => a - b)).toEqual([...errorStatusCodes].sort((a, b) => a - b));
  });
});
