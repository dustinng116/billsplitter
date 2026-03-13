import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class DataScopeService {
  private readonly guestPrefix = 'joys-splitter:guest';

  getCurrentUid(): string | null {
    return getAuth().currentUser?.uid ?? null;
  }

  isGuest(): boolean {
    return !this.getCurrentUid();
  }

  getScopedPath(collection: string): string {
    const uid = this.getCurrentUid();
    if (!uid) {
      throw new Error('No authenticated user for scoped Firebase path');
    }
    return `users/${uid}/${collection}`;
  }

  getGuestStorageKey(collection: string): string {
    return `${this.guestPrefix}:${collection}`;
  }
}
