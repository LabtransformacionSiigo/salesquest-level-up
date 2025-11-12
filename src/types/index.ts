export type UserRole = 'EJECUTIVO' | 'GERENTE' | 'ADMINISTRADOR';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  xp?: number;
  level?: string;
  avatar?: string;
  streak?: number;
  shields?: number;
}

export interface Mission {
  id: number;
  title: string;
  description: string;
  xpReward: number;
  deadline: string;
  status: 'active' | 'completed' | 'expired';
  progress: number;
}

export interface Medal {
  id: number;
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
}
