import { Injectable } from '@angular/core';
import { ref, set } from 'firebase/database';
import { db } from '../firebase';
import { DataScopeService } from './data-scope.service';
import { GuestStorageService } from './guest-storage.service';

@Injectable({ providedIn: 'root' })
export class GuestSyncService {
  private readonly collections = ['joys', 'friends', 'activities'] as const;

  constructor(
    private readonly dataScopeService: DataScopeService,
    private readonly guestStorageService: GuestStorageService
  ) {}

  hasGuestData(): boolean {
    return this.collections.some((collection) =>
      this.guestStorageService.hasData(this.dataScopeService.getGuestStorageKey(collection))
    );
  }

  async syncGuestDataToCloud(): Promise<void> {
    const uid = this.dataScopeService.getCurrentUid();
    if (!uid) {
      return;
    }

    for (const collection of this.collections) {
      const key = this.dataScopeService.getGuestStorageKey(collection);
      const record = this.guestStorageService.readRecord<unknown>(key);

      if (Object.keys(record).length > 0) {
        await set(ref(db, `users/${uid}/${collection}`), record);
      }

      this.guestStorageService.clearKey(key);
    }
  }
}
