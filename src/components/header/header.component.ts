import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyService, type AppCurrency } from '../../services/currency.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage, TranslationService } from '../../services/translation.service';

@Component({
  selector: 'joys-header',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // outputs property removed, use @Output decorator
  template: `
    <header class="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 lg:px-10 py-3 sticky top-0 z-50 w-full">
      <div class="flex flex-1 items-center gap-4">
        <button class="lg:hidden flex-none h-10 w-10 mr-2 rounded-md bg-white dark:bg-slate-900 shadow flex items-center justify-center" (click)="toggleSidebar.emit()" [attr.aria-label]="'header.openMenu' | translate">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <label class="hidden sm:flex flex-col min-w-0 h-10 max-w-64 w-full">
          <div class="flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div class="text-slate-500 flex bg-slate-50 dark:bg-slate-800 items-center justify-center pl-4 pr-1">
              <span class="material-symbols-outlined text-xl">search</span>
            </div>
            <input 
              class="form-input flex w-full min-w-0 flex-1 border-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-0 px-2 text-sm" 
              [placeholder]="'app.searchPlaceholder' | translate"
              [value]="searchValue"
              (input)="onSearchChange($event)"
            />
          </div>
        </label>
        <div class="flex-1"></div>
        <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            (click)="setLanguage('EN')"
            [class]="getLanguageButtonClasses('EN')"
          >
            {{ 'header.language.EN' | translate }}
          </button>
          <button
            type="button"
            (click)="setLanguage('VN')"
            [class]="getLanguageButtonClasses('VN')"
          >
            {{ 'header.language.VN' | translate }}
          </button>
        </div>
        <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            (click)="setCurrency('USD')"
            [class]="getCurrencyButtonClasses('USD')"
          >
            $
          </button>
          <button
            type="button"
            (click)="setCurrency('VND')"
            [class]="getCurrencyButtonClasses('VND')"
          >
            đ
          </button>
        </div>
        <div 
          class="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center ring-2 ring-primary/20 cursor-pointer ml-auto" 
          [style.background-image]="'url(' + profileImageUrl + ')'"
          [title]="'header.userProfile' | translate"
        ></div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  @Output() createGroupClicked = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() sidebarCollapsed = false;
  searchValue = '';
  profileImageUrl = 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=300';

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly translationService: TranslationService
  ) {}

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchValue = target.value;
  }

  onCreateGroupClick() {
    this.createGroupClicked.emit();
  }

  setCurrency(currency: AppCurrency): void {
    this.currencyService.setCurrency(currency);
  }

  setLanguage(language: AppLanguage): void {
    this.translationService.setLanguage(language);
  }

  getCurrencyButtonClasses(currency: AppCurrency): string {
    const isActive = this.currencyService.currentCurrency() === currency;
    const baseClasses = 'h-8 min-w-9 rounded-full px-3 text-xs font-bold transition-colors';
    if (isActive) {
      return `${baseClasses} bg-primary text-white`;
    }
    return `${baseClasses} text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700`;
  }

  getLanguageButtonClasses(language: AppLanguage): string {
    const isActive = this.translationService.currentLanguage() === language;
    const baseClasses = 'h-8 min-w-10 rounded-full px-3 text-xs font-bold transition-colors';
    if (isActive) {
      return `${baseClasses} bg-primary text-white`;
    }
    return `${baseClasses} text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700`;
  }
}