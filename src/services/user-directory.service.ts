import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';

export interface DirectoryUser {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  avatar: string;
  lastSeenAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly directoryRef = ref(db, 'userDirectory');

  async upsertCurrentUser(user: User): Promise<void> {
    const payload: DirectoryUser = {
      uid: user.uid,
      displayName: user.displayName ?? user.email ?? 'User',
      email: user.email ?? '',
      phone: user.phoneNumber ?? '',
      avatar: user.photoURL ?? '',
      lastSeenAt: new Date().toISOString()
    };

    await set(ref(db, `userDirectory/${user.uid}`), payload);
  }

  listen(onChanged: (users: DirectoryUser[]) => void, onError: (error: unknown) => void): Unsubscribe {
    return onValue(
      this.directoryRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onChanged([]);
          return;
        }

        const data = snapshot.val() as Record<string, DirectoryUser>;
        onChanged(Object.values(data));
      },
      onError
    );
  }
}
