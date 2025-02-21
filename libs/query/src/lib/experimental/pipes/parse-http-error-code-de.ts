import { HttpStatusCode } from '@angular/common/http';

export const parseHttpErrorCodeToTitleDe = (statusCode: HttpStatusCode) => {
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

export const parseHttpErrorCodeToMessageDe = (statusCode: HttpStatusCode) => {
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
