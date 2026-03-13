import { Injectable } from '@angular/core';
import { onValue, push, ref, remove, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { Friend, FriendForm } from '../types/friend.interface';
import { DataScopeService } from './data-scope.service';
import { GuestStorageService } from './guest-storage.service';
import { DirectoryUser, UserDirectoryService } from './user-directory.service';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  constructor(
    private readonly dataScopeService: DataScopeService,
    private readonly guestStorageService: GuestStorageService,
    private readonly userDirectoryService: UserDirectoryService
  ) {}

  private get friendsReference() {
    return ref(db, this.dataScopeService.getScopedPath('friends'));
  }

  listenToFriends(onFriendsChanged: (friends: Friend[]) => void, onError: (error: unknown) => void): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const key = this.dataScopeService.getGuestStorageKey('friends');
      const emitFriends = () => {
        const friendsData = this.guestStorageService.readRecord<Partial<Omit<Friend, 'id'>>>(key);
        onFriendsChanged(this.sortFriends(this.mapFriendsRecord(friendsData)));
      };

      void this.guestStorageService.fakeApiDelay().then(emitFriends).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(key, emitFriends);

      return () => {
        unsubscribeGuest();
      };
    }

    return onValue(
      this.friendsReference,
      (snapshot) => {
        if (!snapshot.exists()) {
          onFriendsChanged([]);
          return;
        }
        const friendsData = snapshot.val() as Record<string, Partial<Omit<Friend, 'id'>>>;
        onFriendsChanged(this.sortFriends(this.mapFriendsRecord(friendsData)));
      },
      (error) => {
        onFriendsChanged([]);
        onError(error);
      }
    );
  }

  listenToDirectoryUsers(
    onUsersChanged: (users: DirectoryUser[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    return this.userDirectoryService.listen(onUsersChanged, onError);
  }

  async addFriend(friendForm: FriendForm): Promise<Friend> {
    const friendPayload = this.normalizeFriendForm(friendForm);

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const key = this.dataScopeService.getGuestStorageKey('friends');
      const current = this.guestStorageService.readRecord<Omit<Friend, 'id'>>(key);
      const id = crypto.randomUUID();
      current[id] = friendPayload;
      this.guestStorageService.writeRecord(key, current);
      return {
        id,
        ...friendPayload
      };
    }

    const friendReference = push(this.friendsReference);

    await set(friendReference, friendPayload);

    return {
      id: friendReference.key ?? crypto.randomUUID(),
      ...friendPayload
    };
  }

  async updateFriend(friendId: string, friendForm: FriendForm): Promise<void> {
    const payload = this.normalizeFriendForm(friendForm);

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const key = this.dataScopeService.getGuestStorageKey('friends');
      const current = this.guestStorageService.readRecord<Omit<Friend, 'id'>>(key);
      current[friendId] = payload;
      this.guestStorageService.writeRecord(key, current);
      return;
    }

    await set(ref(db, `${this.dataScopeService.getScopedPath('friends')}/${friendId}`), payload);
  }

  async deleteFriend(friendId: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const key = this.dataScopeService.getGuestStorageKey('friends');
      const current = this.guestStorageService.readRecord<Omit<Friend, 'id'>>(key);
      delete current[friendId];
      this.guestStorageService.writeRecord(key, current);
      return;
    }

    await remove(ref(db, `${this.dataScopeService.getScopedPath('friends')}/${friendId}`));
  }

  private mapFriendsRecord(friendsData: Record<string, Partial<Omit<Friend, 'id'>>>): Friend[] {
    return Object.entries(friendsData).map(([id, data]) => ({
      id,
      name: data.name ?? 'Unknown Friend',
      email: data.email ?? '',
      phone: data.phone ?? '',
      avatar: data.avatar ?? ''
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
