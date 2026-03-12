import { Injectable } from '@angular/core';
import { onValue, push, ref, remove, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { Friend, FriendForm } from '../types/friend.interface';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private readonly friendsReference = ref(db, 'friends');

  listenToFriends(onFriendsChanged: (friends: Friend[]) => void, onError: (error: unknown) => void): Unsubscribe {
    return onValue(
      this.friendsReference,
      (snapshot) => {
        console.log('[FriendService] snapshot received, exists:', snapshot.exists());
        if (!snapshot.exists()) {
          onFriendsChanged([]);
          return;
        }
        const friendsData = snapshot.val() as Record<string, Partial<Omit<Friend, 'id'>>>;
        console.log('[FriendService] raw data keys:', Object.keys(friendsData));
        onFriendsChanged(this.sortFriends(this.mapFriendsRecord(friendsData)));
      },
      (error) => {
        console.error('[FriendService] Firebase listener error:', error);
        onFriendsChanged([]);
        onError(error);
      }
    );
  }

  async addFriend(friendForm: FriendForm): Promise<Friend> {
    const friendPayload = this.normalizeFriendForm(friendForm);
    const friendReference = push(this.friendsReference);

    await set(friendReference, friendPayload);

    return {
      id: friendReference.key ?? crypto.randomUUID(),
      ...friendPayload
    };
  }

  async updateFriend(friendId: string, friendForm: FriendForm): Promise<void> {
    const payload = this.normalizeFriendForm(friendForm);
    await set(ref(db, `friends/${friendId}`), payload);
  }

  async deleteFriend(friendId: string): Promise<void> {
    await remove(ref(db, `friends/${friendId}`));
  }

  private mapFriendsRecord(friendsData: Record<string, Partial<Omit<Friend, 'id'>>>): Friend[] {
    console.log('[FriendService] Mapping friends record, entries:', Object.entries(friendsData));
    return Object.entries(friendsData).map(([id, data]) => ({
      id,
      name: data.name ?? 'Unknown Friend',
      email: data.email ?? '',
      phone: data.phone ?? ''
    }));
  }

  private normalizeFriendForm(friendForm: FriendForm): Omit<Friend, 'id'> {
    return {
      name: friendForm.name.trim(),
      email: friendForm.email.trim().toLowerCase(),
      phone: friendForm.phone.replaceAll(/\D+/g, '').trim()
    };
  }

  private sortFriends(friends: Friend[]): Friend[] {
    return [...friends].sort((leftFriend, rightFriend) => leftFriend.name.localeCompare(rightFriend.name));
  }
}
