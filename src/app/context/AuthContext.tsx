import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { 
  getUserData, 
  saveUserData, 
  registerUser, 
  loginUser,
  saveResetToken,
  verifyResetToken,
  sendPasswordResetEmailWithPIN,
  confirmUserEmail,
  completePasswordReset as completePasswordResetService,
  supabase,
  checkUserExistsInData,
  checkAuthUserExists,
  forceSyncUser,
  deleteUserPermanently,
  verifyRegistrationCode as verifyCode,
  resendVerificationCode as resendCode,
} from "../lib/supabase";
import { generatePIN } from "../lib/emailService";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  userEmail: string | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; message?: string; requiresVerification?: boolean }>;
  syncUserData: (data: any) => Promise<boolean>;
  loadUserData: () => Promise<any>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyPIN: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithPIN: (email: string, pin: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  completePasswordReset: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  confirmEmail: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  checkUserStatus: (email: string) => Promise<{ 
    existsInAuth: boolean; 
    existsInData: boolean; 
    status: string;
    authUser: any;
    dataUser: any;
  }>;
  forceSyncUser: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  deleteUser: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyRegistrationCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationCode: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // ✅ Use refs to track auth state
  const authInitialized = useRef(false);
  const logoutInProgress = useRef(false);

  // ✅ Memoized auth check function
  const checkAuth = useCallback(() => {
    // Don't check if logout is in progress
    if (logoutInProgress.current) {
      console.log("⏳ Logout in progress, skipping auth check");
      return;
    }

    try {
      const auth = localStorage.getItem("isAuthenticated") === "true";
      const email = localStorage.getItem("userEmail");
      const id = localStorage.getItem("userId");
      
      console.log("🔍 Auth check - authenticated:", auth, "email:", email);
      
      // ✅ Check if email is valid (not "null" or empty)
      const isValidEmail = email && email !== "null" && email !== "";
      
      if (auth && isValidEmail) {
        setIsAuthenticated(true);
        setUserEmail(email);
        setUserId(id || email);
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
        setUserId(null);
      }
    } catch (error) {
      console.error("❌ Auth check error:", error);
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Initialize auth once
  useEffect(() => {
    if (!authInitialized.current) {
      console.log("🚀 Initializing auth...");
      checkAuth();
      authInitialized.current = true;
    }
  }, [checkAuth]);

  // ✅ Handle storage events (for multi-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'isAuthenticated' || e.key === 'userEmail' || e.key === 'userId') {
        console.log("📥 Storage event detected:", e.key);
        // Small delay to ensure storage is updated
        setTimeout(checkAuth, 100);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkAuth]);

  // ============================================================
  // LOGIN
  // ============================================================
  
  const login = async (email: string, password: string) => {
    try {
      console.log("🔑 Logging in user:", email);
      
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
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

      // ✅ Update localStorage
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", trimmedEmail);
      localStorage.setItem("userId", result.user?.auth_user_id || trimmedEmail);
      localStorage.setItem("authToken", result.token || "");
      
      // ✅ Update state
      setIsAuthenticated(true);
      setUserEmail(trimmedEmail);
      setUserId(result.user?.auth_user_id || trimmedEmail);
      
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
  // LOGOUT - FIXED
  // ============================================================
  
  const logout = useCallback(() => {
    console.log("🚪 Logging out user:", userEmail);
    
    // ✅ Set logout flag to prevent auth checks during logout
    logoutInProgress.current = true;
    
    // ✅ Clear all auth-related localStorage
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("authToken");
    
    // ✅ Clear profile data
    if (userEmail) {
      const userDataKey = `user_${userEmail}_profileData`;
      const userPictureKey = `user_${userEmail}_profilePicture`;
      localStorage.removeItem(userDataKey);
      localStorage.removeItem(userPictureKey);
    }
    localStorage.removeItem('userProfileData');
    localStorage.removeItem('userProfilePicture');
    
    // ✅ Update state immediately
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserId(null);
    
    // ✅ Clear logout flag after a delay
    setTimeout(() => {
      logoutInProgress.current = false;
      setLoading(false);
    }, 300);
    
    console.log("✅ Logout successful - state cleared");
  }, [userEmail]);

  // ============================================================
  // REGISTER
  // ============================================================
  
  const register = async (email: string, password: string, fullName: string) => {
    try {
      console.log("📝 Registering user:", email);
      
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedFullName = fullName.trim();
      
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
      
      return result;
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message || 'Registration failed. Please try again.' };
    }
  };

  // ============================================================
  // VERIFY REGISTRATION CODE
  // ============================================================
  
  const verifyRegistrationCodeFn = async (email: string, code: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔍 Verifying registration code for:', normalizedEmail);
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      if (!code || code.length !== 6) {
        return { success: false, error: 'Please enter a valid 6-digit verification code.' };
      }
      
      const result = await verifyCode(normalizedEmail, code);
      console.log('🔍 Verification result:', result);
      
      return result;
    } catch (error: any) {
      console.error('❌ verifyRegistrationCode error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // RESEND VERIFICATION CODE
  // ============================================================
  
  const resendVerificationCodeFn = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('📤 Resending verification code for:', normalizedEmail);
      
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required.' };
      }
      
      const result = await resendCode(normalizedEmail);
      console.log('📤 Resend result:', result);
      return result;
    } catch (error: any) {
      console.error('❌ resendVerificationCode error:', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================================
  // OTHER FUNCTIONS
  // ============================================================
  
  const syncUserData = async (data: any) => {
    if (!userEmail) return false;
    return await saveUserData(userEmail, data);
  };

  const loadUserData = async () => {
    if (!userEmail) return null;
    return await getUserData(userEmail);
  };

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

      const pin = generatePIN();
      console.log('📝 Generated PIN:', pin);
      
      const saveResult = await saveResetToken(normalizedEmail, pin);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }
      
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

  const completePasswordReset = async (email: string, newPassword: string) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔄 Complete password reset for:', normalizedEmail);
      
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
        logout();
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

  const resetPasswordWithPIN = async (email: string, pin: string, newPassword: string) => {
    console.warn('⚠️ resetPasswordWithPIN is deprecated. Use completePasswordReset instead.');
    return completePasswordReset(email, newPassword);
  };

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

  const forceSyncUserFn = async (email: string) => {
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
    completePasswordReset,
    confirmEmail,
    checkUserStatus,
    forceSyncUser: forceSyncUserFn,
    deleteUser,
    verifyRegistrationCode: verifyRegistrationCodeFn,
    resendVerificationCode: resendVerificationCodeFn,
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