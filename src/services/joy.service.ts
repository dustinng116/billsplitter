import { Injectable } from '@angular/core';
import { get, onValue, push, ref, remove, set, update, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { CategoryStyle, Joy, JoyCategory, JoyExpense, JoyGroup, JoyStatus, StatusStyle } from '../types/joy.interface';

@Injectable({
  providedIn: 'root'
})
export class JoyService {
  private readonly joysReference = ref(db, 'joys');

  listenToJoys(onJoysChanged: (joys: Joy[]) => void, onError: (error: unknown) => void): Unsubscribe {
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
    return onValue(
      ref(db, `joys/${joyId}`),
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
    const joyRef = push(this.joysReference);
    const payload = {
      joyName: joyData.joyName,
      category: joyData.category,
      date: joyData.date,
      totalAmount: joyData.totalAmount,
      yourShare: joyData.yourShare,
      status: joyData.status
    };
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

    await update(ref(db, `joys/${joyId}`), payload);

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
    await remove(ref(db, `joys/${joyId}`));
  }

  listenToJoyGroups(joyId: string, onGroupsChanged: (groups: JoyGroup[]) => void, onError: (error: unknown) => void): Unsubscribe {
    return onValue(
      ref(db, `joys/${joyId}/groups`),
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
    return onValue(
      ref(db, `joys/${joyId}/groups/${groupId}`),
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
    const groupRef = push(ref(db, `joys/${joyId}/groups`));
    await set(groupRef, groupData);
    return { id: groupRef.key ?? crypto.randomUUID(), ...groupData };
  }

  async updateJoyGroup(joyId: string, groupId: string, groupData: Omit<JoyGroup, 'id'>): Promise<JoyGroup> {
    await update(ref(db, `joys/${joyId}/groups/${groupId}`), groupData);
    return { id: groupId, ...groupData };
  }

  listenToJoyGroupExpenses(
    joyId: string,
    groupId: string,
    onExpensesChanged: (expenses: JoyExpense[]) => void,
    onError: (error: unknown) => void
  ): Unsubscribe {
    return onValue(
      ref(db, `joys/${joyId}/groups/${groupId}/expenses`),
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
    const expenseRef = push(ref(db, `joys/${joyId}/groups/${groupId}/expenses`));
    await set(expenseRef, { ...expenseData, createdAt });

    const groupRef = ref(db, `joys/${joyId}/groups/${groupId}`);
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
    await remove(ref(db, `joys/${joyId}/groups/${groupId}/expenses/${expenseId}`));

    const groupRef = ref(db, `joys/${joyId}/groups/${groupId}`);
    const currentTotal = (await this.getGroupTotalSpent(joyId, groupId)) ?? 0;
    const nextTotal = Math.max(0, currentTotal - expenseAmount);
    await update(groupRef, { totalSpent: nextTotal });
  }

  private async getGroupTotalSpent(joyId: string, groupId: string): Promise<number | null> {
    const snapshot = await get(ref(db, `joys/${joyId}/groups/${groupId}/totalSpent`));
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
