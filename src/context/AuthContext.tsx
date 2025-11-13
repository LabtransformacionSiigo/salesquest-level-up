import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  updateUserXP: (userId: number, newXP: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Usuarios de prueba
const testUsers: User[] = [
  {
    id: 1,
    email: "admin@salesquest.com",
    name: "Ana Administradora",
    role: "ADMINISTRADOR",
    avatar: "👩‍💼"
  },
  {
    id: 2,
    email: "gerente@salesquest.com",
    name: "Carlos Gerente",
    role: "GERENTE",
    xp: 450,
    level: "Junior",
    avatar: "👨‍💼",
    streak: 3,
    shields: 1
  },
  {
    id: 3,
    email: "ejecutivo@salesquest.com",
    name: "María Ejecutiva",
    role: "EJECUTIVO",
    xp: 120,
    level: "Novato",
    avatar: "👩‍💻",
    streak: 0,
    shields: 0
  }
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, password: string): boolean => {
    // Validación simple para testing
    const validPasswords: Record<string, string> = {
      "admin@salesquest.com": "admin123",
      "gerente@salesquest.com": "gerente123",
      "ejecutivo@salesquest.com": "ejecutivo123"
    };

    if (validPasswords[email] === password) {
      const foundUser = testUsers.find(u => u.email === email);
      if (foundUser) {
        setUser(foundUser);
        return true;
      }
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const updateUserXP = (userId: number, newXP: number) => {
    if (user && user.id === userId) {
      setUser({ ...user, xp: newXP });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      updateUserXP
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
