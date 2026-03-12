import { Injectable } from '@angular/core';
import { onValue, push, ref, remove, set, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';
import { Bill, BillCategory, BillStatus, CategoryStyle, StatusStyle } from '../types/bill.interface';

@Injectable({
  providedIn: 'root'
})
export class BillService {
  private readonly billsReference = ref(db, 'bills');

  listenToBills(onBillsChanged: (bills: Bill[]) => void, onError: (error: unknown) => void): Unsubscribe {
    return onValue(
      this.billsReference,
      (snapshot) => {
        console.log('[BillService] snapshot received, exists:', snapshot.exists());
        if (!snapshot.exists()) {
          onBillsChanged([]);
          return;
        }
        const billsData = snapshot.val() as Record<string, unknown>;
        console.log('[BillService] raw data keys:', Object.keys(billsData));
        const bills = Object.entries(billsData).map(([billId, billData]) =>
          this.mapBillDocument(billId, billData as Partial<Omit<Bill, 'id'>>)
        );
        onBillsChanged(bills);
      },
      (error) => {
        console.error('[BillService] Firebase listener error:', error);
        onBillsChanged([]);
        onError(error);
      }
    );
  }

  async addBill(billData: Omit<Bill, 'id'>): Promise<Bill> {
    const billRef = push(this.billsReference);
    const payload = {
      groupName: billData.groupName,
      category: billData.category,
      date: billData.date,
      totalAmount: billData.totalAmount,
      yourShare: billData.yourShare,
      status: billData.status
    };
    await set(billRef, payload);
    return { id: billRef.key ?? crypto.randomUUID(), ...billData };
  }

  async deleteBill(billId: string): Promise<void> {
    await remove(ref(db, `bills/${billId}`));
  }

  private mapBillDocument(id: string, data: Partial<Omit<Bill, 'id'>>): Bill {
    const category = this.toCategory(data.category);
    const status = this.toStatus(data.status);
    const iconInfo = this.getCategoryIcon(category);
    return {
      id,
      groupName: data.groupName ?? 'Unknown Group',
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

  private getCategoryIcon(category: BillCategory): { icon: string; iconBg: string; iconColor: string } {
    const map: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
      'Food':          { icon: 'restaurant',     iconBg: 'bg-amber-100 dark:bg-amber-900/30',   iconColor: 'text-amber-600 dark:text-amber-400' },
      'Dinner':        { icon: 'restaurant',     iconBg: 'bg-amber-100 dark:bg-amber-900/30',   iconColor: 'text-amber-600 dark:text-amber-400' },
      'Transport':     { icon: 'directions_car', iconBg: 'bg-blue-100 dark:bg-blue-900/30',     iconColor: 'text-blue-600 dark:text-blue-400' },
      'Trip':          { icon: 'flight',         iconBg: 'bg-blue-100 dark:bg-blue-900/30',     iconColor: 'text-blue-600 dark:text-blue-400' },
      'Entertainment': { icon: 'movie',          iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400' },
      'Utilities':     { icon: 'bolt',           iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600 dark:text-orange-400' },
      'Rent':          { icon: 'home',           iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
      'Accommodation': { icon: 'hotel',          iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    };
    return map[category] ?? { icon: 'receipt_long', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-600 dark:text-slate-400' };
  }

  private toCategory(category: unknown): BillCategory {
    const valid: BillCategory[] = ['Trip', 'Dinner', 'Rent', 'Others', 'Food', 'Transport', 'Entertainment', 'Utilities', 'Accommodation', 'General'];
    return valid.includes(category as BillCategory) ? (category as BillCategory) : 'Others';
  }

  private toStatus(status: unknown): BillStatus {
    const valid: BillStatus[] = ['Settled', 'Pending', 'paid', 'pending', 'overdue'];
    return valid.includes(status as BillStatus) ? (status as BillStatus) : 'Pending';
  }

  getCategoryStyles(category: BillCategory): CategoryStyle {
    const styles: Record<string, CategoryStyle> = {
      'Food':          { bgColor: 'bg-amber-100',  textColor: 'text-amber-800',  darkBgColor: 'dark:bg-amber-900/30',  darkTextColor: 'dark:text-amber-300' },
      'Dinner':        { bgColor: 'bg-amber-100',  textColor: 'text-amber-800',  darkBgColor: 'dark:bg-amber-900/30',  darkTextColor: 'dark:text-amber-300' },
      'Transport':     { bgColor: 'bg-blue-100',   textColor: 'text-blue-800',   darkBgColor: 'dark:bg-blue-900/30',   darkTextColor: 'dark:text-blue-300' },
      'Trip':          { bgColor: 'bg-blue-100',   textColor: 'text-blue-800',   darkBgColor: 'dark:bg-blue-900/30',   darkTextColor: 'dark:text-blue-300' },
      'Entertainment': { bgColor: 'bg-purple-100', textColor: 'text-purple-800', darkBgColor: 'dark:bg-purple-900/30', darkTextColor: 'dark:text-purple-300' },
      'Utilities':     { bgColor: 'bg-orange-100', textColor: 'text-orange-800', darkBgColor: 'dark:bg-orange-900/30', darkTextColor: 'dark:text-orange-300' },
      'Rent':          { bgColor: 'bg-purple-100', textColor: 'text-purple-800', darkBgColor: 'dark:bg-purple-900/30', darkTextColor: 'dark:text-purple-300' },
      'Accommodation': { bgColor: 'bg-indigo-100', textColor: 'text-indigo-800', darkBgColor: 'dark:bg-indigo-900/30', darkTextColor: 'dark:text-indigo-300' },
      'Others':        { bgColor: 'bg-pink-100',   textColor: 'text-pink-800',   darkBgColor: 'dark:bg-pink-900/30',   darkTextColor: 'dark:text-pink-300' },
      'General':       { bgColor: 'bg-slate-100',  textColor: 'text-slate-700',  darkBgColor: 'dark:bg-slate-800',     darkTextColor: 'dark:text-slate-300' },
    };
    return styles[category] ?? { bgColor: 'bg-slate-100', textColor: 'text-slate-700', darkBgColor: 'dark:bg-slate-800', darkTextColor: 'dark:text-slate-300' };
  }

  getStatusStyles(status: BillStatus): StatusStyle {
    const s = String(status).toLowerCase();
    if (s === 'settled' || s === 'paid') {
      return { textColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500', animate: false };
    }
    if (s === 'overdue') {
      return { textColor: 'text-rose-600 dark:text-rose-400', dotColor: 'bg-rose-500', animate: true };
    }
    return { textColor: 'text-amber-500 dark:text-amber-400', dotColor: 'bg-amber-500', animate: true };
  }
}