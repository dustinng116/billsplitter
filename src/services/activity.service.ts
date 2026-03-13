import { Injectable } from '@angular/core';
import { onValue, push, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { ActivityLog, CreateActivityInput } from '../types/activity.interface';
import { DataScopeService } from './data-scope.service';
import { GuestStorageService } from './guest-storage.service';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  constructor(
    private readonly dataScopeService: DataScopeService,
    private readonly guestStorageService: GuestStorageService
  ) {}

  private get activitiesReference() {
    return ref(db, this.dataScopeService.getScopedPath('activities'));
  }

  private get currentUserId() {
    return this.dataScopeService.getCurrentUid() ?? 'guest-user';
  }

  private readonly currentUserName = 'You';

  listenToActivities(onChanged: (activities: ActivityLog[]) => void, onError: (error: unknown) => void): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const key = this.dataScopeService.getGuestStorageKey('activities');
      const emitActivities = () => {
        const activitiesData = this.guestStorageService.readRecord<Omit<ActivityLog, 'id'>>(key);
        const activities = Object.entries(activitiesData)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onChanged(activities);
      };

      void this.guestStorageService.fakeApiDelay().then(emitActivities).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(key, emitActivities);

      return () => {
        unsubscribeGuest();
      };
    }

    return onValue(
      this.activitiesReference,
      (snapshot) => {
        if (!snapshot.exists()) {
          onChanged([]);
          return;
        }

        const activitiesData = snapshot.val() as Record<string, Omit<ActivityLog, 'id'>>;
        const activities = Object.entries(activitiesData)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onChanged(activities);
      },
      onError
    );
  }

  async logActivity(input: CreateActivityInput): Promise<ActivityLog> {
    const createdAt = new Date().toISOString();

    const payload: Omit<ActivityLog, 'id'> = {
      type: input.type,
      title: input.title,
      description: input.description,
      createdAt,
      userId: this.currentUserId,
      userName: this.currentUserName,
      metadata: input.metadata ?? {}
    };

    if (input.joyId) {
      payload.joyId = input.joyId;
    }

    if (input.groupId) {
      payload.groupId = input.groupId;
    }

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const key = this.dataScopeService.getGuestStorageKey('activities');
      const current = this.guestStorageService.readRecord<Omit<ActivityLog, 'id'>>(key);
      const id = crypto.randomUUID();
      current[id] = payload;
      this.guestStorageService.writeRecord(key, current);
      return { id, ...payload };
    }

    const activityRef = push(this.activitiesReference);

    await set(activityRef, payload);
    return { id: activityRef.key ?? crypto.randomUUID(), ...payload };
  }
}
