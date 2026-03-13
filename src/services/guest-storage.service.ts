import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GuestStorageService {
  private readonly keyListeners = new Map<string, Set<() => void>>();

  async fakeApiDelay(minMs = 500, maxMs = 1000): Promise<void> {
    const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  readRecord<T>(key: string): Record<string, T> {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, T>) : {};
    } catch {
      return {};
    }
  }

  writeRecord<T>(key: string, value: Record<string, T>): void {
    localStorage.setItem(key, JSON.stringify(value));
    this.emitKeyChange(key);
  }

  clearKey(key: string): void {
    localStorage.removeItem(key);
    this.emitKeyChange(key);
  }

  hasData(key: string): boolean {
    const raw = localStorage.getItem(key);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  }

  subscribeKey(key: string, callback: () => void): () => void {
    const listeners = this.keyListeners.get(key) ?? new Set<() => void>();
    listeners.add(callback);
    this.keyListeners.set(key, listeners);

    return () => {
      const current = this.keyListeners.get(key);
      if (!current) {
        return;
      }

      current.delete(callback);
      if (current.size === 0) {
        this.keyListeners.delete(key);
      }
    };
  }

  private emitKeyChange(key: string): void {
    const listeners = this.keyListeners.get(key);
    if (!listeners || listeners.size === 0) {
      return;
    }

    listeners.forEach((listener) => {
      listener();
    });
  }
}
