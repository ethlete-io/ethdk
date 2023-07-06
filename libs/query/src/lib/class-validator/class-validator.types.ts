import { HttpStatusCode } from '../request';

export interface ClassValidatorError {
  statusCode: HttpStatusCode;
  message: string[];
  error: string;
}
