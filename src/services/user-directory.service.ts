import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database';
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

  async getAllUsers(): Promise<DirectoryUser[]> {
    const snapshot = await get(this.directoryRef);
    if (!snapshot.exists()) {
      return [];
    }

    const data = snapshot.val() as Record<string, DirectoryUser>;
    return Object.values(data);
  }

  async getUserByEmail(email: string): Promise<DirectoryUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const users = await this.getAllUsers();
    return users.find((user) => user.email.trim().toLowerCase() === normalizedEmail) ?? null;
  }

  async getUserByUid(uid: string): Promise<DirectoryUser | null> {
    if (!uid.trim()) {
      return null;
    }

    const snapshot = await get(ref(db, `userDirectory/${uid}`));
    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as DirectoryUser;
  }
}
