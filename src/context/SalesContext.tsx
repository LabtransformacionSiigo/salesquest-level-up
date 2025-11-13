import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Sale, Notification } from '@/types';
import { useAuth } from './AuthContext';
import { useConfig } from './ConfigContext';
import { toast } from '@/hooks/use-toast';

interface SalesContextType {
  sales: Sale[];
  notifications: Notification[];
  registerSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'userName' | 'registeredByName'>) => void;
  getSalesByUser: (userId: number) => Sale[];
  getSalesByTeam: (managerUser: any) => Sale[];
  markNotificationAsRead: (id: string) => void;
  unreadNotificationsCount: number;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, updateUserXP } = useAuth();
  const { getLevelByXP } = useConfig();

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      read: false,
      createdAt: new Date()
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const registerSale = (saleData: Omit<Sale, 'id' | 'createdAt' | 'userName' | 'registeredByName'>) => {
    if (!user) return;

    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}-${Math.random()}`,
      userName: saleData.userId === user.id ? user.name : 'Usuario', // In real app, fetch user name
      registeredByName: user.name,
      createdAt: new Date()
    };

    setSales(prev => [newSale, ...prev]);

    // Update user XP
    const oldLevel = user.level;
    const newXP = (user.xp || 0) + saleData.xpEarned;
    updateUserXP(saleData.userId, newXP);

    // Check if level up
    const newLevel = getLevelByXP(newXP);
    if (newLevel && newLevel.level !== oldLevel) {
      addNotification({
        userId: saleData.userId,
        type: 'LEVEL_UP',
        title: '¡Subiste de nivel!',
        message: `Has alcanzado el nivel ${newLevel.level} ${newLevel.icon}`,
        icon: '🎉'
      });
    }

    // Add sale notification
    addNotification({
      userId: saleData.userId,
      type: 'SALE_REGISTERED',
      title: 'Nueva venta registrada',
      message: `+${saleData.xpEarned} XP por ${saleData.productName}`,
      icon: '💰'
    });

    toast({
      title: "✅ Venta registrada",
      description: `+${saleData.xpEarned} XP ${saleData.multiplierApplied ? `(multiplicador x${saleData.multiplierApplied} aplicado)` : ''}`,
    });
  };

  const getSalesByUser = (userId: number) => {
    return sales.filter(sale => sale.userId === userId);
  };

  const getSalesByTeam = (managerUser: any) => {
    // In a real app, you'd filter by cellId or managerId
    return sales;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
    );
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read && n.userId === user?.id).length;

  return (
    <SalesContext.Provider
      value={{
        sales,
        notifications,
        registerSale,
        getSalesByUser,
        getSalesByTeam,
        markNotificationAsRead,
        unreadNotificationsCount
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
};