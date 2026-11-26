import { TestBed } from '@angular/core/testing';
import { StructuredDataComponent } from './structured-data.component';

describe('StructuredDataComponent', () => {
  it('keeps closing-script payloads inside the JSON string', () => {
    const fixture = TestBed.createComponent(StructuredDataComponent);
    fixture.componentRef.setInput('data', {
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: 'safe</SCRIPT ><img src=x onerror=alert(1)>',
    });
    fixture.detectChanges();

    const script = fixture.nativeElement.querySelector('script');

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(JSON.parse(script.textContent).name).toBe('safe</SCRIPT ><img src=x onerror=alert(1)>');
  });
});
