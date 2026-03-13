export interface JoyCreator {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Joy {
  id: string;
  joyName: string;
  category: JoyCategory;
  date: string;
  totalAmount: number;
  yourShare: number;
  status: JoyStatus;
  icon: string;
  iconBg: string;
  iconColor: string;
  createdBy?: JoyCreator;
  coverImage?: string;
}

export type JoyCategory =
  | 'Trip'
  | 'Dinner'
  | 'Rent'
  | 'Others'
  | 'Food'
  | 'Transport'
  | 'Entertainment'
  | 'Utilities'
  | 'Accommodation'
  | 'General';

export type JoyStatus = 'Settled' | 'Pending' | 'paid' | 'pending' | 'overdue';

export interface JoyGroupMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  initials: string;
  avatar?: string;
  shareAmount?: number;
  percentage?: number;
  customAmount?: number;
  isPaid?: boolean;
}

export interface JoyGroup {
  id: string;
  name: string;
  category: string;
  photo: string;
  members: JoyGroupMember[];
  createdAt: string;
  totalSpent: number;
  yourBalance: number;
  balanceType: 'owed' | 'owe' | 'settled';
}

export interface JoyExpense {
  id: string;
  title: string;
  amount: number;
  currency?: string;
  originalAmount?: number;
  conversionRate?: number;
  date: string;
  paidBy: string;
  splitType: 'equally' | 'percentage' | 'custom';
  members: JoyGroupMember[];
  groupId: string;
  createdAt: string;
}

export interface CategoryStyle {
  bgColor: string;
  textColor: string;
  darkBgColor: string;
  darkTextColor: string;
}

export interface StatusStyle {
  textColor: string;
  dotColor: string;
  animate?: boolean;
}
