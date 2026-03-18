import { Injectable, signal } from '@angular/core';

export type AppCurrency = 'USD' | 'VND' | 'SGD' | 'MYR';

type CurrencyRates = Record<AppCurrency, number>;

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly storageKey = 'app.currency';
  private readonly ratesStorageKey = 'app.currency.rates';
  private readonly currencySignal = signal<AppCurrency>(this.readInitialCurrency());
  private readonly ratesSignal = signal<CurrencyRates>(this.readInitialRates());

  readonly supportedCurrencies: AppCurrency[] = ['USD', 'VND', 'SGD', 'MYR'];

  currentCurrency(): AppCurrency {
    return this.currencySignal();
  }

  getCurrencyRates(): CurrencyRates {
    const currentCurrency = this.currentCurrency();
    return {
      ...this.ratesSignal(),
      [currentCurrency]: 1
    };
  }

  getCurrencyRate(currency: AppCurrency): number {
    return this.getCurrencyRates()[currency] ?? 1;
  }

  setCurrency(currency: AppCurrency): void {
    this.currencySignal.set(currency);
    this.setCurrencyRate(currency, 1);
    try {
      localStorage.setItem(this.storageKey, currency);
    } catch {
      // ignore storage errors
    }
  }

  setCurrencyRate(currency: AppCurrency, rate: number): void {
    const normalizedRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const nextRates: CurrencyRates = {
      ...this.ratesSignal(),
      [currency]: currency === this.currentCurrency() ? 1 : normalizedRate
    };

    this.ratesSignal.set(nextRates);

    try {
      localStorage.setItem(this.ratesStorageKey, JSON.stringify(nextRates));
    } catch {
      // ignore storage errors
    }
  }

  toggleCurrency(): void {
    const currentIndex = this.supportedCurrencies.indexOf(this.currentCurrency());
    const nextCurrency = this.supportedCurrencies[(currentIndex + 1) % this.supportedCurrencies.length] ?? 'USD';
    this.setCurrency(nextCurrency);
  }

  formatAmount(amount: number): string {
    return this.formatByCurrency(amount, this.currentCurrency());
  }

  formatAmountInCurrency(amount: number, currency: AppCurrency): string {
    return this.formatByCurrency(amount, currency);
  }

  formatSignedAmount(amount: number): string {
    let prefix = '';
    if (amount > 0) {
      prefix = '+';
    } else if (amount < 0) {
      prefix = '-';
    }
    return `${prefix}${this.formatAmount(Math.abs(amount))}`;
  }

  formatEditableAmount(amount: number): string {
    return this.formatEditableAmountByCurrency(amount, this.currentCurrency());
  }

  formatEditableAmountByCurrency(amount: number, currency: AppCurrency): string {
    if (!Number.isFinite(amount) || amount <= 0) {
      return '';
    }

    if (currency === 'VND') {
      return new Intl.NumberFormat('de-DE', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
      }).format(Math.round(amount));
    }

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(amount);
  }

  parseEditableAmount(rawValue: string, currency: AppCurrency = this.currentCurrency()): number {
    if (!rawValue.trim()) {
      return 0;
    }

    if (currency === 'VND') {
      const normalized = rawValue.replaceAll(/[^\d]/g, '');
      return normalized ? Number(normalized) : 0;
    }

    const normalized = rawValue.replaceAll(/[^\d.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  usesSuffixSymbol(currency: AppCurrency = this.currentCurrency()): boolean {
    return currency === 'VND' || currency === 'MYR';
  }

  getCurrencySymbol(currency: AppCurrency = this.currentCurrency()): string {
    const symbolMap: Record<AppCurrency, string> = {
      USD: '$',
      VND: 'đ',
      SGD: 'S$',
      MYR: 'MYR'
    };

    return symbolMap[currency];
  }

  convertToSystemCurrency(amount: number, sourceCurrency: AppCurrency): number {
    const numericAmount = Number.isFinite(amount) ? amount : 0;
    const converted = numericAmount * this.getCurrencyRate(sourceCurrency);
    return Number(converted.toFixed(this.currentCurrency() === 'VND' ? 0 : 2));
  }

  /**
   * Convert using a heuristic: if the stored rate is < 1, treat it as
   * an inverted rate and divide; otherwise multiply. This supports
   * mixed rate orientations from external sources.
   */
  convertUsingRateHeuristic(amount: number, sourceCurrency: AppCurrency): number {
    const numericAmount = Number.isFinite(amount) ? amount : 0;
    const rate = this.getCurrencyRate(sourceCurrency);
    if (!Number.isFinite(rate) || rate <= 0) {
      return Number(numericAmount.toFixed(this.currentCurrency() === 'VND' ? 0 : 2));
    }

    const converted = rate < 1 ? numericAmount / rate : numericAmount * rate;
    return Number(converted.toFixed(this.currentCurrency() === 'VND' ? 0 : 2));
  }

  getCurrencyPlaceholder(currency: AppCurrency = this.currentCurrency()): string {
    return currency === 'VND' ? '0' : '0.00';
  }

  private formatByCurrency(amount: number, currency: AppCurrency): string {
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);

    if (currency === 'VND') {
      const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(abs));
      return `${sign}${num} đ`;
    }
    if (currency === 'MYR') {
      const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(abs);
      return `${sign}${num} MYR`;
    }
    if (currency === 'SGD') {
      const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(abs);
      return `${sign}S$ ${num}`;
    }
    // USD
    const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(abs);
    return `${sign}$ ${num}`;
  }

  private readInitialCurrency(): AppCurrency {
    try {
      const savedCurrency = localStorage.getItem(this.storageKey);
      if (savedCurrency === 'USD' || savedCurrency === 'VND' || savedCurrency === 'SGD' || savedCurrency === 'MYR') {
        return savedCurrency as AppCurrency;
      }
      // Migrate old 'RM' persisted value to 'MYR'
      if (savedCurrency === 'RM') {
        return 'MYR';
      }
      return 'VND';
    } catch {
      return 'VND';
    }
  }

  private readInitialRates(): CurrencyRates {
    const defaults: CurrencyRates = {
      USD: 1,
      VND: 1,
      SGD: 1,
      MYR: 1
    };

    try {
      const savedRates = localStorage.getItem(this.ratesStorageKey);
      if (!savedRates) {
        return defaults;
      }

      const parsed = JSON.parse(savedRates) as Partial<Record<string, number>>;
      return {
        USD: Number.isFinite(parsed['USD']) && parsed['USD']! > 0 ? parsed['USD']! : 1,
        VND: Number.isFinite(parsed['VND']) && parsed['VND']! > 0 ? parsed['VND']! : 1,
        SGD: Number.isFinite(parsed['SGD']) && parsed['SGD']! > 0 ? parsed['SGD']! : 1,
        // support old 'RM' key migrating to 'MYR'
        MYR: Number.isFinite(parsed['MYR']) && parsed['MYR']! > 0 ? parsed['MYR']! :
             Number.isFinite(parsed['RM']) && (parsed['RM'] as number) > 0 ? (parsed['RM'] as number) : 1
      };
    } catch {
      return defaults;
    }
  }
}
