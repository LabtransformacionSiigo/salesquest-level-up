import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Product {
  id: string;
  name: string;
  xp: number;
  category: string;
  icon?: string;
  description?: string;
  active?: boolean;
}

export interface Level {
  level: string;
  icon: string;
  color: string;
  minXP: number;
  maxXP: number;
  id?: string;
}

export interface StreakXP {
  week: number | string;
  xp: number;
}

export interface StreakSaverSettings {
  enabled: boolean;
  maxPerExecutive: number;
  sources: {
    medals: boolean;
    missions: boolean;
    masterLevel: boolean;
    monthlyGoal: boolean;
  };
}

export interface Recognition {
  id: number;
  name: string;
  emoji: string;
  color: string;
  xpPerRecognition: number;
  multiplierThreshold: number;
  multiplierType: 'x2' | 'x3' | 'x4';
  multiplierDuration: number;
  multiplierDurationUnit: 'días' | 'semanas';
}

interface ConfigContextType {
  products: Product[];
  levels: Level[];
  streakXP: StreakXP[];
  streakSaverSettings: StreakSaverSettings;
  recognitions: Recognition[];
  loading: boolean;
  // Product functions
  addProduct: (product: { name: string; xp: number; category: string }) => Promise<{ error: any }>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<{ error: any }>;
  deleteProduct: (id: string) => Promise<{ error: any }>;
  // Level functions
  updateLevelRange: (levelName: string, maxXP: number) => Promise<{ error: any }>;
  getLevelByXP: (xp: number) => Level | undefined;
  // Streak functions
  updateStreakXP: (week: number | string, xp: number) => void;
  addStreakWeek: () => void;
  deleteStreakWeek: (week: number | string) => void;
  updateStreakSaverSettings: (settings: Partial<StreakSaverSettings>) => void;
  // Recognition functions
  updateRecognition: (id: number, recognition: Partial<Recognition>) => void;
  // Refresh
  refreshProducts: () => void;
  refreshLevels: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const initialStreakXP: StreakXP[] = [
  { week: 1, xp: 10 },
  { week: 2, xp: 15 },
  { week: 3, xp: 20 },
  { week: 4, xp: 30 },
  { week: 5, xp: 50 },
  { week: "6+", xp: 75 }
];

const initialStreakSaverSettings: StreakSaverSettings = {
  enabled: true,
  maxPerExecutive: 3,
  sources: {
    medals: true,
    missions: true,
    masterLevel: true,
    monthlyGoal: true
  }
};

const initialRecognitions: Recognition[] = [
  { id: 1, name: "Nos apasiona ayudar", emoji: "💙", color: "#3B82F6", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" },
  { id: 2, name: "Tenemos mentalidad ganadora", emoji: "🏆", color: "#F59E0B", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" },
  { id: 3, name: "Innovamos y no paramos de aprender", emoji: "💡", color: "#8B5CF6", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" },
  { id: 4, name: "Nos decimos todo", emoji: "💬", color: "#10B981", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" },
  { id: 5, name: "100% actitud y alegría", emoji: "😊", color: "#EC4899", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" },
  { id: 6, name: "Somos humildes y amorosos", emoji: "🤝", color: "#06B6D4", xpPerRecognition: 20, multiplierThreshold: 5, multiplierType: "x2", multiplierDuration: 7, multiplierDurationUnit: "días" }
];

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [streakXP, setStreakXP] = useState<StreakXP[]>(initialStreakXP);
  const [streakSaverSettings, setStreakSaverSettings] = useState<StreakSaverSettings>(initialStreakSaverSettings);
  const [recognitions, setRecognitions] = useState<Recognition[]>(initialRecognitions);
  const [loading, setLoading] = useState(true);

  // Fetch products from DB
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (!error && data) {
      setProducts(data.map(p => ({
        id: p.id,
        name: p.name,
        xp: p.xp_value,
        category: p.description || 'Otros',
        icon: p.icon || '📦',
        active: p.active ?? true,
      })));
    }
  };

  // Fetch levels from DB
  const fetchLevels = async () => {
    const { data, error } = await supabase
      .from('levels')
      .select('*')
      .order('order_index');

    if (!error && data) {
      setLevels(data.map(l => ({
        id: l.id,
        level: l.name,
        icon: l.icon || '⭐',
        color: l.color || '#3B82F6',
        minXP: l.min_xp,
        maxXP: l.max_xp,
      })));
    }
  };

  useEffect(() => {
    Promise.all([fetchProducts(), fetchLevels()]).finally(() => setLoading(false));
  }, []);

  // Product functions - now persist to DB
  const addProduct = async (product: { name: string; xp: number; category: string }) => {
    const { error } = await supabase.from('products').insert({
      name: product.name,
      xp_value: product.xp,
      description: product.category,
    });
    if (!error) await fetchProducts();
    return { error };
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    const updates: any = {};
    if (product.name !== undefined) updates.name = product.name;
    if (product.xp !== undefined) updates.xp_value = product.xp;
    if (product.category !== undefined) updates.description = product.category;
    if (product.active !== undefined) updates.active = product.active;

    const { error } = await supabase.from('products').update(updates).eq('id', id);
    if (!error) await fetchProducts();
    return { error };
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) await fetchProducts();
    return { error };
  };

  // Level functions - now persist to DB
  const updateLevelRange = async (levelName: string, maxXP: number) => {
    const level = levels.find(l => l.level === levelName);
    if (!level?.id) return { error: new Error('Level not found') };

    const { error } = await supabase.from('levels').update({ max_xp: maxXP }).eq('id', level.id);

    // Update next level's min_xp
    const idx = levels.findIndex(l => l.level === levelName);
    if (idx < levels.length - 1 && levels[idx + 1].id) {
      await supabase.from('levels').update({ min_xp: maxXP + 1 }).eq('id', levels[idx + 1].id!);
    }

    if (!error) await fetchLevels();
    return { error };
  };

  const getLevelByXP = (xp: number): Level | undefined => {
    return levels.find(level => xp >= level.minXP && xp <= level.maxXP);
  };

  // Streak functions (still in-memory for now)
  const updateStreakXP = (week: number | string, xp: number) => {
    setStreakXP(prev => prev.map(s => s.week === week ? { ...s, xp } : s));
  };

  const addStreakWeek = () => {
    const lastWeek = streakXP[streakXP.length - 1];
    const newWeek = typeof lastWeek.week === 'number' ? lastWeek.week + 1 : 7;
    setStreakXP([...streakXP, { week: newWeek, xp: 0 }]);
  };

  const deleteStreakWeek = (week: number | string) => {
    if (streakXP.length > 1) {
      setStreakXP(streakXP.filter(s => s.week !== week));
    }
  };

  const updateStreakSaverSettings = (settings: Partial<StreakSaverSettings>) => {
    setStreakSaverSettings(prev => ({ ...prev, ...settings }));
  };

  // Recognition functions (still in-memory for now)
  const updateRecognition = (id: number, recognition: Partial<Recognition>) => {
    setRecognitions(prev => prev.map(r => r.id === id ? { ...r, ...recognition } : r));
  };

  return (
    <ConfigContext.Provider
      value={{
        products,
        levels,
        streakXP,
        streakSaverSettings,
        recognitions,
        loading,
        addProduct,
        updateProduct,
        deleteProduct,
        updateLevelRange,
        getLevelByXP,
        updateStreakXP,
        addStreakWeek,
        deleteStreakWeek,
        updateStreakSaverSettings,
        updateRecognition,
        refreshProducts: fetchProducts,
        refreshLevels: fetchLevels,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
