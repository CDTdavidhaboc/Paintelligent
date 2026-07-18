// src/app/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getUserData, saveUserData, registerUser } from "../lib/supabase";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  userEmail: string | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  syncUserData: (data: any) => Promise<boolean>;
  loadUserData: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem("isAuthenticated") === "true";
      const email = localStorage.getItem("userEmail");
      const id = localStorage.getItem("userId");
      
      if (auth && email) {
        setIsAuthenticated(true);
        setUserEmail(email);
        setUserId(id);
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Check if user exists in database
      const userData = await getUserData(email);
      
      if (!userData) {
        console.error("User not found");
        return false;
      }

      // For demo, accept any password (in production, you'd verify password hash)
      // In a real app, you'd check against a hashed password stored in the database
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userId", email);
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserId(email);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      // Use the registerUser function from supabase
      const result = await registerUser(email, password);
      return result;
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserId(null);
  };

  const syncUserData = async (data: any) => {
    if (!userEmail) return false;
    return await saveUserData(userEmail, data);
  };

  const loadUserData = async () => {
    if (!userEmail) return null;
    return await getUserData(userEmail);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        userEmail,
        userId,
        login,
        logout,
        register,
        syncUserData,
        loadUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}