import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  constructor(private readonly translationService: TranslationService) {}

  transform(key: string, params?: Record<string, string>): string {
    return this.translationService.t(key, params);
  }
}
