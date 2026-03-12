import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'splitbills_theme_mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>(this.getInitialMode());
  private readonly mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.applyTheme(this.modeSignal());
    this.mediaQuery.addEventListener('change', () => {
      if (this.modeSignal() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  currentMode(): ThemeMode {
    return this.modeSignal();
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.applyTheme(mode);
  }

  isDarkActive(): boolean {
    if (this.modeSignal() === 'dark') return true;
    if (this.modeSignal() === 'light') return false;
    return this.mediaQuery.matches;
  }

  private applyTheme(mode: ThemeMode): void {
    const useDark = mode === 'dark' || (mode === 'system' && this.mediaQuery.matches);
    const root = document.documentElement;

    root.classList.add('transition-colors', 'duration-300');
    document.body.classList.add('transition-colors', 'duration-300');

    if (useDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }

  private getInitialMode(): ThemeMode {
    const savedMode = localStorage.getItem(STORAGE_KEY);
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
      return savedMode;
    }
    return 'system';
  }
}
