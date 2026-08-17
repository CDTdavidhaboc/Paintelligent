// src/pages/ResetPassword.tsx

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Lock, 
  User, 
  Mail,
  AlertCircle, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Key,
  Check,
  XCircle
} from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get auth functions
  const { 
    requestPasswordReset, 
    verifyPIN,
    completePasswordReset,
    logout // ✅ Added - to force logout after password reset
  } = useAuth();

  // Form data
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI states
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [showPinForm, setShowPinForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Refs to prevent double submission
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);
  const isVerifyingRef = useRef(false);
  const isSendingRef = useRef(false);

  // Check if email was passed from login page
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
      setShowEmailForm(false);
      setShowPinForm(true);
      setShowPasswordForm(false);
    }
  }, [location.state]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first input when PIN form shows
  useEffect(() => {
    if (showPinForm && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [showPinForm]);

  const checkPasswordStrength = (pass: string) => {
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 10) strength++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    checkPasswordStrength(value);
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength <= 3) return "bg-yellow-500";
    if (passwordStrength <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 3) return "Fair";
    if (passwordStrength <= 4) return "Good";
    return "Strong";
  };

  const isPasswordStrongEnough = () => {
    return passwordStrength >= 4;
  };

  // Handle PIN input change
  const handlePinChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData) {
      const digits = pastedData.slice(0, 6).split('');
      const newPin = [...pin];
      digits.forEach((digit, i) => {
        if (i < 6) newPin[i] = digit;
      });
      setPin(newPin);
      const lastFilledIndex = Math.min(digits.length, 5);
      inputRefs.current[lastFilledIndex]?.focus();
    }
  };

  // Step 1: Send PIN to email
  const handleSendPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSendingRef.current || isLoading) {
      console.log('⏳ Already sending PIN, please wait...');
      return;
    }
    
    setError("");
    setIsLoading(true);
    isSendingRef.current = true;

    if (!email) {
      setError("Please enter your email address.");
      setIsLoading(false);
      isSendingRef.current = false;
      return;
    }

    try {
      const result = await requestPasswordReset(email);
      
      if (result.success) {
        setShowEmailForm(false);
        setShowPinForm(true);
        setShowPasswordForm(false);
        setError("");
        setResendCooldown(60);
        setPin(["", "", "", "", "", ""]);
        console.log("✅ PIN sent successfully");
      } else {
        setError(result.error || "Failed to send PIN. Please try again.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  // Step 2: Verify PIN
  const handleVerifyPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isVerifyingRef.current || isLoading) {
      console.log('⏳ Already verifying PIN, please wait...');
      return;
    }
    
    setError("");
    setIsLoading(true);
    isVerifyingRef.current = true;

    const pinString = pin.join('');
    if (!pinString || pinString.length !== 6) {
      setError("Please enter a valid 6-digit PIN.");
      setIsLoading(false);
      isVerifyingRef.current = false;
      return;
    }

    try {
      console.log('🔍 Verifying PIN:', pinString);
      const result = await verifyPIN(email, pinString);
      console.log('🔍 Verification result:', result);
      
      if (result.success) {
        setShowEmailForm(false);
        setShowPinForm(false);
        setShowPasswordForm(true);
        setError("");
        console.log("✅ PIN verified successfully! Now enter new password.");
      } else {
        setError(result.error || "Invalid PIN. Please try again.");
        setPin(["", "", "", "", "", ""]);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      isVerifyingRef.current = false;
    }
  };

  // ============================================================
  // STEP 3: Reset Password - UPDATED to use completePasswordReset
  // ============================================================
  const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (isSubmittingRef.current || isLoading) {
    console.log('⏳ Already resetting password, please wait...');
    return;
  }
  
  setError("");
  setIsLoading(true);
  isSubmittingRef.current = true;

  // Validate password
  if (!newPassword || !confirmPassword) {
    setError("Please fill in all fields.");
    setIsLoading(false);
    isSubmittingRef.current = false;
    return;
  }

  if (newPassword.length < 6) {
    setError("Password must be at least 6 characters long.");
    setIsLoading(false);
    isSubmittingRef.current = false;
    return;
  }

  if (newPassword !== confirmPassword) {
    setError("Passwords do not match.");
    setIsLoading(false);
    isSubmittingRef.current = false;
    return;
  }

  if (!isPasswordStrongEnough()) {
    setError("Please choose a stronger password. Try using a mix of uppercase, lowercase, numbers, and special characters.");
    setIsLoading(false);
    isSubmittingRef.current = false;
    return;
  }

  try {
    console.log('🔐 Resetting password for:', email);
    console.log('🔑 New password length:', newPassword.length);
    
    const result = await completePasswordReset(email, newPassword);
    
    console.log('📊 Reset result:', result);
    
    if (result.success) {
      // ✅ FORCE LOGOUT
      logout();
      
      // ✅ Clear ALL storage again (double-check)
      localStorage.clear();
      sessionStorage.clear();
      
      setSuccess(true);
      setError("");
      setShowPasswordForm(false);
      console.log("✅ Password reset successful!");
      console.log("ℹ️ Old password is now invalid. Only the new password works.");
      
      // ✅ Force a hard reload after 2 seconds to clear all cached state
      setTimeout(() => {
        // Use window.location.href to force a full page reload
        window.location.href = "/login";
      }, 2500);
    } else {
      setError(result.error || "Failed to reset password. Please try again.");
    }
  } catch (err: any) {
    console.error("Reset error:", err);
    setError(err.message || "An error occurred. Please try again.");
  } finally {
    setIsLoading(false);
    isSubmittingRef.current = false;
  }
};
  // Resend PIN
  const handleResendPIN = async () => {
    if (resendCooldown > 0) return;
    
    if (isSendingRef.current || isLoading) {
      console.log('⏳ Already processing, please wait...');
      return;
    }
    
    setError("");
    setIsLoading(true);
    isSendingRef.current = true;

    try {
      const result = await requestPasswordReset(email);
      if (result.success) {
        setError("");
        setResendCooldown(60);
        setPin(["", "", "", "", "", ""]);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
        console.log("✅ PIN resent successfully");
      } else {
        setError(result.error || "Failed to resend PIN. Please try again.");
      }
    } catch (err) {
      console.error("Resend error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const goBack = () => {
    if (showPasswordForm) {
      setShowPasswordForm(false);
      setShowPinForm(true);
      setError("");
    } else if (showPinForm) {
      setShowPinForm(false);
      setShowEmailForm(true);
      setError("");
    } else {
      navigate("/login");
    }
  };

  const handleBackToLogin = () => {
    setShowEmailForm(true);
    setShowPinForm(false);
    setShowPasswordForm(false);
    setSuccess(false);
    setError("");
    setEmail("");
    setPin(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    navigate("/login");
  };

  const pinString = pin.join('');

  return (
    <>
      {/* Styles to hide browser's native password toggle */}
      <style>{`
        /* Hide browser's native password toggle */
        input[type="password"]::-ms-reveal {
          display: none !important;
        }
        
        input[type="password"]::-webkit-textfield-decoration-container {
          display: none !important;
        }
        
        input[type="password"]::-webkit-caps-lock-indicator {
          display: none !important;
        }
        
        input[type="password"]::-webkit-credentials-auto-fill-button {
          display: none !important;
        }
        
        input[type="password"]::-webkit-contacts-auto-fill-button {
          display: none !important;
        }
        
        /* Firefox */
        input[type="password"]::-moz-reveal {
          display: none !important;
        }
      `}</style>

      <div className="min-h-screen w-full overflow-y-auto bg-black/50">
        <div
          className="fixed inset-0 bg-cover bg-center -z-10"
          style={{ backgroundImage: `url(${garciaPaintCenterBg})` }}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <img
                src={paintelligentLogo}
                alt="Paintelligent Logo"
                className="h-20 w-20 object-contain drop-shadow-2xl"
              />
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl px-6 sm:px-8 py-6 sm:py-8">
              {/* ============================================================
                  SUCCESS STATE - Check Animation
                  ============================================================ */}
              {success ? (
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <div className="relative">
                    <div className="absolute rounded-full bg-emerald-400/30" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
                      <CheckCircle className="size-10 animate-[bounce-in_0.6s_ease-out] text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Password Changed!</h3>
                  <p className="text-center text-sm text-white/70">
                    Your password has been successfully updated.
                    <br />
                    <br />
                    <span className="text-white/50 text-xs">
                      Redirecting to login...
                    </span>
                  </p>
                  <button
                    onClick={handleBackToLogin}
                    className="group mt-2 flex w-fit items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:text-white hover:shadow-lg active:scale-95"
                  >
                    <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
                    <span className="relative">
                      Back to Login
                      <span className=" bg-emerald-400 transition-all duration-300 group-hover:w-full" />
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Back Button */}
                  <button
                    onClick={goBack}
                    className="group mb-6 flex w-fit items-center gap-2.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:text-white  active:scale-95"
                  >
                    <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
                    <span className="relative">
                      {showPasswordForm ? "Back to PIN" : showPinForm ? "Back to Email" : "Back to Login"}
                      <span className="absolute bg-emerald-400 transition-all duration-300 group-hover:w-full" />
                    </span>
                  </button>

                  {/* ============================================================
                      EMAIL FORM 
                      ============================================================ */}
                  {showEmailForm && (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <Mail className="size-6 text-[#4a9d6f]" />
                        <h1 className="text-white/90 text-2xl font-semibold">Reset Password</h1>
                      </div>
                      
                      <p className="text-white/60 text-sm mb-6">
                        Enter your email address and we'll send you a 6-digit PIN to reset your password.
                      </p>

                      {error && (
                        <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 mb-4">
                          <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200">{error}</p>
                        </div>
                      )}

                      <form onSubmit={handleSendPIN} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Email Address
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                              placeholder="Enter your email"
                              disabled={isLoading}
                              required
                            />
                          </div>
                          <p className="text-white/40 text-xs mt-1">
                            PIN expires in 10 minutes
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ backgroundColor: "#4a9d6f" }}
                          onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = "#5db888";
                          }}
                          onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = "#4a9d6f";
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-5 animate-spin" />
                              Sending PIN...
                            </>
                          ) : (
                            "Send PIN"
                          )}
                        </button>
                      </form>
                    </>
                  )}

                  {/* ============================================================
                      PIN FORM - 6 Separate Input Fields
                      ============================================================ */}
                  {showPinForm && !success && (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <Key className="size-6 text-[#4a9d6f]" />
                        <h1 className="text-white/90 text-2xl font-semibold">Enter PIN</h1>
                      </div>
                      
                      <p className="text-white/60 text-sm mb-6">
                        We sent a 6-digit PIN to <span className="text-white/80 font-medium">{email}</span>
                      </p>

                      {error && (
                        <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 mb-4">
                          <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200">{error}</p>
                        </div>
                      )}

                      <form onSubmit={handleVerifyPIN} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-3 text-center">
                            Enter 6-Digit PIN
                          </label>
                          <div className="flex justify-center gap-3">
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                              <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                maxLength={1}
                                value={pin[index]}
                                onChange={(e) => handlePinChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="w-12 h-14 text-center text-2xl font-semibold bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a9d6f] focus:border-[#4a9d6f] disabled:opacity-50 transition-all"
                                disabled={isLoading}
                                required
                                autoFocus={index === 0}
                              />
                            ))}
                          </div>
                          <p className="text-white/40 text-xs text-center mt-3">
                            PIN expires in 10 minutes
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <button
                            type="button"
                            onClick={handleResendPIN}
                            disabled={resendCooldown > 0 || isLoading}
                            className="text-[#4a9d6f] hover:text-[#5db888] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend PIN"}
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading || pinString.length !== 6}
                          className="w-full text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ backgroundColor: "#4a9d6f" }}
                          onMouseEnter={(e) => {
                            if (!isLoading && pinString.length === 6) e.currentTarget.style.backgroundColor = "#5db888";
                          }}
                          onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = "#4a9d6f";
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-5 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            "Verify PIN"
                          )}
                        </button>
                      </form>
                    </>
                  )}

                  {/* ============================================================
                      NEW PASSWORD FORM - Clean UI like Register
                      ============================================================ */}
                  {showPasswordForm && !success && (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <Lock className="size-6 text-[#4a9d6f]" />
                        <h1 className="text-white/90 text-2xl font-semibold">New Password</h1>
                      </div>
                      
                      <p className="text-white/60 text-sm mb-6">
                        Enter your new password for <span className="text-white/80 font-medium">{email}</span>
                      </p>

                      {error && (
                        <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 mb-4">
                          <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200">{error}</p>
                        </div>
                      )}

                      <form onSubmit={handleResetPassword} className="space-y-4">
                        {/* New Password */}
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            New Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                            <input
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              value={newPassword}
                              onChange={handlePasswordChange}
                              className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                              placeholder="Create a password (min 6 characters)"
                              disabled={isLoading}
                              required
                              minLength={6}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors z-10"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                            </button>
                          </div>

                          {/* Password Strength Indicator - Same as Register */}
                          {newPassword && !success && (
                            <div className="mt-2 space-y-1">
                              <div className="flex gap-1 h-1.5">
                                {[...Array(5)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-full transition-all duration-300 ${
                                      i < passwordStrength ? getStrengthColor() : "bg-white/20"
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-white/50">Password strength:</span>
                                <span className={`font-medium ${
                                  passwordStrength <= 2 ? "text-red-300" :
                                  passwordStrength <= 3 ? "text-yellow-300" :
                                  passwordStrength <= 4 ? "text-blue-300" :
                                  "text-green-300"
                                }`}>
                                  {getStrengthText()}
                                </span>
                                {passwordStrength < 4 && (
                                  <span className="text-red-300 flex items-center gap-1">
                                    <XCircle className="size-3" />
                                    Too weak
                                  </span>
                                )}
                                {passwordStrength >= 4 && (
                                  <span className="text-green-300 flex items-center gap-1">
                                    <Check className="size-3" />
                                    Good
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-sm font-medium text-white/90 mb-1">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="new-password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                              placeholder="Confirm your password"
                              disabled={isLoading}
                              required
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors z-10"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                            </button>
                          </div>
                          {newPassword && confirmPassword && newPassword === confirmPassword && !success && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-green-300">
                              <Check className="size-3" />
                              Passwords match
                            </div>
                          )}
                          {newPassword && confirmPassword && newPassword !== confirmPassword && !success && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-red-300">
                              <XCircle className="size-3" />
                              Passwords do not match
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading || (newPassword.length > 0 && !isPasswordStrongEnough())}
                          className="w-full text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ backgroundColor: "#4a9d6f" }}
                          onMouseEnter={(e) => {
                            if (!isLoading && isPasswordStrongEnough()) {
                              e.currentTarget.style.backgroundColor = "#5db888";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isLoading) {
                              e.currentTarget.style.backgroundColor = "#4a9d6f";
                            }
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-5 animate-spin" />
                              Resetting Password...
                            </>
                          ) : (
                            "Reset Password"
                          )}
                        </button>
                      </form>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}