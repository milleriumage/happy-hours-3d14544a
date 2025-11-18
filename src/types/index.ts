export interface User {
  id: string;
  username: string;
  avatarImage: string;
}

export interface RoomUser {
  id: string;
  username: string;
  avatarImage?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string;
  currentUsers?: number;
  users?: RoomUser[];
  host?: RoomUser;
  privacy?: string;
  rating?: string;
}

export interface Session {
  user: User;
  token: string;
}

export interface AuthContextType {
  session: Session | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}
