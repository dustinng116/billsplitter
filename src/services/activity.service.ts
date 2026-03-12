import { Injectable } from '@angular/core';
import { onValue, push, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { ActivityLog, CreateActivityInput } from '../types/activity.interface';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly activitiesReference = ref(db, 'activities');
  private readonly currentUserId = 'current-user';
  private readonly currentUserName = 'You';

  listenToActivities(onChanged: (activities: ActivityLog[]) => void, onError: (error: unknown) => void): Unsubscribe {
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
    const activityRef = push(this.activitiesReference);

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

    await set(activityRef, payload);
    return { id: activityRef.key ?? crypto.randomUUID(), ...payload };
  }
}
