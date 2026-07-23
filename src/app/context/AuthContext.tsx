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
  // ✅ NEW: Direct password update (no PIN verification)
  updatePasswordDirectly: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
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
  // PIN-BASED PASSWORD RESET FUNCTIONS - UPDATED WITH BETTER FLOW
  // ============================================================

  const requestPasswordReset = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log("🔐 Requesting password reset for:", normalizedEmail);
      
      // Direct check using Supabase
      const { data: user, error } = await supabase
        .from('user_data')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error("❌ Error checking user:", error);
        return { 
          success: false, 
          error: 'Error checking user. Please try again.' 
        };
      }

      if (!user) {
        console.log("❌ No user found with email:", normalizedEmail);
        return { 
          success: false, 
          error: 'No account found with this email address.' 
        };
      }

      console.log("✅ User found:", user.email);

      // Generate a 6-digit PIN
      const pin = generatePIN();
      console.log('📝 Generated PIN:', pin);
      
      // Save PIN to database
      const saveResult = await saveResetToken(normalizedEmail, pin);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }
      
      // Send email with PIN
      const emailResult = await sendPasswordResetEmailWithPIN(normalizedEmail, pin);
      
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
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔍 verifyPIN called for:', normalizedEmail);
      
      // Call verifyResetToken - this marks PIN as used if valid
      const result = await verifyResetToken(normalizedEmail, pin);
      console.log('🔍 verifyPIN result:', result);
      return result;
    } catch (error: any) {
      console.error('❌ verifyPIN error:', error);
      return { success: false, error: error.message };
    }
  };

  // ✅ NEW: Direct password update without PIN verification
  const updatePasswordDirectly = async (email: string, newPassword: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔐 Updating password directly for:', normalizedEmail);
      
      const result = await updateUserPassword(normalizedEmail, newPassword);
      if (!result.success) {
        console.log('❌ Password update failed:', result.error);
        return { success: false, error: result.error };
      }
      
      console.log('✅ Password updated successfully!');
      return { success: true, message: 'Password updated successfully!' };
    } catch (error: any) {
      console.error('❌ Update password error:', error);
      return { success: false, error: error.message };
    }
  };

  // ⚠️ DEPRECATED: Use verifyPIN + updatePasswordDirectly instead
  // Kept for backward compatibility
  const resetPasswordWithPIN = async (email: string, pin: string, newPassword: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      console.log('🔐 Starting password reset with PIN...');
      console.log('📧 Email:', normalizedEmail);
      console.log('🔑 PIN:', pin);
      
      // STEP 1: Verify the PIN (this marks it as used)
      const verifyResult = await verifyResetToken(normalizedEmail, pin);
      if (!verifyResult.success) {
        console.log('❌ PIN verification failed:', verifyResult.error);
        return { success: false, error: verifyResult.error };
      }
      
      console.log('✅ PIN verified successfully!');
      
      // STEP 2: Update the password
      console.log('📝 Updating password...');
      const updateResult = await updateUserPassword(normalizedEmail, newPassword);
      if (!updateResult.success) {
        console.log('❌ Password update failed:', updateResult.error);
        // PIN is already marked as used, but password update failed
        return { 
          success: false, 
          error: 'Password update failed. Please request a new PIN.' 
        };
      }
      
      console.log('✅ Password updated successfully!');
      return { success: true, message: 'Password updated successfully!' };
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // CONTEXT VALUE
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
    verifyPIN,
    resetPasswordWithPIN,
    updatePasswordDirectly, // ✅ NEW: Direct password update
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