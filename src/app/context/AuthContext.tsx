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
  sendPasswordResetEmailWithPIN,
  confirmUserEmail,
  completePasswordReset as completePasswordResetService,
  supabase,
  supabaseAdmin,
  checkUserExistsInData,
  checkAuthUserExists,
  forceSyncUser,
  deleteUserPermanently,
} from "../lib/supabase";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  userEmail: string | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  syncUserData: (data: any) => Promise<boolean>;
  loadUserData: () => Promise<any>;
  // PIN-based password reset
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyPIN: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithPIN: (email: string, pin: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  // ✅ Complete password reset (recommended)
  completePasswordReset: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  // Confirm email
  confirmEmail: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  // ✅ User management
  checkUserStatus: (email: string) => Promise<{ 
    existsInAuth: boolean; 
    existsInData: boolean; 
    status: string;
    authUser: any;
    dataUser: any;
  }>;
  forceSyncUser: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  deleteUser: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
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

  // ============================================================
  // LOGIN - FIXED with proper error handling
  // ============================================================
  const login = async (email: string, password: string) => {
    try {
      console.log("🔑 Logging in user:", email);
      
      // Trim inputs
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      // Validate empty fields (additional client-side validation)
      if (!trimmedEmail) {
        return { success: false, error: 'Please enter your email address.' };
      }
      
      if (!trimmedPassword) {
        return { success: false, error: 'Please enter your password.' };
      }
      
      const result = await loginUser(trimmedEmail, trimmedPassword);
      
      if (!result.success) {
        console.error("Login failed:", result.error);
        return { success: false, error: result.error };
      }

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", trimmedEmail);
      localStorage.setItem("userId", result.user?.auth_user_id || trimmedEmail);
      localStorage.setItem("authToken", result.token || "");
      
      setIsAuthenticated(true);
      setUserEmail(trimmedEmail);
      setUserId(result.user?.auth_user_id || trimmedEmail);
      
      window.dispatchEvent(new Event('storage'));
      
      console.log("✅ Login successful for:", trimmedEmail);
      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred. Please try again.' 
      };
    }
  };

  // ============================================================
  // REGISTER - FIXED with proper error handling
  // ============================================================
  const register = async (email: string, password: string, fullName: string) => {
    try {
      console.log("📝 Registering user:", email);
      
      // Trim inputs
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedFullName = fullName.trim();
      
      // Client-side validation
      if (!trimmedEmail) {
        return { success: false, error: 'Please enter your email address.' };
      }
      
      if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      
      if (!trimmedPassword) {
        return { success: false, error: 'Please enter a password.' };
      }
      
      if (trimmedPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }
      
      if (!trimmedFullName) {
        return { success: false, error: 'Please enter your full name.' };
      }
      
      const result = await registerUser(trimmedEmail, trimmedPassword, trimmedFullName);
      
      // Auto-confirm in development
      if (result.success && import.meta.env.MODE === 'development') {
        console.log('📧 Auto-confirming email in development...');
        const confirmResult = await confirmUserEmail(trimmedEmail);
        if (confirmResult.success) {
          console.log('✅ Email auto-confirmed!');
        } else {
          console.warn('⚠️ Auto-confirm failed:', confirmResult.error);
        }
      }
      
      return result;
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message || 'Registration failed. Please try again.' };
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================
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

  // ============================================================
  // USER DATA OPERATIONS
  // ============================================================
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
      const normalizedEmail = email.toLowerCase().trim();
      console.log("🔐 Requesting password reset for:", normalizedEmail);
      
      if (!normalizedEmail) {
        return { 
          success: false, 
          error: 'Please enter your email address.' 
        };
      }
      
      // Check if user exists in Auth (source of truth)
      const authCheck = await checkAuthUserExists(normalizedEmail);
      
      if (!authCheck.success) {
        return { 
          success: false, 
          error: 'Error checking user. Please try again.' 
        };
      }

      if (!authCheck.exists) {
        console.log("❌ No user found with email:", normalizedEmail);
        return { 
          success: false, 
          error: 'No account found with this email address.' 
        };
      }

      console.log("✅ User found in Auth:", authCheck.user.email);

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
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      if (!pin || pin.length !== 6) {
        return { success: false, error: 'Please enter a valid 6-digit PIN.' };
      }
      
      const result = await verifyResetToken(normalizedEmail, pin);
      console.log('🔍 verifyPIN result:', result);
      return result;
    } catch (error: any) {
      console.error('❌ verifyPIN error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // ✅ COMPLETE PASSWORD RESET - RECOMMENDED
  // ============================================================
  const completePasswordReset = async (email: string, newPassword: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔄 Complete password reset for:', normalizedEmail);
      
      // Validate inputs
      if (!normalizedEmail) {
        return { 
          success: false, 
          error: 'Email is required.' 
        };
      }
      
      if (!newPassword || newPassword.length === 0) {
        return { 
          success: false, 
          error: 'Please enter a new password.' 
        };
      }
      
      if (newPassword.length < 6) {
        return { 
          success: false, 
          error: 'Password must be at least 6 characters.' 
        };
      }

      const result = await completePasswordResetService(normalizedEmail, newPassword);
      
      if (result.success) {
        console.log('✅ Password reset completed successfully!');
        
        // Clear any cached user data to force re-login
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");
        localStorage.removeItem("authToken");
        
        setIsAuthenticated(false);
        setUserEmail(null);
        setUserId(null);
      } else {
        console.error('❌ Password reset failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Complete password reset error:', error);
      return { 
        success: false, 
        error: error.message || 'An error occurred during password reset.' 
      };
    }
  };

  // ============================================================
  // DEPRECATED: resetPasswordWithPIN - Use completePasswordReset
  // ============================================================
  const resetPasswordWithPIN = async (email: string, pin: string, newPassword: string) => {
    console.warn('⚠️ resetPasswordWithPIN is deprecated. Use completePasswordReset instead.');
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      if (!pin || pin.length !== 6) {
        return { success: false, error: 'Please enter a valid 6-digit PIN.' };
      }
      
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }
      
      // STEP 1: Verify the PIN
      const verifyResult = await verifyResetToken(normalizedEmail, pin);
      if (!verifyResult.success) {
        console.log('❌ PIN verification failed:', verifyResult.error);
        return { success: false, error: verifyResult.error };
      }
      
      console.log('✅ PIN verified successfully!');
      
      // STEP 2: Update the password
      const updateResult = await completePasswordReset(normalizedEmail, newPassword);
      if (!updateResult.success) {
        console.log('❌ Password update failed:', updateResult.error);
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
  // CONFIRM EMAIL
  // ============================================================
  const confirmEmail = async (email: string) => {
    try {
      console.log('📧 Confirming email:', email);
      const result = await confirmUserEmail(email);
      return result;
    } catch (error: any) {
      console.error('❌ Confirm email error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // ✅ USER MANAGEMENT
  // ============================================================
  const checkUserStatus = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!normalizedEmail) {
        return {
          existsInAuth: false,
          existsInData: false,
          status: 'Email is required',
          authUser: null,
          dataUser: null,
        };
      }
      
      const authCheck = await checkAuthUserExists(normalizedEmail);
      const dataCheck = await checkUserExistsInData(normalizedEmail);
      
      let status = '';
      if (authCheck.exists && dataCheck.exists) {
        status = '✅ Complete - User exists in both Auth and user_data';
      } else if (authCheck.exists && !dataCheck.exists) {
        status = '⚠️ Auth only - user_data missing (will be auto-created on login)';
      } else if (!authCheck.exists && dataCheck.exists) {
        status = '⚠️ Orphaned user_data - Auth user missing (run forceSyncUser)';
      } else {
        status = '❌ User not found in either system';
      }
      
      return {
        existsInAuth: authCheck.exists || false,
        existsInData: dataCheck.exists || false,
        status,
        authUser: authCheck.user || null,
        dataUser: dataCheck.user || null,
      };
    } catch (error: any) {
      console.error('❌ Error checking user status:', error);
      return {
        existsInAuth: false,
        existsInData: false,
        status: 'Error checking user status',
        authUser: null,
        dataUser: null,
      };
    }
  };

  const forceSyncUser = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      const result = await forceSyncUser(normalizedEmail);
      return result;
    } catch (error: any) {
      console.error('❌ Error syncing user:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteUser = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      const result = await deleteUserPermanently(normalizedEmail);
      if (result.success) {
        // If user is currently logged in, log them out
        if (userEmail === normalizedEmail) {
          logout();
        }
      }
      return result;
    } catch (error: any) {
      console.error('❌ Error deleting user:', error);
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
    // Password reset functions
    requestPasswordReset,
    verifyPIN,
    resetPasswordWithPIN, // Deprecated - kept for backward compatibility
    completePasswordReset, // ✅ Recommended
    confirmEmail,
    // User management
    checkUserStatus,
    forceSyncUser,
    deleteUser,
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