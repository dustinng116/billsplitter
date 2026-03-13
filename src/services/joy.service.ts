import { Injectable } from '@angular/core';
import { get, onValue, push, ref, remove, set, update, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { CategoryStyle, Joy, JoyCategory, JoyExpense, JoyGroup, JoyStatus, StatusStyle } from '../types/joy.interface';
import { DataScopeService } from './data-scope.service';
import { GuestStorageService } from './guest-storage.service';

@Injectable({
  providedIn: 'root'
})
export class JoyService {
  constructor(
    private readonly dataScopeService: DataScopeService,
    private readonly guestStorageService: GuestStorageService
  ) {}

  private get joysReference() {
    return ref(db, this.dataScopeService.getScopedPath('joys'));
  }

  private get guestJoysKey(): string {
    return this.dataScopeService.getGuestStorageKey('joys');
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

    return onValue(
      this.joysReference,
      (snapshot) => {
        if (!snapshot.exists()) {
          onJoysChanged([]);
          return;
        }
        const joysData = snapshot.val() as Record<string, unknown>;
        const joys = Object.entries(joysData)
          .map(([joyId, joyData]) => this.mapJoyDocument(joyId, joyData as Partial<Omit<Joy, 'id'>>))
          .sort((a, b) => b.date.localeCompare(a.date));
        onJoysChanged(joys);
      },
      (error) => {
        onJoysChanged([]);
        onError(error);
      }
    );
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

    return onValue(
      ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          onJoyChanged(null);
          return;
        }
        const joyData = snapshot.val() as Partial<Omit<Joy, 'id'>>;
        onJoyChanged(this.mapJoyDocument(joyId, joyData));
      },
      onError
    );
  }

  async addJoy(joyData: Omit<Joy, 'id'>): Promise<Joy> {
    const payload = {
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      totalAmount: joyData.totalAmount,
      yourShare: joyData.yourShare,
      status: joyData.status
    };

    if (this.dataScopeService.isGuest()) {
      await this.guestStorageService.fakeApiDelay();
      const joys = this.readGuestJoysRecord();
      const id = crypto.randomUUID();
      joys[id] = payload;
      this.writeGuestJoysRecord(joys);
      return { id, ...joyData };
    }

    const joyRef = push(this.joysReference);
    await set(joyRef, payload);
    return { id: joyRef.key ?? crypto.randomUUID(), ...joyData };
  }

  async updateJoy(
    joyId: string,
    joyData: Pick<Joy, 'joyName' | 'category' | 'date'>
  ): Promise<Joy> {
    const iconInfo = this.getCategoryIcon(joyData.category);
    const payload = {
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      icon: iconInfo.icon,
      iconBg: iconInfo.iconBg,
      iconColor: iconInfo.iconColor
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

    await update(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}`), payload);

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

    return onValue(
      ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups`),
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

    return onValue(
      ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}`),
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

    const groupRef = push(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups`));
    await set(groupRef, groupData);
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

    await update(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}`), groupData);
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

    return onValue(
      ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}/expenses`),
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

    const expenseRef = push(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}/expenses`));
    await set(expenseRef, { ...expenseData, createdAt });

    const groupRef = ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}`);
    const currentTotal = (await this.getGroupTotalSpent(joyId, groupId)) ?? 0;
    await update(groupRef, { totalSpent: currentTotal + expenseData.amount });

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

    await remove(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}/expenses/${expenseId}`));

    const groupRef = ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}`);
    const currentTotal = (await this.getGroupTotalSpent(joyId, groupId)) ?? 0;
    const nextTotal = Math.max(0, currentTotal - expenseAmount);
    await update(groupRef, { totalSpent: nextTotal });
  }

  private async getGroupTotalSpent(joyId: string, groupId: string): Promise<number | null> {
    if (this.dataScopeService.isGuest()) {
      const joys = this.readGuestJoysRecord();
      const total = joys[joyId]?.groups?.[groupId]?.totalSpent;
      return typeof total === 'number' ? total : 0;
    }

    const snapshot = await get(ref(db, `${this.dataScopeService.getScopedPath('joys')}/${joyId}/groups/${groupId}/totalSpent`));
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

  private mapJoyDocument(id: string, data: Partial<Omit<Joy, 'id'>>): Joy {
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
      iconColor: data.iconColor ?? iconInfo.iconColor
    };
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
