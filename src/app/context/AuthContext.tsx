// src/app/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { 
  getUserData, 
  saveUserData, 
  registerUser, 
  loginUser,
  generatePIN,
  saveResetToken,
  verifyResetToken,
  updateUserPassword,
  sendPasswordResetEmailWithPIN,
  supabase,
  supabaseAdmin,
} from "../lib/supabase";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  userEmail: string | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  syncUserData: (data: any) => Promise<boolean>;
  loadUserData: () => Promise<any>;
  // PIN-based password reset
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyPIN: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithPIN: (email: string, pin: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
      
      const result = await loginUser(email, password);
      
      if (!result.success) {
        console.error("Login failed:", result.error);
        return false;
      }

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userId", email);
      localStorage.setItem("authToken", result.token || "");
      
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserId(email);
      
      window.dispatchEvent(new Event('storage'));
      
      console.log("✅ Login successful for:", email);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      console.log("📝 Registering user:", email);
      const result = await registerUser(email, password, fullName);
      return result;
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    console.log("🚪 Logging out user:", userEmail);
    
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("authToken");
    
    if (userEmail) {
      const userDataKey = `user_${userEmail}_profileData`;
      const userPictureKey = `user_${userEmail}_profilePicture`;
      localStorage.removeItem(userDataKey);
      localStorage.removeItem(userPictureKey);
    }
    localStorage.removeItem('userProfileData');
    localStorage.removeItem('userProfilePicture');
    
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserId(null);
    
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

  // ============================================================
  // PIN-BASED PASSWORD RESET FUNCTIONS
  // ============================================================

  const requestPasswordReset = async (email: string) => {
    try {
      console.log("🔐 Requesting password reset for:", email);
      
      let userExists = false;

      // ============================================================
      // METHOD 1: Try using Admin Client (bypasses RLS)
      // ============================================================
      if (supabaseAdmin) {
        console.log("📝 Using Admin Client to check user...");
        try {
          const { data: user, error } = await supabaseAdmin
            .from('user_data')
            .select('email')
            .eq('email', email)
            .maybeSingle();

          if (!error && user) {
            userExists = true;
            console.log("✅ User found via Admin Client:", user.email);
          }
        } catch (adminErr) {
          console.error("❌ Admin client exception:", adminErr);
        }
      }

      // ============================================================
      // METHOD 2: Try using Regular Client (with RLS)
      // ============================================================
      if (!userExists) {
        console.log("📝 Trying regular client query...");
        try {
          const { data: user, error } = await supabase
            .from('user_data')
            .select('email')
            .eq('email', email)
            .maybeSingle();

          if (!error && user) {
            userExists = true;
            console.log("✅ User found via regular client:", user.email);
          }
        } catch (regErr) {
          console.error("❌ Regular client exception:", regErr);
        }
      }

      // ============================================================
      // METHOD 3: Try using Count Query (bypasses RLS for count)
      // ============================================================
      if (!userExists) {
        console.log("📝 Trying count query...");
        try {
          const { count, error } = await supabase
            .from('user_data')
            .select('*', { count: 'exact', head: true })
            .eq('email', email);

          if (!error && count && count > 0) {
            userExists = true;
            console.log("✅ User found via count query, count:", count);
          }
        } catch (countErr) {
          console.error("❌ Count query exception:", countErr);
        }
      }

      // ============================================================
      // FINAL CHECK: If user doesn't exist, return error
      // ============================================================
      if (!userExists) {
        console.log("❌ No user found with email:", email);
        return { 
          success: false, 
          error: 'No account found with this email address.' 
        };
      }

      console.log("✅ User verified, proceeding with PIN generation...");

      // Generate a 6-digit PIN
      const pin = generatePIN();
      console.log('📝 Generated PIN:', pin);
      
      // Save PIN to database
      const saveResult = await saveResetToken(email, pin);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }
      
      // ============================================================
      // SEND EMAIL WITH PIN using the email service
      // ============================================================
      const emailResult = await sendPasswordResetEmailWithPIN(email, pin);
      
      if (!emailResult.success) {
        console.error('❌ Failed to send email:', emailResult.error);
        return { 
          success: true, 
          message: 'PIN generated but email could not be sent. Please check your console for the PIN.' 
        };
      }
      
      console.log('✅ Password reset email sent successfully');
      
      return { 
        success: true, 
        message: 'A 6-digit PIN has been sent to your email address.' 
      };
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      return { success: false, error: error.message || 'An error occurred. Please try again.' };
    }
  };

  const verifyPIN = async (email: string, pin: string) => {
    try {
      const result = await verifyResetToken(email, pin);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const resetPasswordWithPIN = async (email: string, pin: string, newPassword: string) => {
    try {
      // Verify PIN first
      const verifyResult = await verifyResetToken(email, pin);
      if (!verifyResult.success) {
        return { success: false, error: verifyResult.error };
      }
      
      // Update password
      const updateResult = await updateUserPassword(email, newPassword);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }
      
      return { success: true, message: 'Password updated successfully!' };
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // CONTEXT VALUE - Make sure all functions are included
  // ============================================================
  const value = {
    isAuthenticated,
    loading,
    userEmail,
    userId,
    login,
    logout,
    register,
    syncUserData,
    loadUserData,
    requestPasswordReset,
    verifyPIN,  // ✅ Make sure this is included
    resetPasswordWithPIN,
  };

  return (
    <AuthContext.Provider value={value}>
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