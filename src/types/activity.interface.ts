export type ActivityType =
  | 'navigation'
  | 'create-joy'
  | 'create-group'
  | 'update-group'
  | 'add-expense'
  | 'add-friend'
  | 'update-friend'
  | 'delete-friend'
  | 'change-language'
  | 'change-currency'
  | 'change-theme'
  | 'logout'
  | 'other';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  createdAt: string;
  userId: string;
  userName: string;
  joyId?: string;
  groupId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CreateActivityInput {
  type: ActivityType;
  title: string;
  description: string;
  joyId?: string;
  groupId?: string;
  metadata?: Record<string, string | number | boolean>;
}
