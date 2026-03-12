export interface Bill {
  id: string;
  groupName: string;
  category: BillCategory;
  date: string;
  totalAmount: number;
  yourShare: number;
  status: BillStatus;
  icon: string;
  iconBg: string;
  iconColor: string;
}

export type BillCategory = 'Trip' | 'Dinner' | 'Rent' | 'Others' | 'Food' | 'Transport' | 'Entertainment' | 'Utilities' | 'Accommodation' | 'General';
export type BillStatus = 'Settled' | 'Pending' | 'paid' | 'pending' | 'overdue';

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