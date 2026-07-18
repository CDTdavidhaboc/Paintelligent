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

  // Function to check auth and update state
  const checkAuth = () => {
    const auth = localStorage.getItem("isAuthenticated") === "true";
    const email = localStorage.getItem("userEmail");
    const id = localStorage.getItem("userId");
    
    console.log("🔍 Auth check - authenticated:", auth, "email:", email);
    
    if (auth && email) {
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserId(id || email);
    } else {
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserId(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Listen for storage events (for cross-tab communication)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'isAuthenticated' || e.key === 'userEmail') {
        console.log("📥 Storage event detected - rechecking auth");
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log("🔑 Logging in user:", email);
      
      // Check if user exists in database
      const userData = await getUserData(email);
      
      if (!userData) {
        console.error("User not found");
        return false;
      }

      // Store auth data
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userId", email);
      
      // Update state
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserId(email);
      
      // Dispatch storage event for cross-tab sync
      window.dispatchEvent(new Event('storage'));
      
      console.log("✅ Login successful for:", email);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      console.log("📝 Registering user:", email);
      const result = await registerUser(email, password);
      return result;
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    console.log("🚪 Logging out user:", userEmail);
    
    // Clear localStorage
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    
    // Clear user-specific data
    if (userEmail) {
      const userDataKey = `user_${userEmail}_profileData`;
      const userPictureKey = `user_${userEmail}_profilePicture`;
      localStorage.removeItem(userDataKey);
      localStorage.removeItem(userPictureKey);
    }
    localStorage.removeItem('userProfileData');
    localStorage.removeItem('userProfilePicture');
    
    // Update state
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserId(null);
    
    // Dispatch storage event for cross-tab sync
    window.dispatchEvent(new Event('storage'));
    
    console.log("✅ Logout successful");
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