import { Pipe, PipeTransform } from '@angular/core';
import { markdownToHtml } from '../utils/markdown';

@Pipe({ name: 'markdownToHtml' })
export class MarkdownToHtmlPipe implements PipeTransform {
  transform = markdownToHtml;
}
