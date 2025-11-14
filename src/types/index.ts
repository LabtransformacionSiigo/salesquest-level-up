export type UserRole = 'EJECUTIVO' | 'GERENTE' | 'ADMINISTRADOR';

export interface ActiveMultiplier {
  type: string;
  multiplier: number;
  expiresAt: Date;
}

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
  activeMultipliers?: ActiveMultiplier[];
  cellId?: string | null;
  managerId?: string | null;
  medals?: UserMedal[];
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
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  criteria: string;
  criteriaParams?: Record<string, any>;
  givesStreakSaver: boolean;
  repeatable: boolean;
  rarity?: 'común' | 'poco común' | 'rara' | 'épica' | 'legendaria';
  active?: boolean;
}

export interface UserMedal {
  medalId: string;
  obtainedAt: Date;
  context?: {
    totalXP: number;
    level: string;
    triggerEvent: string;
  };
}

export interface Sale {
  id: string;
  userId: number;
  userName: string;
  productId: number;
  productName: string;
  quantity: number;
  xpEarned: number;
  multiplierApplied: number | null;
  client: string | null;
  date: Date;
  notes: string | null;
  registeredBy: number;
  registeredByName: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: number;
  type: 'LEVEL_UP' | 'SALE_REGISTERED' | 'MULTIPLIER_ACTIVATED' | 'MEDAL_EARNED' | 'STREAK_MAINTAINED';
  title: string;
  message: string;
  icon: string;
  read: boolean;
  createdAt: Date;
  metadata?: {
    oldLevel?: string;
    newLevel?: string;
    medalId?: string;
    xpEarned?: number;
  };
}
