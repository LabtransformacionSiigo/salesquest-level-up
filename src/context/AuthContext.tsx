import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  updateUserXP: (userId: number, newXP: number) => void;
  addUser: (userData: Omit<User, 'id'> & { password: string }) => User;
  updateUser: (userId: number, userData: Partial<User> & { password?: string }) => void;
  deleteUser: (userId: number) => void;
  getAllUsers: () => User[];
  getManagers: () => User[];
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
  const [users, setUsers] = useState<User[]>(testUsers);
  const [passwords, setPasswords] = useState<Record<string, string>>({
    "admin@salesquest.com": "admin123",
    "gerente@salesquest.com": "gerente123",
    "ejecutivo@salesquest.com": "ejecutivo123"
  });

  const login = (email: string, password: string): boolean => {
    if (passwords[email] === password) {
      const foundUser = users.find(u => u.email === email);
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
    // Also update in users list
    setUsers(users.map(u => u.id === userId ? { ...u, xp: newXP } : u));
  };

  const addUser = (userData: Omit<User, 'id'> & { password: string }): User => {
    const newId = Math.max(...users.map(u => u.id), 0) + 1;
    const { password, ...userDataWithoutPassword } = userData;
    
    const newUser: User = {
      ...userDataWithoutPassword,
      id: newId,
      xp: 0,
      level: 'Novato',
      streak: 0,
      shields: 0,
      medals: []
    };

    setUsers([...users, newUser]);
    setPasswords({ ...passwords, [newUser.email]: password });
    
    return newUser;
  };

  const getAllUsers = (): User[] => {
    return users;
  };

  const getManagers = (): User[] => {
    return users.filter(u => u.role === 'GERENTE');
  };

  const updateUser = (userId: number, userData: Partial<User> & { password?: string }) => {
    const { password, ...userUpdateData } = userData;
    
    setUsers(users.map(u => u.id === userId ? { ...u, ...userUpdateData } : u));
    
    if (password) {
      const userToUpdate = users.find(u => u.id === userId);
      if (userToUpdate) {
        setPasswords({ ...passwords, [userToUpdate.email]: password });
      }
    }
    
    // Update current user if it's the same
    if (user && user.id === userId) {
      setUser({ ...user, ...userUpdateData });
    }
  };

  const deleteUser = (userId: number) => {
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete) {
      setUsers(users.filter(u => u.id !== userId));
      const { [userToDelete.email]: _, ...remainingPasswords } = passwords;
      setPasswords(remainingPasswords);
      
      // Logout if deleting current user
      if (user && user.id === userId) {
        setUser(null);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      users,
      login, 
      logout, 
      isAuthenticated: !!user,
      updateUserXP,
      addUser,
      updateUser,
      deleteUser,
      getAllUsers,
      getManagers
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
