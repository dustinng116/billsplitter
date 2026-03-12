import { Injectable, signal } from '@angular/core';

export type AppCurrency = 'USD' | 'VND';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly storageKey = 'app.currency';
  private readonly currencySignal = signal<AppCurrency>(this.readInitialCurrency());

  currentCurrency(): AppCurrency {
    return this.currencySignal();
  }

  setCurrency(currency: AppCurrency): void {
    this.currencySignal.set(currency);
    try {
      localStorage.setItem(this.storageKey, currency);
    } catch {
      // ignore storage errors
    }
  }

  toggleCurrency(): void {
    this.setCurrency(this.currentCurrency() === 'USD' ? 'VND' : 'USD');
  }

  formatAmount(amount: number): string {
    if (this.currentCurrency() === 'VND') {
      return this.formatVnd(amount);
    }
    return this.formatUsd(amount);
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
    if (!Number.isFinite(amount) || amount <= 0) {
      return '';
    }

    if (this.currentCurrency() === 'VND') {
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

  parseEditableAmount(rawValue: string): number {
    if (!rawValue.trim()) {
      return 0;
    }

    if (this.currentCurrency() === 'VND') {
      const normalized = rawValue.replaceAll(/[^\d]/g, '');
      return normalized ? Number(normalized) : 0;
    }

    const normalized = rawValue.replaceAll(/[^\d.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  usesSuffixSymbol(): boolean {
    return this.currentCurrency() === 'VND';
  }

  getCurrencySymbol(): string {
    return this.currentCurrency() === 'VND' ? 'đ' : '$';
  }

  private formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private formatVnd(amount: number): string {
    const rounded = Math.round(amount);
    const parts = new Intl.NumberFormat('de-DE', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.abs(rounded));
    return `${rounded < 0 ? '-' : ''}${parts} đ`;
  }

  private readInitialCurrency(): AppCurrency {
    try {
      const savedCurrency = localStorage.getItem(this.storageKey);
      return savedCurrency === 'USD' ? 'USD' : 'VND';
    } catch {
      return 'VND';
    }
  }
}
