import { HttpStatusCode } from '@angular/common/http';

export interface SymfonyErrorTrace {
  args: string[];
  class: string;
  file: string;
  function: string;
  line: number;
  namespace: string;
  short_class: string;
  type: string;
}

export interface SymfonyError {
  class: string;
  detail: string;
  status: HttpStatusCode;
  title: string;
  trace: SymfonyErrorTrace[];
  type: string;
}
