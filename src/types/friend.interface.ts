export interface Friend {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

export interface FriendForm {
  name: string;
  email: string;
  phone: string;
}
