import { HttpStatusCode } from '@angular/common/http';

export interface ClassValidatorError {
  statusCode: HttpStatusCode;
  message: string[];
  error: string;
}
