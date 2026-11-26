import { Pipe, PipeTransform } from '@angular/core';
import { htmlToMarkdown } from '../utils/markdown';

@Pipe({ name: 'htmlToMarkdown' })
export class HtmlToMarkdownPipe implements PipeTransform {
  transform = htmlToMarkdown;
}
