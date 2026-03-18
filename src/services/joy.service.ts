import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { get, onValue, push, ref, remove, set, update, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { CategoryStyle, Joy, JoyCategory, JoyChecklistItem, JoyCreator, JoyDepositEntry, JoyExpense, JoyGroup, JoyStatus, StatusStyle } from '../types/joy.interface';
import { DataScopeService } from './data-scope.service';
import { GuestStorageService } from './guest-storage.service';
import { UserDirectoryService } from './user-directory.service';

interface SharedJoyMembership {
  ownerUid: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class JoyService {
  constructor(
    private readonly dataScopeService: DataScopeService,
    private readonly guestStorageService: GuestStorageService,
    private readonly userDirectoryService: UserDirectoryService
  ) {}

  private get joysReference() {
    return ref(db, this.dataScopeService.getScopedPath('joys'));
  }

  private get guestJoysKey(): string {
    return this.dataScopeService.getGuestStorageKey('joys');
  }

  private get sharedJoysReference() {
    const uid = this.dataScopeService.getCurrentUid();
    return uid ? ref(db, `users/${uid}/sharedJoys`) : null;
  }

  private readGuestJoysRecord(): Record<string, any> {
    return this.guestStorageService.readRecord<any>(this.guestJoysKey);
  }

  private writeGuestJoysRecord(record: Record<string, any>): void {
    this.guestStorageService.writeRecord(this.guestJoysKey, record);
  }

  listenToJoys(onJoysChanged: (joys: Joy[]) => void, onError: (error: unknown) => void): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitJoys = () => {
        const joysData = this.readGuestJoysRecord();
        const joys = Object.entries(joysData)
          .map(([joyId, joyData]) => this.mapJoyDocument(joyId, joyData as Partial<Omit<Joy, 'id'>>))
          .sort((a, b) => b.date.localeCompare(a.date));
        onJoysChanged(joys);
      };

      void this.guestStorageService.fakeApiDelay().then(emitJoys).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitJoys);

      return () => {
        unsubscribeGuest();
      };
    }

    const ownedJoyMap = new Map<string, Joy>();
    const sharedJoyMap = new Map<string, Joy>();
    const sharedJoyUnsubscribers = new Map<string, Unsubscribe>();
    const pendingSharedInitialJoyIds = new Set<string>();
    let ownedResolved = false;
    let sharedMembershipsResolved = false;

    const emitJoys = () => {
      if (!ownedResolved || !sharedMembershipsResolved || pendingSharedInitialJoyIds.size > 0) {
        return;
      }

      const merged = [...ownedJoyMap.values(), ...sharedJoyMap.values()]
        .sort((a, b) => b.date.localeCompare(a.date));
      onJoysChanged(merged);
    };

    const ownedJoysUnsubscribe = onValue(
      this.joysReference,
      (snapshot) => {
        ownedJoyMap.clear();

        if (snapshot.exists()) {
          const joysData = snapshot.val() as Record<string, unknown>;
          Object.entries(joysData).forEach(([joyId, joyData]) => {
            ownedJoyMap.set(joyId, this.mapJoyDocument(joyId, joyData as Partial<Omit<Joy, 'id'>>));
          });
        }

        ownedResolved = true;
        emitJoys();
      },
      (error) => {
        ownedResolved = true;
        onJoysChanged([]);
        onError(error);
      }
    );

    const sharedReference = this.sharedJoysReference;
    if (!sharedReference) {
      sharedMembershipsResolved = true;
      emitJoys();
      return ownedJoysUnsubscribe;
    }

    const sharedMembershipsUnsubscribe = onValue(
      sharedReference,
      (snapshot) => {
        const memberships = snapshot.exists() ? snapshot.val() as Record<string, SharedJoyMembership> : {};
        const activeJoyIds = new Set(Object.keys(memberships));

        Array.from(sharedJoyUnsubscribers.keys()).forEach((joyId) => {
          if (!activeJoyIds.has(joyId)) {
            sharedJoyUnsubscribers.get(joyId)?.();
            sharedJoyUnsubscribers.delete(joyId);
            sharedJoyMap.delete(joyId);
            pendingSharedInitialJoyIds.delete(joyId);
          }
        });

        Object.entries(memberships).forEach(([joyId, membership]) => {
          if (sharedJoyUnsubscribers.has(joyId)) {
            return;
          }

          pendingSharedInitialJoyIds.add(joyId);
          const joyRef = ref(db, `users/${membership.ownerUid}/joys/${joyId}`);
          const unsubscribeSharedJoy = onValue(
            joyRef,
            (joySnapshot) => {
              if (!joySnapshot.exists()) {
                sharedJoyMap.delete(joyId);
                pendingSharedInitialJoyIds.delete(joyId);
                emitJoys();
                return;
              }

              sharedJoyMap.set(
                joyId,
                this.mapJoyDocument(
                  joyId,
                  joySnapshot.val() as Partial<Omit<Joy, 'id'>>,
                  this.toCreatorFromMembership(membership)
                )
              );
              pendingSharedInitialJoyIds.delete(joyId);
              emitJoys();
            },
            (error) => {
              pendingSharedInitialJoyIds.delete(joyId);
              onError(error);
              emitJoys();
            }
          );

          sharedJoyUnsubscribers.set(joyId, unsubscribeSharedJoy);
        });

        sharedMembershipsResolved = true;
        emitJoys();
      },
      (error) => {
        sharedMembershipsResolved = true;
        onError(error);
        emitJoys();
      }
    );

    return () => {
      ownedJoysUnsubscribe();
      sharedMembershipsUnsubscribe();
      sharedJoyUnsubscribers.forEach((unsubscribe) => unsubscribe());
      sharedJoyUnsubscribers.clear();
    };
  }

  listenToJoy(joyId: string, onJoyChanged: (joy: Joy | null) => void, onError: (error: unknown) => void): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitJoy = () => {
        const joys = this.readGuestJoysRecord();
        const joyData = joys[joyId];
        if (!joyData) {
          onJoyChanged(null);
          return;
        }
        onJoyChanged(this.mapJoyDocument(joyId, joyData as Partial<Omit<Joy, 'id'>>));
      };

      void this.guestStorageService.fakeApiDelay().then(emitJoy).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitJoy);

      return () => {
        unsubscribeGuest();
      };
    }

    const currentUid = this.dataScopeService.getCurrentUid();
    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid, membership) => {
        if (disposed) {
          return;
        }

        unsubscribeActive?.();
        unsubscribeActive = null;

        if (!ownerUid) {
          onJoyChanged(null);
          return;
        }

        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}`),
          (snapshot) => {
            if (!snapshot.exists()) {
              onJoyChanged(null);
              return;
            }

            const joyData = snapshot.val() as Partial<Omit<Joy, 'id'>>;
            onJoyChanged(
              this.mapJoyDocument(
                joyId,
                joyData,
                ownerUid !== currentUid && membership ? this.toCreatorFromMembership(membership) : undefined
              )
            );
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  async addJoy(joyData: Omit<Joy, 'id'>): Promise<Joy> {
    const creator = await this.getCurrentCreator();
    const payload = {
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      totalAmount: joyData.totalAmount,
      yourShare: joyData.yourShare,
      status: joyData.status,
      createdBy: creator
    };

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const id = crypto.randomUUID();
      joys[id] = payload;
      this.writeGuestJoysRecord(joys);
      return { id, ...joyData, createdBy: creator };
    }

    const joyRef = push(this.joysReference);
    await set(joyRef, payload);
    return { id: joyRef.key ?? crypto.randomUUID(), ...joyData, createdBy: creator };
  }

  async updateJoy(
    joyId: string,
    joyData: Pick<Joy, 'joyName' | 'category' | 'date' | 'coverImage'>
  ): Promise<Joy> {
    const iconInfo = this.getCategoryIcon(joyData.category);
    const payload = {
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      icon: iconInfo.icon,
      iconBg: iconInfo.iconBg,
      iconColor: iconInfo.iconColor,
      coverImage: joyData.coverImage
    };

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      joys[joyId] = {
        ...(joys[joyId] ?? {}),
        ...payload
      };
      this.writeGuestJoysRecord(joys);

      return {
        id: joyId,
        joyName: joyData.joyName,
        category: joyData.category,
        date: joyData.date,
        totalAmount: 0,
        yourShare: 0,
        status: 'Pending',
        icon: iconInfo.icon,
        iconBg: iconInfo.iconBg,
        iconColor: iconInfo.iconColor
      };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    await update(ref(db, `users/${ownerUid}/joys/${joyId}`), payload);

    return {
      id: joyId,
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      totalAmount: 0,
      yourShare: 0,
      status: 'Pending',
      icon: iconInfo.icon,
      iconBg: iconInfo.iconBg,
      iconColor: iconInfo.iconColor
    };
  }

  async updateJoyCoverImage(joyId: string, coverImage: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      if (joys[joyId]) {
        joys[joyId].coverImage = coverImage;
        this.writeGuestJoysRecord(joys);
      }
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    await update(ref(db, `users/${ownerUid}/joys/${joyId}`), { coverImage });
  }

  async deleteJoy(joyId: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      delete joys[joyId];
      this.writeGuestJoysRecord(joys);
      return;
    }

    await remove(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}`));
  }

  listenToJoyGroups(joyId: string, onGroupsChanged: (groups: JoyGroup[]) => void, onError: (error: unknown) => void): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitGroups = () => {
        const joys = this.readGuestJoysRecord();
        const groupsData = joys[joyId]?.groups as Record<string, Omit<JoyGroup, 'id'>> | undefined;
        if (!groupsData) {
          onGroupsChanged([]);
          return;
        }
        const groups = Object.entries(groupsData)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onGroupsChanged(groups);
      };

      void this.guestStorageService.fakeApiDelay().then(emitGroups).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitGroups);

      return () => {
        unsubscribeGuest();
      };
    }

    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid) => {
        if (disposed) {
          return;
        }

        unsubscribeActive?.();
        unsubscribeActive = null;

        if (!ownerUid) {
          onGroupsChanged([]);
          return;
        }

        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}/groups`),
          (snapshot) => {
            if (!snapshot.exists()) {
              onGroupsChanged([]);
              return;
            }

            const groupsData = snapshot.val() as Record<string, Omit<JoyGroup, 'id'>>;
            const groups = Object.entries(groupsData)
              .map(([id, value]) => ({ id, ...value }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            onGroupsChanged(groups);
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  listenToJoyGroup(
    joyId: string,
    groupId: string,
    onGroupChanged: (group: JoyGroup | null) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitGroup = () => {
        const joys = this.readGuestJoysRecord();
        const groupData = joys[joyId]?.groups?.[groupId] as Omit<JoyGroup, 'id'> | undefined;
        if (!groupData) {
          onGroupChanged(null);
          return;
        }
        onGroupChanged({ id: groupId, ...groupData });
      };

      void this.guestStorageService.fakeApiDelay().then(emitGroup).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitGroup);

      return () => {
        unsubscribeGuest();
      };
    }

    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid) => {
        if (disposed) {
          return;
        }

        unsubscribeActive?.();
        unsubscribeActive = null;

        if (!ownerUid) {
          onGroupChanged(null);
          return;
        }

        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}`),
          (snapshot) => {
            if (!snapshot.exists()) {
              onGroupChanged(null);
              return;
            }

            const groupData = snapshot.val() as Omit<JoyGroup, 'id'>;
            onGroupChanged({ id: groupId, ...groupData });
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  async addGroupToJoy(joyId: string, groupData: Omit<JoyGroup, 'id'>): Promise<JoyGroup> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const joyData = joys[joyId] ?? {};
      const groups = joyData.groups ?? {};
      const id = crypto.randomUUID();
      groups[id] = groupData;
      joyData.groups = groups;
      joys[joyId] = joyData;
      this.writeGuestJoysRecord(joys);
      return { id, ...groupData };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    const groupRef = push(ref(db, `users/${ownerUid}/joys/${joyId}/groups`));
    await set(groupRef, groupData);
    await this.syncSharedJoyAccess(joyId, ownerUid);
    return { id: groupRef.key ?? crypto.randomUUID(), ...groupData };
  }

  async updateJoyGroup(joyId: string, groupId: string, groupData: Omit<JoyGroup, 'id'>): Promise<JoyGroup> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const joyData = joys[joyId] ?? {};
      const groups = joyData.groups ?? {};
      groups[groupId] = {
        ...(groups[groupId] ?? {}),
        ...groupData
      };
      joyData.groups = groups;
      joys[joyId] = joyData;
      this.writeGuestJoysRecord(joys);
      return { id: groupId, ...groupData };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    await update(ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}`), groupData);
    await this.syncSharedJoyAccess(joyId, ownerUid);
    return { id: groupId, ...groupData };
  }

  listenToJoyGroupExpenses(
    joyId: string,
    groupId: string,
    onExpensesChanged: (expenses: JoyExpense[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitExpenses = () => {
        const joys = this.readGuestJoysRecord();
        const expensesData = joys[joyId]?.groups?.[groupId]?.expenses as Record<string, Omit<JoyExpense, 'id'>> | undefined;
        if (!expensesData) {
          onExpensesChanged([]);
          return;
        }
        const expenses = Object.entries(expensesData)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onExpensesChanged(expenses);
      };

      void this.guestStorageService.fakeApiDelay().then(emitExpenses).catch(onError);
      const unsubscribeGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitExpenses);

      return () => {
        unsubscribeGuest();
      };
    }

    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid) => {
        if (disposed) {
          return;
        }

        unsubscribeActive?.();
        unsubscribeActive = null;

        if (!ownerUid) {
          onExpensesChanged([]);
          return;
        }

        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}/expenses`),
          (snapshot) => {
            if (!snapshot.exists()) {
              onExpensesChanged([]);
              return;
            }

            const expensesData = snapshot.val() as Record<string, Omit<JoyExpense, 'id'>>;
            const expenses = Object.entries(expensesData)
              .map(([id, value]) => ({ id, ...value }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            onExpensesChanged(expenses);
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  async addExpenseToJoyGroup(
    joyId: string,
    groupId: string,
    expenseData: Omit<JoyExpense, 'id' | 'createdAt'>
  ): Promise<JoyExpense> {
    const createdAt = new Date().toISOString();

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const joyData = joys[joyId] ?? {};
      const groups = joyData.groups ?? {};
      const group = groups[groupId] ?? {};
      const expenses = group.expenses ?? {};
      const id = crypto.randomUUID();
      expenses[id] = { ...expenseData, createdAt };
      group.expenses = expenses;
      const currentTotal = typeof group.totalSpent === 'number' ? group.totalSpent : 0;
      group.totalSpent = currentTotal + expenseData.amount;
      // When a new expense is added, reset any per-group member isPaid flags
      // so split-bills reflect the new outstanding amounts.
      if (Array.isArray(group.members)) {
        group.members = group.members.map((m: any) => ({ ...(m || {}), isPaid: false }));
      }
      groups[groupId] = group;
      joyData.groups = groups;
      joys[joyId] = joyData;
      this.writeGuestJoysRecord(joys);

      return {
        id,
        ...expenseData,
        createdAt
      };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    const expenseRef = push(ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}/expenses`));
    await set(expenseRef, { ...expenseData, createdAt });

    const groupRef = ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}`);
    const currentTotal = (await this.getGroupTotalSpent(joyId, groupId, ownerUid)) ?? 0;
    await update(groupRef, { totalSpent: currentTotal + expenseData.amount });

    // After creating an expense, clear any persisted `isPaid` flags on the
    // group's members so split-bill rows don't remain marked paid.
    try {
      const membersRef = ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}/members`);
      const membersSnap = await get(membersRef);
      if (membersSnap.exists()) {
        const members = membersSnap.val() as any[];
        if (Array.isArray(members)) {
          const nextMembers = members.map(m => ({ ...(m || {}), isPaid: false }));
          await set(membersRef, nextMembers);
        } else if (members && typeof members === 'object') {
          // If members stored as keyed object, convert each entry
          const nextObj: Record<string, any> = {};
          Object.entries(members).forEach(([k, v]) => {
            nextObj[k] = { ...(v as any), isPaid: false };
          });
          await set(membersRef, nextObj);
        }
      }
    } catch (err) {
      // Non-fatal: log and continue
      console.error('Failed to clear group member isPaid flags after adding expense', err);
    }

    return {
      id: expenseRef.key ?? crypto.randomUUID(),
      ...expenseData,
      createdAt
    };
  }

  async deleteExpenseFromJoyGroup(
    joyId: string,
    groupId: string,
    expenseId: string,
    expenseAmount: number
  ): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const group = joys[joyId]?.groups?.[groupId];
      if (group?.expenses?.[expenseId]) {
        delete group.expenses[expenseId];
      }
      const currentTotal = typeof group?.totalSpent === 'number' ? group.totalSpent : 0;
      const nextTotal = Math.max(0, currentTotal - expenseAmount);
      if (group) {
        group.totalSpent = nextTotal;
      }
      this.writeGuestJoysRecord(joys);
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    await remove(ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}/expenses/${expenseId}`));

    const groupRef = ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}`);
    const currentTotal = (await this.getGroupTotalSpent(joyId, groupId, ownerUid)) ?? 0;
    const nextTotal = Math.max(0, currentTotal - expenseAmount);
    await update(groupRef, { totalSpent: nextTotal });
  }

  async updateExpenseMembers(
    joyId: string,
    groupId: string,
    expenseId: string,
    members: import('../types/joy.interface').JoyGroupMember[]
  ): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const expense = joys[joyId]?.groups?.[groupId]?.expenses?.[expenseId];
      if (expense) {
        expense.members = members;
        this.writeGuestJoysRecord(joys);
      }
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) throw new Error('Joy not found');
    await set(
      ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}/expenses/${expenseId}/members`),
      members
    );
  }

  async deleteJoyGroup(joyId: string, groupId: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      if (joys[joyId]?.groups?.[groupId]) {
        delete joys[joyId].groups[groupId];
      }
      this.writeGuestJoysRecord(joys);
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) {
      throw new Error('Joy not found');
    }

    await remove(ref(db, `users/${ownerUid}/joys/${joyId}/groups/${groupId}`));
    await this.syncSharedJoyAccess(joyId, ownerUid);
  }

  private async getGroupTotalSpent(joyId: string, groupId: string, ownerUid?: string): Promise<number | null> {
    if (this.dataScopeService.isGuest()) {
      const joys = this.readGuestJoysRecord();
      const total = joys[joyId]?.groups?.[groupId]?.totalSpent;
      return typeof total === 'number' ? total : 0;
    }

    const resolvedOwnerUid = ownerUid ?? await this.resolveJoyOwnerUid(joyId);
    if (!resolvedOwnerUid) {
      return 0;
    }

    const snapshot = await get(ref(db, `users/${resolvedOwnerUid}/joys/${joyId}/groups/${groupId}/totalSpent`));
    return typeof snapshot.val() === 'number' ? snapshot.val() : 0;
  }

  getCategoryStyles(category: JoyCategory): CategoryStyle {
    const styles: Record<string, CategoryStyle> = {
      Food: { bgColor: 'bg-amber-100', textColor: 'text-amber-800', darkBgColor: 'dark:bg-amber-900/30', darkTextColor: 'dark:text-amber-300' },
      Dinner: { bgColor: 'bg-amber-100', textColor: 'text-amber-800', darkBgColor: 'dark:bg-amber-900/30', darkTextColor: 'dark:text-amber-300' },
      Transport: { bgColor: 'bg-blue-100', textColor: 'text-blue-800', darkBgColor: 'dark:bg-blue-900/30', darkTextColor: 'dark:text-blue-300' },
      Trip: { bgColor: 'bg-blue-100', textColor: 'text-blue-800', darkBgColor: 'dark:bg-blue-900/30', darkTextColor: 'dark:text-blue-300' },
      Entertainment: { bgColor: 'bg-purple-100', textColor: 'text-purple-800', darkBgColor: 'dark:bg-purple-900/30', darkTextColor: 'dark:text-purple-300' },
      Utilities: { bgColor: 'bg-orange-100', textColor: 'text-orange-800', darkBgColor: 'dark:bg-orange-900/30', darkTextColor: 'dark:text-orange-300' },
      Rent: { bgColor: 'bg-purple-100', textColor: 'text-purple-800', darkBgColor: 'dark:bg-purple-900/30', darkTextColor: 'dark:text-purple-300' },
      Accommodation: { bgColor: 'bg-indigo-100', textColor: 'text-indigo-800', darkBgColor: 'dark:bg-indigo-900/30', darkTextColor: 'dark:text-indigo-300' },
      Others: { bgColor: 'bg-pink-100', textColor: 'text-pink-800', darkBgColor: 'dark:bg-pink-900/30', darkTextColor: 'dark:text-pink-300' },
      General: { bgColor: 'bg-slate-100', textColor: 'text-slate-700', darkBgColor: 'dark:bg-slate-800', darkTextColor: 'dark:text-slate-300' }
    };
    return styles[category] ?? { bgColor: 'bg-slate-100', textColor: 'text-slate-700', darkBgColor: 'dark:bg-slate-800', darkTextColor: 'dark:text-slate-300' };
  }

  getStatusStyles(status: JoyStatus): StatusStyle {
    const s = String(status).toLowerCase();
    if (s === 'settled' || s === 'paid') {
      return { textColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500', animate: false };
    }
    if (s === 'overdue') {
      return { textColor: 'text-rose-600 dark:text-rose-400', dotColor: 'bg-rose-500', animate: true };
    }
    return { textColor: 'text-amber-500 dark:text-amber-400', dotColor: 'bg-amber-500', animate: true };
  }

  private mapJoyDocument(id: string, data: Partial<Omit<Joy, 'id'>>, fallbackCreator?: JoyCreator): Joy {
    const category = this.toCategory(data.category);
    const status = this.toStatus(data.status);
    const iconInfo = this.getCategoryIcon(category);
    return {
      id,
      joyName: data.joyName ?? 'Untitled Joy',
      category,
      date: data.date ?? '',
      totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
      yourShare: typeof data.yourShare === 'number' ? data.yourShare : 0,
      status,
      icon: data.icon ?? iconInfo.icon,
      iconBg: data.iconBg ?? iconInfo.iconBg,
      iconColor: data.iconColor ?? iconInfo.iconColor,
      createdBy: this.toCreator(data.createdBy) ?? fallbackCreator,
      coverImage: data.coverImage
    };
  }

  private toCreator(value: unknown): JoyCreator | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const candidate = value as Partial<JoyCreator>;
    if (!candidate.uid || !candidate.name) {
      return undefined;
    }

    return {
      uid: String(candidate.uid),
      name: String(candidate.name),
      email: String(candidate.email ?? ''),
      avatar: candidate.avatar ? String(candidate.avatar) : undefined
    };
  }

  private toCreatorFromMembership(membership: SharedJoyMembership): JoyCreator {
    return {
      uid: membership.ownerUid,
      name: membership.ownerName || membership.ownerEmail || 'User',
      email: membership.ownerEmail || '',
      avatar: membership.ownerAvatar || undefined
    };
  }

  private async resolveJoyOwnerUid(joyId: string): Promise<string | null> {
    const currentUid = this.dataScopeService.getCurrentUid();
    if (!currentUid) {
      return null;
    }

    const ownSnapshot = await get(ref(db, `users/${currentUid}/joys/${joyId}`));
    if (ownSnapshot.exists()) {
      return currentUid;
    }

    const sharedSnapshot = await get(ref(db, `users/${currentUid}/sharedJoys/${joyId}`));
    const sharedMembership = sharedSnapshot.exists() ? sharedSnapshot.val() as Partial<SharedJoyMembership> : null;
    if (typeof sharedMembership?.ownerUid === 'string' && sharedMembership.ownerUid.trim()) {
      return sharedMembership.ownerUid;
    }

    return new Promise<string | null>((resolve, reject) => {
      let settled = false;
      let unsubscribeOwnerWatcher: Unsubscribe | null = null;

      const settle = (value: string | null) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        unsubscribeOwnerWatcher?.();
        resolve(value);
      };

      const timeoutId = window.setTimeout(() => settle(null), 500);

      unsubscribeOwnerWatcher = this.listenToJoyOwnerUid(
        joyId,
        (ownerUid) => {
          if (ownerUid) {
            settle(ownerUid);
          }
        },
        (error) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeoutId);
          unsubscribeOwnerWatcher?.();
          reject(error);
        }
      );
    });
  }

  private listenToJoyOwnerUid(
    joyId: string,
    onOwnerChanged: (ownerUid: string | null, membership?: SharedJoyMembership) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    const currentUid = this.dataScopeService.getCurrentUid();
    if (!currentUid) {
      onOwnerChanged(null);
      return () => {};
    }

    let ownResolved = false;
    let ownExists = false;
    let sharedResolved = false;
    let sharedOwnerUid: string | null = null;
    let sharedMembership: SharedJoyMembership | undefined;

    const emitOwner = () => {
      if (!ownResolved || !sharedResolved) {
        return;
      }

      if (ownExists) {
        onOwnerChanged(currentUid);
        return;
      }

      onOwnerChanged(sharedOwnerUid, sharedMembership);
    };

    const ownUnsubscribe = onValue(
      ref(db, `users/${currentUid}/joys/${joyId}`),
      (snapshot) => {
        ownExists = snapshot.exists();
        ownResolved = true;
        emitOwner();
      },
      onError
    );

    const sharedUnsubscribe = onValue(
      ref(db, `users/${currentUid}/sharedJoys/${joyId}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          sharedOwnerUid = null;
          sharedMembership = undefined;
          sharedResolved = true;
          emitOwner();
          return;
        }

        const membership = snapshot.val() as Partial<SharedJoyMembership>;
        sharedOwnerUid = typeof membership.ownerUid === 'string' && membership.ownerUid.trim()
          ? membership.ownerUid
          : null;
        sharedMembership = sharedOwnerUid
          ? {
              ownerUid: sharedOwnerUid,
              ownerName: membership.ownerName,
              ownerEmail: membership.ownerEmail,
              ownerAvatar: membership.ownerAvatar
            }
          : undefined;
        sharedResolved = true;
        emitOwner();
      },
      onError
    );

    return () => {
      ownUnsubscribe();
      sharedUnsubscribe();
    };
  }

  private async getCurrentCreator(): Promise<JoyCreator> {
    const currentUser = getAuth().currentUser;
    const currentUid = this.dataScopeService.getCurrentUid();

    if (!currentUser || !currentUid) {
      return {
        uid: 'guest-user',
        name: 'Guest',
        email: '',
        avatar: undefined
      };
    }

    const directoryUser = await this.userDirectoryService.getUserByUid(currentUid);

    return {
      uid: currentUid,
      name: directoryUser?.displayName || currentUser.displayName || currentUser.email || 'User',
      email: directoryUser?.email || currentUser.email || '',
      avatar: directoryUser?.avatar || currentUser.photoURL || undefined
    };
  }

  private async syncSharedJoyAccess(joyId: string, ownerUid: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      return;
    }

    const groupsSnapshot = await get(ref(db, `users/${ownerUid}/joys/${joyId}/groups`));
    const groupsData = groupsSnapshot.exists() ? groupsSnapshot.val() as Record<string, JoyGroup> : {};
    const sharedUsers = await this.resolveSharedUsersFromGroups(groupsData, ownerUid);
    const sharedWithRef = ref(db, `users/${ownerUid}/joys/${joyId}/sharedWith`);
    const previousSnapshot = await get(sharedWithRef);
    const previousSharedWith = previousSnapshot.exists() ? previousSnapshot.val() as Record<string, true> : {};
    const nextSharedWith: Record<string, true> = {};
    const ownerMetadata = await this.userDirectoryService.getUserByUid(ownerUid);
    const membershipPayload: SharedJoyMembership = {
      ownerUid,
      ownerName: ownerMetadata?.displayName,
      ownerEmail: ownerMetadata?.email,
      ownerAvatar: ownerMetadata?.avatar
    };

    for (const user of sharedUsers) {
      nextSharedWith[user.uid] = true;
      await set(ref(db, `users/${user.uid}/sharedJoys/${joyId}`), membershipPayload);
    }

    for (const previousUid of Object.keys(previousSharedWith)) {
      if (!nextSharedWith[previousUid]) {
        await remove(ref(db, `users/${previousUid}/sharedJoys/${joyId}`));
      }
    }

    if (Object.keys(nextSharedWith).length === 0) {
      await remove(sharedWithRef);
      return;
    }

    await set(sharedWithRef, nextSharedWith);
  }

  private async resolveSharedUsersFromGroups(groupsData: Record<string, JoyGroup>, ownerUid: string) {
    const emails = new Set<string>();
    Object.values(groupsData).forEach((group) => {
      (group.members ?? []).forEach((member) => {
        const normalizedEmail = member.email?.trim().toLowerCase();
        if (normalizedEmail) {
          emails.add(normalizedEmail);
        }
      });
    });

    const directoryUsers = await this.userDirectoryService.getAllUsers();
    return directoryUsers.filter((user) => emails.has(user.email.trim().toLowerCase()) && user.uid !== ownerUid);
  }
  // ── Checklist / To-do ──────────────────────────────────────────────────────

  listenToJoyChecklist(
    joyId: string,
    onChanged: (items: JoyChecklistItem[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitItems = () => {
        const joys = this.readGuestJoysRecord();
        const checklistData = joys[joyId]?.checklist as Record<string, Omit<JoyChecklistItem, 'id'>> | undefined;
        if (!checklistData) { onChanged([]); return; }
        const items = Object.entries(checklistData)
          .map(([id, value]) => ({ id, ...value } as JoyChecklistItem))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        onChanged(items);
      };
      void this.guestStorageService.fakeApiDelay().then(emitItems).catch(onError);
      const unsubGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitItems);
      return () => unsubGuest();
    }

    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid) => {
        if (disposed) return;
        unsubscribeActive?.();
        unsubscribeActive = null;
        if (!ownerUid) { onChanged([]); return; }
        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}/checklist`),
          (snapshot) => {
            if (!snapshot.exists()) { onChanged([]); return; }
            const data = snapshot.val() as Record<string, Omit<JoyChecklistItem, 'id'>>;
            const items = Object.entries(data)
              .map(([id, value]) => ({ id, ...value } as JoyChecklistItem))
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            onChanged(items);
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  async addChecklistItem(joyId: string, text: string): Promise<JoyChecklistItem> {
    const createdAt = new Date().toISOString();
    const item: Omit<JoyChecklistItem, 'id'> = { text: text.trim(), checked: false, createdAt };

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const joyData = joys[joyId] ?? {};
      const checklist = joyData.checklist ?? {};
      const id = crypto.randomUUID();
      checklist[id] = item;
      joyData.checklist = checklist;
      joys[joyId] = joyData;
      this.writeGuestJoysRecord(joys);
      return { id, ...item };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) throw new Error('Joy not found');
    const itemRef = push(ref(db, `users/${ownerUid}/joys/${joyId}/checklist`));
    await set(itemRef, item);
    return { id: itemRef.key ?? crypto.randomUUID(), ...item };
  }

  async updateChecklistItem(
    joyId: string,
    itemId: string,
    updates: Partial<Pick<JoyChecklistItem, 'text' | 'checked'>>
  ): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const existing = joys[joyId]?.checklist?.[itemId];
      if (existing) {
        joys[joyId].checklist[itemId] = { ...existing, ...updates };
        this.writeGuestJoysRecord(joys);
      }
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) throw new Error('Joy not found');
    await update(ref(db, `users/${ownerUid}/joys/${joyId}/checklist/${itemId}`), updates);
  }

  async deleteChecklistItem(joyId: string, itemId: string): Promise<void> {
    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      if (joys[joyId]?.checklist?.[itemId]) {
        delete joys[joyId].checklist[itemId];
        this.writeGuestJoysRecord(joys);
      }
      return;
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) throw new Error('Joy not found');
    await remove(ref(db, `users/${ownerUid}/joys/${joyId}/checklist/${itemId}`));
  }

  listenToJoyDepositEntries(
    joyId: string,
    onChanged: (entries: JoyDepositEntry[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    if (this.dataScopeService.isGuest()) {
      const emitEntries = () => {
        const joys = this.readGuestJoysRecord();
        const depositsData = joys[joyId]?.deposits as Record<string, Omit<JoyDepositEntry, 'id'>> | undefined;
        if (!depositsData) { onChanged([]); return; }
        const entries = Object.entries(depositsData)
          .map(([id, value]) => ({ id, ...value } as JoyDepositEntry))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        onChanged(entries);
      };
      void this.guestStorageService.fakeApiDelay().then(emitEntries).catch(onError);
      const unsubGuest = this.guestStorageService.subscribeKey(this.guestJoysKey, emitEntries);
      return () => unsubGuest();
    }

    let unsubscribeOwner: Unsubscribe | null = null;
    let unsubscribeActive: Unsubscribe | null = null;
    let disposed = false;

    unsubscribeOwner = this.listenToJoyOwnerUid(
      joyId,
      (ownerUid) => {
        if (disposed) return;
        unsubscribeActive?.();
        unsubscribeActive = null;
        if (!ownerUid) { onChanged([]); return; }
        unsubscribeActive = onValue(
          ref(db, `users/${ownerUid}/joys/${joyId}/deposits`),
          (snapshot) => {
            if (!snapshot.exists()) { onChanged([]); return; }
            const data = snapshot.val() as Record<string, Omit<JoyDepositEntry, 'id'>>;
            const entries = Object.entries(data)
              .map(([id, value]) => ({ id, ...value } as JoyDepositEntry))
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            onChanged(entries);
          },
          onError
        );
      },
      onError
    );

    return () => {
      disposed = true;
      unsubscribeOwner?.();
      unsubscribeActive?.();
    };
  }

  async addJoyDepositEntry(
    joyId: string,
    entry: Omit<JoyDepositEntry, 'id' | 'createdAt'>
  ): Promise<JoyDepositEntry> {
    const createdAt = new Date().toISOString();
    const payload: Omit<JoyDepositEntry, 'id'> = { ...entry, createdAt };

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const joyData = joys[joyId] ?? {};
      const deposits = joyData.deposits ?? {};
      const id = crypto.randomUUID();
      deposits[id] = payload;
      joyData.deposits = deposits;
      joys[joyId] = joyData;
      this.writeGuestJoysRecord(joys);
      return { id, ...payload };
    }

    const ownerUid = await this.resolveJoyOwnerUid(joyId);
    if (!ownerUid) throw new Error('Joy not found');
    const depositRef = push(ref(db, `users/${ownerUid}/joys/${joyId}/deposits`));
    await set(depositRef, payload);
    return { id: depositRef.key ?? crypto.randomUUID(), ...payload };
  }

  private toCategory(category: unknown): JoyCategory {
    const valid: JoyCategory[] = ['Trip', 'Dinner', 'Rent', 'Others', 'Food', 'Transport', 'Entertainment', 'Utilities', 'Accommodation', 'General'];
    return valid.includes(category as JoyCategory) ? (category as JoyCategory) : 'Others';
  }

  private toStatus(status: unknown): JoyStatus {
    const valid: JoyStatus[] = ['Settled', 'Pending', 'paid', 'pending', 'overdue'];
    return valid.includes(status as JoyStatus) ? (status as JoyStatus) : 'Pending';
  }

  private getCategoryIcon(category: JoyCategory): { icon: string; iconBg: string; iconColor: string } {
    const map: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
      Food: { icon: 'restaurant', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
      Dinner: { icon: 'restaurant', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
      Transport: { icon: 'directions_car', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      Trip: { icon: 'flight', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      Entertainment: { icon: 'movie', iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400' },
      Utilities: { icon: 'bolt', iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600 dark:text-orange-400' },
      Rent: { icon: 'home', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
      Accommodation: { icon: 'hotel', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' }
    };
    return map[category] ?? { icon: 'auto_awesome', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-600 dark:text-slate-400' };
  }
}
