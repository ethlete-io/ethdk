import { Directive, InjectionToken, computed, input } from '@angular/core';
import {
  AnyQuery,
  AnyQueryCollection,
  HttpStatusCode,
  RequestError,
  isClassValidatorError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
  shouldRetryRequest,
} from '@ethlete/query';
import { QueryErrorList } from '../../types';

export const QUERY_ERROR_TOKEN = new InjectionToken<QueryErrorDirective>('QUERY_ERROR_DIRECTIVE_TOKEN');

export const convertHttpStatusCodeToMessageEn = (statusCode: HttpStatusCode) => {
  switch (statusCode) {
    case HttpStatusCode.BadRequest:
      return 'Sorry, we could not process your request. Please try again later.';
    case HttpStatusCode.Unauthorized:
      return 'You are not authorized to perform this action. Please log in to continue.';
    case HttpStatusCode.PaymentRequired:
      return 'Payment is required to complete this action.';
    case HttpStatusCode.Forbidden:
      return 'You do not have permission to perform this action.';
    case HttpStatusCode.NotFound:
      return 'The requested resource was not found.';
    case HttpStatusCode.MethodNotAllowed:
      return 'The requested method is not allowed for this resource.';
    case HttpStatusCode.NotAcceptable:
      return 'The requested resource is not capable of generating a response matching the list of acceptable values.';
    case HttpStatusCode.ProxyAuthenticationRequired:
      return 'Proxy authentication is required to complete this action.';
    case HttpStatusCode.RequestTimeout:
      return 'The server timed out waiting for the request.';
    case HttpStatusCode.Conflict:
      return 'The request conflicts with the current state of the resource.';
    case HttpStatusCode.Gone:
      return 'The requested resource is no longer available and will not be available again.';
    case HttpStatusCode.LengthRequired:
      return 'The request did not specify the length of its content, which is required by the requested resource.';
    case HttpStatusCode.PreconditionFailed:
      return 'The server does not meet one of the preconditions that the requester put on the request.';
    case HttpStatusCode.PayloadTooLarge:
      return 'The request is larger than the server is willing or able to process.';
    case HttpStatusCode.UriTooLong:
      return 'The URL provided was too long for the server to process.';
    case HttpStatusCode.UnsupportedMediaType:
      return 'The request entity has a media type which the server or resource does not support.';
    case HttpStatusCode.RangeNotSatisfiable:
      return 'The client has asked for a portion of the file, but the server cannot supply that portion.';
    case HttpStatusCode.ExpectationFailed:
      return 'The server cannot meet the requirements of the Expect request-header field.';
    case HttpStatusCode.ImATeapot:
      return 'I am a teapot.';
    case HttpStatusCode.MisdirectedRequest:
      return 'The request was directed at a server that is not able to produce a response.';
    case HttpStatusCode.UnprocessableEntity:
      return 'The request was well-formed but was unable to be followed due to semantic errors.';
    case HttpStatusCode.Locked:
      return 'The resource that is being accessed is locked.';
    case HttpStatusCode.FailedDependency:
      return 'The request failed due to failure of a previous request.';
    case HttpStatusCode.TooEarly:
      return 'The server is unwilling to process the request because the user has not been authenticated.';
    case HttpStatusCode.UpgradeRequired:
      return 'The client should switch to a different protocol such as TLS/1.0, given in the Upgrade header field.';
    case HttpStatusCode.PreconditionRequired:
      return 'The origin server requires the request to be conditional.';
    case HttpStatusCode.TooManyRequests:
      return 'You have sent too many requests in a given amount of time. Please try again later.';
    case HttpStatusCode.RequestHeaderFieldsTooLarge:
      return 'The server is unwilling to process the request because its header fields are too large.';
    case HttpStatusCode.UnavailableForLegalReasons:
      return 'The resource is unavailable due to a legal demand.';
    case HttpStatusCode.InternalServerError:
      return 'Something went wrong on our end. Please try again later.';
    case HttpStatusCode.NotImplemented:
      return 'The server does not support the functionality required to fulfill the request.';
    case HttpStatusCode.BadGateway:
      return 'Something went wrong on our end. Please try again later.';
    case HttpStatusCode.ServiceUnavailable:
      return 'The server is currently unable to handle the request due to a temporary overload or maintenance of the server.';
    case HttpStatusCode.GatewayTimeout:
      return 'The server, while acting as a gateway or proxy, did not receive a timely response from the upstream server specified by the URL or some other auxiliary server it needed to access in attempting to complete the request.';
    case HttpStatusCode.HttpVersionNotSupported:
      return 'The server does not support the HTTP protocol version used in the request.';
    case HttpStatusCode.VariantAlsoNegotiates:
      return 'The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.';
    case HttpStatusCode.InsufficientStorage:
      return 'The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request.';
    case HttpStatusCode.LoopDetected:
      return 'The server detected an infinite loop while processing the request.';
    case HttpStatusCode.NotExtended:
      return 'Further extensions to the request are required for the server to fulfill it.';
    case HttpStatusCode.NetworkAuthenticationRequired:
      return 'You need to authenticate to gain network access.';
    default:
      return 'Something went wrong. Check your internet connection and try again later.';
  }
};

export const convertHttpStatusCodeToMessageDe = (statusCode: HttpStatusCode) => {
  switch (statusCode) {
    case HttpStatusCode.BadRequest:
      return 'Entschuldigung, wir konnten Ihre Anfrage nicht bearbeiten. Bitte versuchen Sie es später erneut.';
    case HttpStatusCode.Unauthorized:
      return 'Sie sind nicht berechtigt, diese Aktion auszuführen. Bitte melden Sie sich an, um fortzufahren.';
    case HttpStatusCode.PaymentRequired:
      return 'Zur Ausführung dieser Aktion ist eine Zahlung erforderlich.';
    case HttpStatusCode.Forbidden:
      return 'Sie haben keine Berechtigung, diese Aktion auszuführen.';
    case HttpStatusCode.NotFound:
      return 'Die angeforderte Ressource wurde nicht gefunden.';
    case HttpStatusCode.MethodNotAllowed:
      return 'Die angeforderte Methode ist für diese Ressource nicht zulässig.';
    case HttpStatusCode.NotAcceptable:
      return 'Die angeforderte Ressource ist nicht in der Lage, eine Antwort zu generieren, die der Liste der akzeptablen Werte entspricht.';
    case HttpStatusCode.ProxyAuthenticationRequired:
      return 'Zur Ausführung dieser Aktion ist eine Proxy-Authentifizierung erforderlich.';
    case HttpStatusCode.RequestTimeout:
      return 'Der Server hat auf die Anforderung gewartet.';
    case HttpStatusCode.Conflict:
      return 'Die Anforderung steht im Widerspruch zum aktuellen Zustand der Ressource.';
    case HttpStatusCode.Gone:
      return 'Die angeforderte Ressource ist nicht mehr verfügbar und wird auch nicht mehr verfügbar sein.';
    case HttpStatusCode.LengthRequired:
      return 'Die Anforderung hat die Länge ihres Inhalts nicht angegeben, die von der angeforderten Ressource benötigt wird.';
    case HttpStatusCode.PreconditionFailed:
      return 'Der Server erfüllt eine der Voraussetzungen nicht, die der Anforderer an die Anforderung gestellt hat.';
    case HttpStatusCode.PayloadTooLarge:
      return 'Die Anforderung ist größer als der Server bereit oder in der Lage ist, zu verarbeiten.';
    case HttpStatusCode.UriTooLong:
      return 'Die bereitgestellte URL war für den Server zu lang, um sie zu verarbeiten.';
    case HttpStatusCode.UnsupportedMediaType:
      return 'Die Anforderungseinheit hat einen Medientyp, den der Server oder die Ressource nicht unterstützt.';
    case HttpStatusCode.RangeNotSatisfiable:
      return 'Der Client hat einen Teil der Datei angefordert, aber der Server kann diesen Teil nicht liefern.';
    case HttpStatusCode.ExpectationFailed:
      return 'Der Server kann die Anforderungen des Erwartung-Anforderungskopffelds nicht erfüllen.';
    case HttpStatusCode.ImATeapot:
      return 'Ich bin eine Teekanne.';
    case HttpStatusCode.MisdirectedRequest:
      return 'Die Anforderung wurde an einen Server gerichtet, der nicht in der Lage ist, eine Antwort zu generieren.';
    case HttpStatusCode.UnprocessableEntity:
      return 'Die Anforderung war gut formuliert, konnte aber aufgrund semantischer Fehler nicht befolgt werden.';
    case HttpStatusCode.Locked:
      return 'Die Ressource, auf die zugegriffen wird, ist gesperrt.';
    case HttpStatusCode.FailedDependency:
      return 'Die Anforderung ist aufgrund eines Fehlers einer vorherigen Anforderung fehlgeschlagen.';
    case HttpStatusCode.TooEarly:
      return 'Der Server ist nicht bereit, die Anforderung zu verarbeiten, weil der Benutzer nicht authentifiziert wurde.';
    case HttpStatusCode.UpgradeRequired:
      return 'Der Client sollte zu einem anderen Protokoll wie TLS/1.0 wechseln, das im Upgrade-Anforderungskopffeld angegeben ist.';
    case HttpStatusCode.PreconditionRequired:
      return 'Der Ursprungsserver erfordert, dass die Anforderung bedingt ist.';
    case HttpStatusCode.TooManyRequests:
      return 'Sie haben in einer bestimmten Zeit zu viele Anfragen gesendet. Bitte versuchen Sie es später erneut.';
    case HttpStatusCode.RequestHeaderFieldsTooLarge:
      return 'Der Server ist nicht bereit, die Anforderung zu verarbeiten, weil seine Kopffelder zu groß sind.';
    case HttpStatusCode.UnavailableForLegalReasons:
      return 'Die Ressource ist aufgrund einer rechtlichen Forderung nicht verfügbar.';
    case HttpStatusCode.InternalServerError:
      return 'Etwas ist schief gelaufen. Bitte versuchen Sie es später erneut.';
    case HttpStatusCode.NotImplemented:
      return 'Der Server unterstützt die zur Erfüllung der Anforderung erforderliche Funktionalität nicht.';
    case HttpStatusCode.BadGateway:
      return 'Etwas ist schief gelaufen. Bitte versuchen Sie es später erneut.';
    case HttpStatusCode.ServiceUnavailable:
      return 'Der Server kann die Anforderung derzeit nicht bearbeiten, da er vorübergehend überlastet oder gewartet wird.';
    case HttpStatusCode.GatewayTimeout:
      return 'Der Server hat beim Versuch, die Anforderung abzuschließen, keine rechtzeitige Antwort vom Server erhalten.';
    case HttpStatusCode.HttpVersionNotSupported:
      return 'Der Server unterstützt die in der Anforderung verwendete HTTP-Protokollversion nicht.';
    case HttpStatusCode.VariantAlsoNegotiates:
      return 'Der Server hat einen internen Konfigurationsfehler: Die ausgewählte Variantenressource ist so konfiguriert, dass sie sich selbst in die transparente Inhaltsverhandlung einbindet, und ist daher kein geeigneter Endpunkt im Verhandlungsprozess.';
    case HttpStatusCode.InsufficientStorage:
      return 'Die Methode konnte auf die Ressource nicht angewendet werden, weil der Server nicht in der Lage ist, die für die erfolgreiche Ausführung der Anforderung erforderliche Darstellung zu speichern.';
    case HttpStatusCode.LoopDetected:
      return 'Der Server hat eine Endlosschleife erkannt, während er die Anforderung verarbeitet.';
    case HttpStatusCode.NotExtended:
      return 'Weitere Erweiterungen der Anforderung sind erforderlich, damit der Server sie erfüllen kann.';
    case HttpStatusCode.NetworkAuthenticationRequired:
      return 'Sie müssen sich authentifizieren, um Zugang zum Netzwerk zu erhalten.';
    default:
      return 'Etwas ist schief gelaufen. Überprüfen Sie Ihre Internetverbindung und versuchen Sie es später erneut.';
  }
};

export const convertHttpStatusCodeToTitleEn = (statusCode: HttpStatusCode) => {
  switch (statusCode) {
    case HttpStatusCode.BadRequest:
      return 'Bad request';
    case HttpStatusCode.Unauthorized:
      return 'Unauthorized';
    case HttpStatusCode.PaymentRequired:
      return 'Payment required';
    case HttpStatusCode.Forbidden:
      return 'Forbidden';
    case HttpStatusCode.NotFound:
      return 'Not found';
    case HttpStatusCode.MethodNotAllowed:
      return 'Method not allowed';
    case HttpStatusCode.NotAcceptable:
      return 'Not acceptable';
    case HttpStatusCode.ProxyAuthenticationRequired:
      return 'Proxy authentication required';
    case HttpStatusCode.RequestTimeout:
      return 'Request timeout';
    case HttpStatusCode.Conflict:
      return 'Conflict';
    case HttpStatusCode.Gone:
      return 'Gone';
    case HttpStatusCode.LengthRequired:
      return 'Length required';
    case HttpStatusCode.PreconditionFailed:
      return 'Precondition failed';
    case HttpStatusCode.PayloadTooLarge:
      return 'Payload too large';
    case HttpStatusCode.UriTooLong:
      return 'URI too long';
    case HttpStatusCode.UnsupportedMediaType:
      return 'Unsupported media type';
    case HttpStatusCode.RangeNotSatisfiable:
      return 'Range not satisfiable';
    case HttpStatusCode.ExpectationFailed:
      return 'Expectation failed';
    case HttpStatusCode.ImATeapot:
      return 'I am a teapot';
    case HttpStatusCode.MisdirectedRequest:
      return 'Misdirected request';
    case HttpStatusCode.UnprocessableEntity:
      return 'Unprocessable entity';
    case HttpStatusCode.Locked:
      return 'Locked';
    case HttpStatusCode.FailedDependency:
      return 'Failed dependency';
    case HttpStatusCode.TooEarly:
      return 'Too early';
    case HttpStatusCode.UpgradeRequired:
      return 'Upgrade required';
    case HttpStatusCode.PreconditionRequired:
      return 'Precondition required';
    case HttpStatusCode.TooManyRequests:
      return 'Too many requests';
    case HttpStatusCode.RequestHeaderFieldsTooLarge:
      return 'Request header fields too large';
    case HttpStatusCode.UnavailableForLegalReasons:
      return 'Unavailable for legal reasons';
    case HttpStatusCode.InternalServerError:
      return 'Internal server error';
    case HttpStatusCode.NotImplemented:
      return 'Not implemented';
    case HttpStatusCode.BadGateway:
      return 'Bad gateway';
    case HttpStatusCode.ServiceUnavailable:
      return 'Service unavailable';
    case HttpStatusCode.GatewayTimeout:
      return 'Gateway timeout';
    case HttpStatusCode.HttpVersionNotSupported:
      return 'HTTP version not supported';
    case HttpStatusCode.VariantAlsoNegotiates:
      return 'Variant also negotiates';
    case HttpStatusCode.InsufficientStorage:
      return 'Insufficient storage';
    case HttpStatusCode.LoopDetected:
      return 'Loop detected';
    case HttpStatusCode.NotExtended:
      return 'Not extended';
    case HttpStatusCode.NetworkAuthenticationRequired:
      return 'Network authentication required';
    default:
      return 'Something went wrong';
  }
};

export const convertHttpStatusCodeToTitleDe = (statusCode: HttpStatusCode) => {
  switch (statusCode) {
    case HttpStatusCode.BadRequest:
      return 'Ungültige Anfrage';
    case HttpStatusCode.Unauthorized:
      return 'Nicht autorisiert';
    case HttpStatusCode.PaymentRequired:
      return 'Zahlung erforderlich';
    case HttpStatusCode.Forbidden:
      return 'Verboten';
    case HttpStatusCode.NotFound:
      return 'Nicht gefunden';
    case HttpStatusCode.MethodNotAllowed:
      return 'Methode nicht erlaubt';
    case HttpStatusCode.NotAcceptable:
      return 'Nicht akzeptabel';
    case HttpStatusCode.ProxyAuthenticationRequired:
      return 'Proxy-Authentifizierung erforderlich';
    case HttpStatusCode.RequestTimeout:
      return 'Anforderungszeitüberschreitung';
    case HttpStatusCode.Conflict:
      return 'Konflikt';
    case HttpStatusCode.Gone:
      return 'Weg';
    case HttpStatusCode.LengthRequired:
      return 'Länge erforderlich';
    case HttpStatusCode.PreconditionFailed:
      return 'Vorbedingung fehlgeschlagen';
    case HttpStatusCode.PayloadTooLarge:
      return 'Nutzlast zu groß';
    case HttpStatusCode.UriTooLong:
      return 'URI zu lang';
    case HttpStatusCode.UnsupportedMediaType:
      return 'Nicht unterstützter Medientyp';
    case HttpStatusCode.RangeNotSatisfiable:
      return 'Bereich nicht zufriedenstellend';
    case HttpStatusCode.ExpectationFailed:
      return 'Erwartung fehlgeschlagen';
    case HttpStatusCode.ImATeapot:
      return 'Ich bin eine Teekanne';
    case HttpStatusCode.MisdirectedRequest:
      return 'Fehlgeleitete Anfrage';
    case HttpStatusCode.UnprocessableEntity:
      return 'Unverarbeitbare Entität';
    case HttpStatusCode.Locked:
      return 'Gesperrt';
    case HttpStatusCode.FailedDependency:
      return 'Fehlgeschlagene Abhängigkeit';
    case HttpStatusCode.TooEarly:
      return 'Zu früh';
    case HttpStatusCode.UpgradeRequired:
      return 'Upgrade erforderlich';
    case HttpStatusCode.PreconditionRequired:
      return 'Vorbedingung erforderlich';
    case HttpStatusCode.TooManyRequests:
      return 'Zu viele Anfragen';
    case HttpStatusCode.RequestHeaderFieldsTooLarge:
      return 'Anforderungskopffelder zu groß';
    case HttpStatusCode.UnavailableForLegalReasons:
      return 'Aus rechtlichen Gründen nicht verfügbar';
    case HttpStatusCode.InternalServerError:
      return 'Interner Serverfehler';
    case HttpStatusCode.NotImplemented:
      return 'Nicht implementiert';
    case HttpStatusCode.BadGateway:
      return 'Schlechtes Gateway';
    case HttpStatusCode.ServiceUnavailable:
      return 'Dienst nicht verfügbar';
    case HttpStatusCode.GatewayTimeout:
      return 'Gateway-Zeitüberschreitung';
    case HttpStatusCode.HttpVersionNotSupported:
      return 'HTTP-Version nicht unterstützt';
    case HttpStatusCode.VariantAlsoNegotiates:
      return 'Variante verhandelt auch';
    case HttpStatusCode.InsufficientStorage:
      return 'Unzureichender Speicher';
    case HttpStatusCode.LoopDetected:
      return 'Schleifenerkennung';
    case HttpStatusCode.NotExtended:
      return 'Nicht erweitert';
    case HttpStatusCode.NetworkAuthenticationRequired:
      return 'Netzwerkauthentifizierung erforderlich';
    default:
      return 'Etwas ist schief gelaufen';
  }
};

@Directive({
  standalone: true,
  exportAs: 'etQueryError',
  providers: [
    {
      provide: QUERY_ERROR_TOKEN,
      useExisting: QueryErrorDirective,
    },
  ],
})
export class QueryErrorDirective {
  error = input.required<RequestError | null>();
  query = input.required<AnyQuery | AnyQueryCollection | null>();
  language = input<'en' | 'de'>('en');

  readonly errorList = computed(() => {
    const error = this.error();

    if (!error) {
      return null;
    }

    const retryResult = shouldRetryRequest({ error, currentRetryCount: 0, headers: {} });

    const errorList: QueryErrorList = {
      canBeRetried: retryResult.retry,
      retryDelay: retryResult.delay ?? 0,
      isList: false,
      items: [],
      title:
        this.language() === 'en'
          ? convertHttpStatusCodeToTitleEn(error.status)
          : convertHttpStatusCodeToTitleDe(error.status),
    };

    const detail = error.detail;
    const defaultErrorMessage = `${this.language() === 'en' ? convertHttpStatusCodeToMessageEn(error.status) : convertHttpStatusCodeToMessageDe(error.status)} (Code: ${error.status})`;

    if (isClassValidatorError(detail)) {
      for (const error of detail.message) {
        errorList.items.push({ message: error });
      }
    } else if (isSymfonyFormViolationListError(detail)) {
      for (const violation of detail.violations) {
        errorList.items.push({ message: violation.message });
      }
    } else if (isSymfonyListError(detail)) {
      for (const error of detail) {
        errorList.items.push({ message: error.message });
      }
    } else if (typeof detail === 'object' && !!detail && 'message' in detail && typeof detail.message === 'string') {
      errorList.items.push({ message: detail.message });
    } else if (typeof detail === 'object' && !!detail && 'detail' in detail && typeof detail.detail === 'string') {
      // Symfony error response (during development)
      errorList.items.push({ message: detail.detail });
    } else if (typeof detail === 'string') {
      errorList.items.push({ message: detail });
    } else {
      errorList.items.push({ message: defaultErrorMessage });
    }

    errorList.isList = errorList.items.length > 1;

    if (errorList.items.length === 1) {
      const compareString = (str: string) => str.toLowerCase().replace(/\s/g, '').replace(/\.|,/g, '');

      if (compareString(errorList.items[0]!.message) === compareString(errorList.title)) {
        // Often the error title is the same as the error message. In this case we simply use the default error message as a message.
        // This way the same text is at least not displayed twice.
        errorList.items[0]!.message = defaultErrorMessage;
      }
    }

    return errorList;
  });
}
