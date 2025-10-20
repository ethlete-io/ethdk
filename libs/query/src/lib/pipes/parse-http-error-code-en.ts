import { HttpStatusCode } from '@angular/common/http';

export const parseHttpErrorCodeToTitleEn = (statusCode: HttpStatusCode) => {
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

export const parseHttpErrorCodeToMessageEn = (statusCode: HttpStatusCode) => {
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
