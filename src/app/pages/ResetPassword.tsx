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
  Key
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
    resetPasswordWithPIN 
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
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Handle PIN input change
  const handlePinChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-advance to next input
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
    setError("");
    setIsLoading(true);

    if (!email) {
      setError("Please enter your email address.");
      setIsLoading(false);
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
    }
  };

  // Step 2: Verify PIN
  const handleVerifyPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const pinString = pin.join('');
    if (!pinString || pinString.length !== 6) {
      setError("Please enter a valid 6-digit PIN.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await verifyPIN(email, pinString);
      
      if (result.success) {
        setShowEmailForm(false);
        setShowPinForm(false);
        setShowPasswordForm(true);
        setError("");
        console.log("✅ PIN verified successfully");
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
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const pinString = pin.join('');
      const result = await resetPasswordWithPIN(email, pinString, newPassword);
      
      if (result.success) {
        setSuccess(true);
        setError("");
        console.log("✅ Password reset successful");
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setError(result.error || "Failed to reset password. Please try again.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend PIN
  const handleResendPIN = async () => {
    if (resendCooldown > 0) return;
    
    setError("");
    setIsLoading(true);

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

  const pinString = pin.join('');

  return (
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
            {/* Back Button */}
            <button
              onClick={goBack}
              className="text-white/60 hover:text-white/90 transition-colors mb-4 flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="size-4" />
              {showPasswordForm ? "Back to PIN" : showPinForm ? "Back to Email" : "Back to Login"}
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

                {success && (
                  <div className="bg-green-500/20 border border-green-300/40 rounded-lg p-4 mb-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-300">
                      <CheckCircle className="size-6" />
                      <span className="font-semibold">Password updated successfully!</span>
                    </div>
                    <p className="text-green-200 text-sm mt-1">Redirecting to login...</p>
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
                      ⏱️ PIN expires in 10 minutes
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
                NEW PASSWORD FORM
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
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                        placeholder="Enter new password (min 6 characters)"
                        disabled={isLoading}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                        placeholder="Confirm your password"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
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
                        Resetting Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 text-center">
              <Link to="/login" className="text-white/40 hover:text-white/60 text-sm transition-colors">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}