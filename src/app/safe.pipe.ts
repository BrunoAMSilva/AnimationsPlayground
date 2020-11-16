import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'safe',
})
export class SafePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  public transform(untrusted, config = 'style'): any {
    switch (config) {
      case 'html':
        return this.sanitizer.bypassSecurityTrustHtml(untrusted);
      case 'script':
        return this.sanitizer.bypassSecurityTrustScript(untrusted);
      case 'url':
        return this.sanitizer.bypassSecurityTrustUrl(untrusted);
      case 'resourceurl':
        return this.sanitizer.bypassSecurityTrustResourceUrl(untrusted);
      default:
        return this.sanitizer.bypassSecurityTrustStyle(untrusted);
    }
  }
}
