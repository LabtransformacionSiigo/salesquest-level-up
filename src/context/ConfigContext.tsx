import React, { createContext, useContext, useState, ReactNode } from 'react';

// Types
export interface Product {
  id: number;
  name: string;
  xp: number;
  category: 'Facturación' | 'Nómina' | 'Nube' | 'Otros';
}

export interface Level {
  level: string;
  icon: string;
  color: string;
  minXP: number;
  maxXP: number;
}

export interface Medal {
  id: string;
  name: string;
  icon: string;
  description: string;
  xp: number;
  criteria: string;
  criteriaParams?: Record<string, any>;
  givesStreakSaver: boolean;
  repeatable: boolean;
  rarity?: 'común' | 'poco común' | 'rara' | 'épica' | 'legendaria';
  active?: boolean;
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
  medals: Medal[];
  streakXP: StreakXP[];
  streakSaverSettings: StreakSaverSettings;
  recognitions: Recognition[];
  // Product functions
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: number, product: Partial<Product>) => void;
  deleteProduct: (id: number) => void;
  // Level functions
  updateLevelRange: (level: string, maxXP: number) => void;
  getLevelByXP: (xp: number) => Level | undefined;
  // Medal functions
  addMedal: (medal: Omit<Medal, 'id'>) => void;
  updateMedal: (id: string, medal: Partial<Medal>) => void;
  deleteMedal: (id: string) => void;
  // Streak functions
  updateStreakXP: (week: number | string, xp: number) => void;
  addStreakWeek: () => void;
  deleteStreakWeek: (week: number | string) => void;
  updateStreakSaverSettings: (settings: Partial<StreakSaverSettings>) => void;
  // Recognition functions
  updateRecognition: (id: number, recognition: Partial<Recognition>) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// Initial data
const initialProducts: Product[] = [
  { id: 1, name: "Factura Electrónica", xp: 3, category: "Facturación" },
  { id: 2, name: "Nómina Electrónica", xp: 5, category: "Nómina" },
  { id: 3, name: "Nube", xp: 15, category: "Nube" },
  { id: 4, name: "POS", xp: 8, category: "Otros" },
  { id: 5, name: "Factura Plus", xp: 10, category: "Facturación" }
];

const initialLevels: Level[] = [
  { level: "Novato", icon: "🌱", color: "#6B7280", minXP: 0, maxXP: 500 },
  { level: "Junior", icon: "💙", color: "#3B82F6", minXP: 501, maxXP: 1500 },
  { level: "Senior", icon: "💜", color: "#8B5CF6", minXP: 1501, maxXP: 3500 },
  { level: "Master", icon: "⭐", color: "#F59E0B", minXP: 3501, maxXP: 7000 },
  { level: "Imparable", icon: "🏆", color: "linear-gradient(to right, #F59E0B, #EC4899, #8B5CF6)", minXP: 7001, maxXP: 999999 }
];

const initialMedals: Medal[] = [
  {
    id: 'first-sale',
    name: "Primera Venta",
    icon: "🎯",
    description: "Realiza tu primera venta",
    xp: 50,
    criteria: "PRIMERA_VENTA",
    givesStreakSaver: true,
    repeatable: false,
    rarity: 'común',
    active: true
  },
  {
    id: 'sales-10',
    name: "Vendedor Activo",
    icon: "💼",
    description: "Registra 10 ventas en el mes",
    xp: 100,
    criteria: "VENTAS_MES_X",
    criteriaParams: { count: 10 },
    givesStreakSaver: false,
    repeatable: true,
    rarity: 'común',
    active: true
  },
  {
    id: 'cloud-master',
    name: "Master de Nube",
    icon: "☁️",
    description: "Vende 5 productos Nube",
    xp: 150,
    criteria: "PRODUCTO_ESPECIFICO_X",
    criteriaParams: { product: "Nube", count: 5 },
    givesStreakSaver: false,
    repeatable: true,
    rarity: 'poco común',
    active: true
  },
  {
    id: 'level-junior',
    name: "Ascenso Junior",
    icon: "💙",
    description: "Alcanza el nivel Junior",
    xp: 100,
    criteria: "NIVEL_ALCANZADO",
    criteriaParams: { level: "Junior" },
    givesStreakSaver: false,
    repeatable: false,
    rarity: 'común',
    active: true
  },
  {
    id: 'level-senior',
    name: "Ascenso Senior",
    icon: "💜",
    description: "Alcanza el nivel Senior",
    xp: 200,
    criteria: "NIVEL_ALCANZADO",
    criteriaParams: { level: "Senior" },
    givesStreakSaver: true,
    repeatable: false,
    rarity: 'poco común',
    active: true
  },
  {
    id: 'streak-4',
    name: "Compromiso Sólido",
    icon: "🔥",
    description: "Mantén una racha de 4 semanas",
    xp: 80,
    criteria: "RACHA_SEMANAS_X",
    criteriaParams: { weeks: 4 },
    givesStreakSaver: true,
    repeatable: true,
    rarity: 'común',
    active: true
  },
  {
    id: 'streak-12',
    name: "Imparable",
    icon: "🚀",
    description: "Mantén una racha de 12 semanas",
    xp: 300,
    criteria: "RACHA_SEMANAS_X",
    criteriaParams: { weeks: 12 },
    givesStreakSaver: true,
    repeatable: true,
    rarity: 'rara',
    active: true
  },
  {
    id: 'top-seller',
    name: "Vendedor del Mes",
    icon: "👑",
    description: "Sé el vendedor #1 del mes en tu célula",
    xp: 500,
    criteria: "TOP_VENDEDOR_MES",
    givesStreakSaver: true,
    repeatable: true,
    rarity: 'épica',
    active: true
  },
  {
    id: 'top-3',
    name: "Elite del Mes",
    icon: "🥉",
    description: "Termina en el top 3 del mes",
    xp: 200,
    criteria: "TOP_3_VENDEDOR_MES",
    givesStreakSaver: false,
    repeatable: true,
    rarity: 'rara',
    active: true
  }
];

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
  {
    id: 1,
    name: "Nos apasiona ayudar",
    emoji: "💙",
    color: "#3B82F6",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  },
  {
    id: 2,
    name: "Tenemos mentalidad ganadora",
    emoji: "🏆",
    color: "#F59E0B",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  },
  {
    id: 3,
    name: "Innovamos y no paramos de aprender",
    emoji: "💡",
    color: "#8B5CF6",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  },
  {
    id: 4,
    name: "Nos decimos todo",
    emoji: "💬",
    color: "#10B981",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  },
  {
    id: 5,
    name: "100% actitud y alegría",
    emoji: "😊",
    color: "#EC4899",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  },
  {
    id: 6,
    name: "Somos humildes y amorosos",
    emoji: "🤝",
    color: "#06B6D4",
    xpPerRecognition: 20,
    multiplierThreshold: 5,
    multiplierType: "x2",
    multiplierDuration: 7,
    multiplierDurationUnit: "días"
  }
];

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [medals, setMedals] = useState<Medal[]>(initialMedals);
  const [streakXP, setStreakXP] = useState<StreakXP[]>(initialStreakXP);
  const [streakSaverSettings, setStreakSaverSettings] = useState<StreakSaverSettings>(initialStreakSaverSettings);
  const [recognitions, setRecognitions] = useState<Recognition[]>(initialRecognitions);

  // Product functions
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    setProducts([...products, { ...product, id: newId }]);
  };

  const updateProduct = (id: number, product: Partial<Product>) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...product } : p));
  };

  const deleteProduct = (id: number) => {
    setProducts(products.filter(p => p.id !== id));
  };

  // Level functions
  const updateLevelRange = (level: string, maxXP: number) => {
    setLevels(prevLevels => {
      const newLevels = [...prevLevels];
      const index = newLevels.findIndex(l => l.level === level);
      if (index !== -1) {
        newLevels[index] = { ...newLevels[index], maxXP };
        // Update next level's minXP
        if (index < newLevels.length - 1) {
          newLevels[index + 1] = { ...newLevels[index + 1], minXP: maxXP + 1 };
        }
      }
      return newLevels;
    });
  };

  const getLevelByXP = (xp: number): Level | undefined => {
    return levels.find(level => xp >= level.minXP && xp <= level.maxXP);
  };

  // Medal functions
  const addMedal = (medal: Omit<Medal, 'id'>) => {
    const newId = `medal-${Date.now()}`;
    setMedals([...medals, { ...medal, id: newId, active: true }]);
  };

  const updateMedal = (id: string, medal: Partial<Medal>) => {
    setMedals(medals.map(m => m.id === id ? { ...m, ...medal } : m));
  };

  const deleteMedal = (id: string) => {
    setMedals(medals.filter(m => m.id !== id));
  };

  // Streak functions
  const updateStreakXP = (week: number | string, xp: number) => {
    setStreakXP(streakXP.map(s => s.week === week ? { ...s, xp } : s));
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

  // Recognition functions
  const updateRecognition = (id: number, recognition: Partial<Recognition>) => {
    setRecognitions(recognitions.map(r => r.id === id ? { ...r, ...recognition } : r));
  };

  return (
    <ConfigContext.Provider
      value={{
        products,
        levels,
        medals,
        streakXP,
        streakSaverSettings,
        recognitions,
        addProduct,
        updateProduct,
        deleteProduct,
        updateLevelRange,
        getLevelByXP,
        addMedal,
        updateMedal,
        deleteMedal,
        updateStreakXP,
        addStreakWeek,
        deleteStreakWeek,
        updateStreakSaverSettings,
        updateRecognition
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
