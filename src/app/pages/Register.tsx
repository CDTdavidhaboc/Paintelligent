import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Lock, 
  User, 
  Mail, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  UserPlus,
  Shield,
  Check,
  Sparkles,
  XCircle,
  Key,
  Send
} from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [emailError, setEmailError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationError, setVerificationError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  
  const { register, verifyRegistrationCode, resendVerificationCode } = useAuth();
  const navigate = useNavigate();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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
    setPassword(value);
    checkPasswordStrength(value);
  };

  const validateEmail = (email: string) => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setEmailError("Email is required");
      return false;
    }

    if (trimmedEmail.includes(' ')) {
      setEmailError("Email cannot contain spaces");
      return false;
    }

    if (!trimmedEmail.includes('@')) {
      setEmailError("Email must contain @ symbol");
      return false;
    }

    const parts = trimmedEmail.split('@');
    if (parts.length !== 2) {
      setEmailError("Invalid email format");
      return false;
    }

    const localPart = parts[0];
    const domainPart = parts[1];

    if (localPart.length === 0) {
      setEmailError("Email must have a username before @");
      return false;
    }

    if (localPart.length > 64) {
      setEmailError("Email username is too long (max 64 characters)");
      return false;
    }

    if (domainPart.length === 0) {
      setEmailError("Email must have a domain after @");
      return false;
    }

    if (domainPart.length > 255) {
      setEmailError("Email domain is too long (max 255 characters)");
      return false;
    }

    if (localPart.includes('..') || domainPart.includes('..')) {
      setEmailError("Email cannot contain consecutive dots");
      return false;
    }

    if (!domainPart.includes('.')) {
      setEmailError("Email domain must contain a dot (e.g., .com, .org)");
      return false;
    }

    if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
      setEmailError("Email domain cannot start or end with a dot");
      return false;
    }

    const commonTypos = [
      'gamil.com', 'gmial.com', 'gmal.com', 'gmil.com', 'gmeil.com',
      'gmail.con', 'gmail.cmo', 'gmail.ocm', 'gmail.cim', 'gmail.c0m',
      'gmai.com', 'gmaill.com', 'gmail.coom', 'gmail.cm', 'gmail.om',
      'hotmail.con', 'hotmail.cmo', 'hotmail.ocm', 'hotmial.com',
      'yahoo.con', 'yahoo.cmo', 'yahoo.ocm', 'yaho.com', 'yhoo.com',
      'outlook.con', 'outlook.cmo', 'outlook.ocm', 'outlok.com',
      'gamil.con', 'gmial.con', 'gmaill.con'
    ];

    const domainLower = domainPart.toLowerCase();
    for (const typo of commonTypos) {
      if (domainLower === typo) {
        setEmailError(`Did you mean ${domainLower.replace(/\.(com|con|cmo|ocm|coom|cm|om)$/, '.com')}? Please correct the typo.`);
        return false;
      }
    }

    const lastDotIndex = domainPart.lastIndexOf('.');
    const tld = domainPart.substring(lastDotIndex + 1);
    if (tld.length < 2) {
      setEmailError("Invalid domain extension (e.g., .com, .org, .net)");
      return false;
    }

    setEmailError("");
    return true;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value) {
      validateEmail(value);
    } else {
      setEmailError("");
    }
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

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };

  // STEP 1: SEND VERIFICATION CODE
  const handleSendCode = async () => {
    setVerificationError("");
    setError("");
    
    if (!fullName) {
      setVerificationError("Please enter your full name.");
      return;
    }
    
    if (!email) {
      setVerificationError("Please enter your email address.");
      return;
    }
    
    if (!validateEmail(email)) {
      setVerificationError(emailError || "Please enter a valid email address.");
      return;
    }
    
    if (!password) {
      setVerificationError("Please enter a password.");
      return;
    }
    
    if (!isPasswordStrongEnough()) {
      setVerificationError("Please choose a stronger password.");
      return;
    }
    
    if (password !== confirmPassword) {
      setVerificationError("Passwords do not match.");
      return;
    }
    
    setIsSendingCode(true);

    try {
      const result = await register(email, password, fullName);
      
      if (result.success) {
        if (result.requiresVerification) {
          setIsCodeSent(true);
          setError("");
          setResendCooldown(60);
          setVerificationCode("");
          setIsSendingCode(false);
          console.log("✅ Verification code sent to email");
          setTimeout(() => {
            codeInputRef.current?.focus();
          }, 100);
        } else {
          setSuccess(true);
          setError("");
          setTimeout(() => {
            navigate("/login", { state: { registrationSuccess: true } });
          }, 3000);
        }
      } else {
        setError(result.error || "Failed to send verification code. Please try again.");
        setIsSendingCode(false);
      }
    } catch (err) {
      console.error("Send code error:", err);
      setError("An error occurred. Please try again.");
      setIsSendingCode(false);
    }
  };

  // STEP 2: VERIFY CODE AND CREATE ACCOUNT
  const handleVerifyAndRegister = async () => {
    setVerificationError("");
    setIsVerifying(true);

    if (!verificationCode || verificationCode.length !== 6) {
      setVerificationError("Please enter a valid 6-digit verification code.");
      setIsVerifying(false);
      return;
    }

    try {
      const result = await verifyRegistrationCode(email, verificationCode);
      
      if (result.success) {
        setSuccess(true);
        setVerificationError("");
        setVerificationCode("");
        setTimeout(() => {
          navigate("/login", { state: { registrationSuccess: true } });
        }, 3000);
      } else {
        setVerificationError(result.error || "Invalid verification code. Please try again.");
        setVerificationCode("");
        setIsVerifying(false);
        setTimeout(() => {
          codeInputRef.current?.focus();
        }, 100);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError("An error occurred during verification. Please try again.");
      setIsVerifying(false);
    }
  };

  // RESEND VERIFICATION CODE
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !email) return;

    try {
      const result = await resendVerificationCode(email);
      if (result.success) {
        setResendCooldown(60);
        setVerificationError("");
        setVerificationCode("");
        console.log("✅ Verification code resent");
        setTimeout(() => {
          codeInputRef.current?.focus();
        }, 100);
      } else {
        setVerificationError(result.error || "Failed to resend code. Please try again.");
      }
    } catch (err) {
      console.error("Resend error:", err);
      setVerificationError("An error occurred. Please try again.");
    }
  };

  const isFormValid = () => {
    return (
      fullName &&
      email &&
      !emailError &&
      password &&
      isPasswordStrongEnough() &&
      confirmPassword &&
      password === confirmPassword &&
      verificationCode.length === 6
    );
  };

  return (
    <>
      <style>{`
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
        
        input[type="password"]::-moz-reveal {
          display: none !important;
        }
      `}</style>

      {/* ✅ Same fullscreen layout as Login */}
      <div className="h-screen overflow-hidden relative flex items-center justify-center p-5">
        {/* ✅ Same background as Login */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${garciaPaintCenterBg})` }}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>

        {/* ✅ 2-Column Layout - Same as Login */}
        <div className="w-full max-w-4xl relative z-10 flex gap-8 items-center justify-center">
          
          {/* ✅ Left Column - Info/Branding (Same as Login) */}
          <div className="hidden lg:flex flex-col items-center text-center pt-4">
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-[#4a9d6f]/20 blur-3xl" />
              <img
                src={paintelligentLogo}
                alt="Paintelligent Logo"
                className="relative h-40 w-40 object-contain drop-shadow-2xl"
              />
            </div>
            <h2 className="text-white text-2xl font-bold mt-2">Welcome to Paintelligent</h2>
            <p className="text-white/70 text-sm mt-1 max-w-sm text-center">
              Create your account and start visualizing your data with AI-powered insights.
            </p>
            <div className="mt-4 space-y-2 w-full max-w-sm">
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <div className="p-1 bg-[#4a9d6f]/30 rounded-lg flex-shrink-0">
                  <Shield className="size-3.5 text-[#4a9d6f]" />
                </div>
                <span>Secure & encrypted data</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <div className="p-1 bg-[#4a9d6f]/30 rounded-lg flex-shrink-0">
                  <Sparkles className="size-3.5 text-[#4a9d6f]" />
                </div>
                <span>AI-powered paint analysis</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <div className="p-1 bg-[#4a9d6f]/30 rounded-lg flex-shrink-0">
                  <Check className="size-3.5 text-[#4a9d6f]" />
                </div>
                <span>Real-time inventory tracking</span>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-4 text-center">
              A Capstone Project for Garcia Paint Center.
            </p>
          </div>

          {/* ✅ Right Column - Registration Form (Same card style as Login) */}
          <div className="flex-1 max-w-lg">
            <div className="lg:hidden flex justify-center mb-3">
              <img
                src={paintelligentLogo}
                alt="Paintelligent Logo"
                className="h-16 w-16 object-contain drop-shadow-2xl"
              />
            </div>

            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl px-8 py-6 pt-7">
              <h1 className="text-center text-white/90 text-3xl font-semibold mb-4">CREATE ACCOUNT</h1>

              {success ? (
                <div className="bg-green-500/20 border border-green-300/40 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-300">
                    <CheckCircle2 className="size-7" />
                    <span className="font-semibold text-base">Account Verified!</span>
                  </div>
                  <p className="text-green-200 text-sm mt-1">
                    Your email has been successfully verified.
                  </p>
                  <p className="text-green-200/70 text-xs mt-1">Redirecting to login...</p>
                </div>
              ) : (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-200">{error}</p>
                    </div>
                  )}

                  {verificationError && (
                    <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-200">{verificationError}</p>
                    </div>
                  )}

                  {/* ✅ Full Name - Same as Login input style */}
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-white/90 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 py-3 bg-black/10 border border-white/30 hover:border-green-300 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 disabled:opacity-50"
                        placeholder="Enter your full name"
                        disabled={isLoading || isSendingCode}
                        required
                      />
                    </div>
                  </div>

                  {/* ✅ Email - Same as Login input style */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        className={`w-full pl-10 py-3 bg-black/10 border text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 disabled:opacity-50 ${
                          emailError ? 'border-red-400/60' : 'border-white/30 hover:border-green-300'
                        }`}
                        placeholder="Enter your email"
                        disabled={isLoading || isSendingCode}
                        required
                      />
                      {email && !emailError && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Check className="size-5 text-green-400" />
                        </div>
                      )}
                    </div>
                    {emailError && (
                      <p className="mt-1 text-xs text-red-300 flex items-center gap-1">
                        <XCircle className="size-3" />
                        {emailError}
                      </p>
                    )}
                    {email && !emailError && (
                      <p className="mt-1 text-xs text-green-300 flex items-center gap-1">
                        <Check className="size-3" />
                        Valid email address
                      </p>
                    )}
                  </div>

                  {/* ✅ Password - Same as Login input style */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={handlePasswordChange}
                        className="w-full pl-10 pr-12 py-3 bg-black/10 border border-white/30 hover:border-green-300 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 disabled:opacity-50"
                        placeholder="Create a password (min 6 characters)"
                        disabled={isLoading || isSendingCode}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 z-10"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading || isSendingCode}
                      >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>

                    {password && (
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
                          <span className="text-white/40">Strength:</span>
                          <span className={`text-xs font-medium ${
                            passwordStrength <= 2 ? "text-red-300" :
                            passwordStrength <= 3 ? "text-yellow-300" :
                            passwordStrength <= 4 ? "text-blue-300" :
                            "text-green-300"
                          }`}>
                            {getStrengthText()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ✅ Confirm Password - Same as Login input style */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/90 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-black/10 border border-white/30 hover:border-green-300 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 disabled:opacity-50"
                        placeholder="Confirm your password"
                        disabled={isLoading || isSendingCode}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 z-10"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isLoading || isSendingCode}
                      >
                        {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                    {password && confirmPassword && password === confirmPassword && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-green-300">
                        <Check className="size-3" />
                        <span>Passwords match</span>
                      </div>
                    )}
                    {password && confirmPassword && password !== confirmPassword && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-red-300">
                        <XCircle className="size-3" />
                        <span>Passwords do not match</span>
                      </div>
                    )}
                  </div>

                  {/* Verification Code Section */}
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2">
                      
                     
                      
                    </div>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          ref={codeInputRef}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={verificationCode}
                          onChange={handleCodeChange}
                          className="w-full px-4 py-3 bg-black/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a9d6f] focus:border-[#4a9d6f] disabled:opacity-50 transition-all text-left text-md"
                          placeholder="6-digit code"
                          disabled={isLoading || isVerifying || success || isSendingCode}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={isSendingCode || isCodeSent || !email || !!emailError || isLoading || !fullName || !password || password !== confirmPassword || !isPasswordStrongEnough()}
                        className="px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-[#4a9d6f] text-white hover:bg-[#5db888] text-sm whitespace-nowrap"
                      >
                        {isSendingCode ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : isCodeSent ? (
                          <>
                            <Check className="size-4" />
                            <span>Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="size-4" />
                            <span>Send Code</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-white/40">
                        {isCodeSent ? (
                          <span>Code expires in 10 minutes</span>
                        ) : (
                          <span>Click Send Code to get a 6-digit code</span>
                        )}
                      </div>
                      {isCodeSent && (
                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={resendCooldown > 0 || isVerifying}
                          className="text-[#4a9d6f] hover:text-[#5db888] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ✅ CREATE ACCOUNT Button - Same as Login button style */}
                  <button
                    type="button"
                    onClick={handleVerifyAndRegister}
                    disabled={!isFormValid() || isVerifying || isLoading}
                    className="w-full mt-2 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: isFormValid() ? "#4a9d6f" : "#4a9d6f" }}
                    onMouseEnter={(e) => {
                      if (isFormValid() && !isVerifying && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#5db888";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isVerifying && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#4a9d6f";
                      }
                    }}
                  >
                    {isVerifying || isLoading ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-5" />
                        <span>CREATE ACCOUNT</span>
                      </>
                    )}
                  </button>

                  {/* ✅ Login link - Same as Login */}
                  <div className="text-center text-white/60 text-sm mt-4">
                    Already have an account?{" "}
                    <Link to="/login" className="text-[#4a9d6f] hover:text-[#5db888] font-semibold">
                      Login here
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}