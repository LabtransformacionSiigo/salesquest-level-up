import { createContext, useContext, useState, ReactNode } from 'react';
import { Sale, Notification } from '@/types';
import { useSupabaseAuthContext } from './SupabaseAuthContext';
import { useConfig } from './ConfigContext';
import { toast } from '@/hooks/use-toast';

interface SalesContextType {
  sales: Sale[];
  notifications: Notification[];
  registerSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'userName' | 'registeredByName'>) => void;
  getSalesByUser: (userId: string) => Sale[];
  getSalesByTeam: (managerId: string) => Sale[];
  markNotificationAsRead: (id: string) => void;
  unreadNotificationsCount: number;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { profile, updateProfile } = useSupabaseAuthContext();
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
    if (!profile) return;

    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}-${Math.random()}`,
      userName: profile.name,
      registeredByName: profile.name,
      createdAt: new Date()
    };

    setSales(prev => [newSale, ...prev]);

    // Update user XP
    const oldLevel = profile.level;
    const newXP = (profile.xp || 0) + saleData.xpEarned;
    updateProfile({ xp: newXP });

    // Check if level up
    const newLevel = getLevelByXP(newXP);
    if (newLevel && newLevel.level !== oldLevel) {
      addNotification({
        userId: parseInt(profile.id) || 0,
        type: 'LEVEL_UP',
        title: '¡Subiste de nivel!',
        message: `Has alcanzado el nivel ${newLevel.level} ${newLevel.icon}`,
        icon: '🎉'
      });
    }

    // Add sale notification
    addNotification({
      userId: parseInt(profile.id) || 0,
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

  const getSalesByUser = (userId: string) => {
    return sales.filter(sale => String(sale.userId) === userId);
  };

  const getSalesByTeam = (managerId: string) => {
    // In a real app, you'd filter by cellId or managerId
    return sales;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
    );
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

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
