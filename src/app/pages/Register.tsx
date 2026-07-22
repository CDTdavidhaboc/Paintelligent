// src/app/pages/Register.tsx
import { useState } from "react";
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
  XCircle
} from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [emailError, setEmailError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

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

  // Email validation function
  const validateEmail = (email: string) => {
    // Remove leading/trailing spaces
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setEmailError("Email is required");
      return false;
    }

    // Check for spaces
    if (trimmedEmail.includes(' ')) {
      setEmailError("Email cannot contain spaces");
      return false;
    }

    // Check for @ symbol
    if (!trimmedEmail.includes('@')) {
      setEmailError("Email must contain @ symbol");
      return false;
    }

    // Split email into local and domain parts
    const parts = trimmedEmail.split('@');
    if (parts.length !== 2) {
      setEmailError("Invalid email format");
      return false;
    }

    const localPart = parts[0];
    const domainPart = parts[1];

    // Check local part (before @)
    if (localPart.length === 0) {
      setEmailError("Email must have a username before @");
      return false;
    }

    if (localPart.length > 64) {
      setEmailError("Email username is too long (max 64 characters)");
      return false;
    }

    // Check domain part (after @)
    if (domainPart.length === 0) {
      setEmailError("Email must have a domain after @");
      return false;
    }

    if (domainPart.length > 255) {
      setEmailError("Email domain is too long (max 255 characters)");
      return false;
    }

    // Check for consecutive dots
    if (localPart.includes('..') || domainPart.includes('..')) {
      setEmailError("Email cannot contain consecutive dots");
      return false;
    }

    // Check domain has at least one dot
    if (!domainPart.includes('.')) {
      setEmailError("Email domain must contain a dot (e.g., .com, .org)");
      return false;
    }

    // Check domain doesn't start or end with dot
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
      setEmailError("Email domain cannot start or end with a dot");
      return false;
    }

    // Common typos to block
    const commonTypos = [
      'gamil.com', 'gmial.com', 'gmal.com', 'gmil.com', 'gmeil.com',
      'gmail.con', 'gmail.cmo', 'gmail.ocm', 'gmail.cim', 'gmail.c0m',
      'gmai.com', 'gmaill.com', 'gmail.coom', 'gmail.cm', 'gmail.om',
      'hotmail.con', 'hotmail.cmo', 'hotmail.ocm', 'hotmial.com',
      'yahoo.con', 'yahoo.cmo', 'yahoo.ocm', 'yaho.com', 'yhoo.com',
      'outlook.con', 'outlook.cmo', 'outlook.ocm', 'outlok.com',
      'gamil.con', 'gmial.con', 'gmaill.con'
    ];

    // Check for typos in common domains
    const domainLower = domainPart.toLowerCase();
    for (const typo of commonTypos) {
      if (domainLower === typo) {
        setEmailError(`Did you mean ${domainLower.replace(/\.(com|con|cmo|ocm|coom|cm|om)$/, '.com')}? Please correct the typo.`);
        return false;
      }
    }

    // Check for valid TLD (at least 2 characters after the last dot)
    const lastDotIndex = domainPart.lastIndexOf('.');
    const tld = domainPart.substring(lastDotIndex + 1);
    if (tld.length < 2) {
      setEmailError("Invalid domain extension (e.g., .com, .org, .net)");
      return false;
    }

    // Allow only specific TLDs (common ones)
    const validTLDs = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'io', 'co', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'mx', 'it', 'es', 'nl', 'se', 'no', 'fi', 'dk', 'ch', 'at', 'be', 'nz', 'za', 'ru', 'pl', 'tr', 'gr', 'pt', 'ar', 'cl', 'pe', 've', 'co.uk', 'co.in', 'co.jp', 'com.au', 'com.br', 'com.mx', 'net.au'];
    
    // Check if TLD is valid (allow any 2+ letter TLD for flexibility)
    if (tld.length < 2) {
      setEmailError("Invalid email domain");
      return false;
    }

    // Clear error if all validations pass
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (fullName.length < 2) {
      setError("Please enter your full name.");
      setIsLoading(false);
      return;
    }

    // Validate email before submission
    if (!validateEmail(email)) {
      setError(emailError || "Please enter a valid email address.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    if (!isPasswordStrongEnough()) {
      setError("Please choose a stronger password. Try using a mix of uppercase, lowercase, numbers, and special characters.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, fullName);
      
      if (result.success) {
        setSuccess(true);
        setError("");
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setPasswordStrength(0);
        setEmailError("");
        setTimeout(() => {
          navigate("/login", { state: { registrationSuccess: true } });
        }, 3000);
      } else {
        setError(result.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden relative flex items-center justify-center p-4">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${garciaPaintCenterBg})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Content - Two Column Layout */}
      <div className="w-full max-w-5xl relative z-10 flex gap-12 items-center">
        {/* Left Column - Info/Branding */}
        <div className="hidden lg:flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-120 w-120 rounded-full bg-[#4a9d6f]/20 blur-3xl" />
            <img
              src={paintelligentLogo}
              alt="Paintelligent Logo"
              className="relative h-60 w-60 object-contain drop-shadow-2xl"
            />
          </div>
          <h2 className="text-white text-3xl font-bold">Welcome to Paintelligent</h2>
          <p className="text-white/70 text-lg mt-2 max-w-sm">
            Create your account and start visualizing your data with AI-powered insights.
          </p>
          <div className="mt-8 space-y-3 text-left w-full max-w-sm">
            <div className="flex items-center gap-3 text-white/80">
              <div className="p-1.5 bg-[#4a9d6f]/30 rounded-lg">
                <Shield className="size-4 text-[#4a9d6f]" />
              </div>
              <span className="text-sm">Secure & encrypted data</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="p-1.5 bg-[#4a9d6f]/30 rounded-lg">
                <Sparkles className="size-4 text-[#4a9d6f]" />
              </div>
              <span className="text-sm">AI-powered paint analysis</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="p-1.5 bg-[#4a9d6f]/30 rounded-lg">
                <Check className="size-4 text-[#4a9d6f]" />
              </div>
              <span className="text-sm">Real-time inventory tracking</span>
            </div>
          </div>
          <p className="text-white/40 text-sm mt-8 text-center">
            A Capstone Project by David, Trisha & Lawrence<br> with the track of Business Analytics.</br>
          </p>
        </div>

        {/* Right Column - Registration Form */}
        <div className="flex-1 max-w-lg">
          <div className="lg:hidden flex justify-center mb-4">
            <img
              src={paintelligentLogo}
              alt="Paintelligent Logo"
              className="h-24 w-24 object-contain drop-shadow-2xl"
            />
          </div>

          <div className="bg-white/20 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl px-8 py-8">
            <div className="lg:hidden text-center mb-4">
              <h1 className="text-white/90 text-2xl font-semibold">CREATE ACCOUNT</h1>
              <p className="text-white/60 text-sm">Sign up to get started</p>
            </div>

            <div className="hidden lg:block mb-6">
              <h1 className="text-white/90 text-3xl font-semibold">Create Account</h1>
              <p className="text-white/60 text-sm mt-1">Sign up to get started with Paintelligent</p>
            </div>

            {success && (
              <div className="bg-green-500/20 border border-green-300/40 rounded-lg p-4 mb-4 text-center animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-center gap-2 text-green-300">
                  <CheckCircle2 className="size-6" />
                  <span className="font-semibold">Registration successful!</span>
                </div>
                <p className="text-green-200 text-sm mt-1">Redirecting to login...</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-white/90 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50 transition-all"
                    placeholder="Enter your full name"
                    disabled={isLoading || success}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50 transition-all ${
                      emailError ? 'border-red-400/60' : 'border-white/30'
                    }`}
                    placeholder="Enter your email"
                    disabled={isLoading || success}
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

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50 transition-all"
                    placeholder="Create a password (min 6 characters)"
                    disabled={isLoading || success}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading || success}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && !success && (
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
                    {passwordStrength < 4 && (
                      <p className="text-[10px] text-white/50 mt-1">
                        Use a mix of uppercase, lowercase, numbers, and special characters
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/90 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50 transition-all"
                    placeholder="Confirm your password"
                    disabled={isLoading || success}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading || success}
                  >
                    {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {password && confirmPassword && password === confirmPassword && !success && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-green-300">
                    <Check className="size-3" />
                    Passwords match
                  </div>
                )}
                {password && confirmPassword && password !== confirmPassword && !success && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-300">
                    <XCircle className="size-3" />
                    Passwords do not match
                  </div>
                )}
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={isLoading || success || (password.length > 0 && !isPasswordStrongEnough()) || !!emailError}
                className="w-full mt-2 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: "#4a9d6f" }}
                onMouseEnter={(e) => {
                  if (!isLoading && !success && isPasswordStrongEnough() && !emailError) {
                    e.currentTarget.style.backgroundColor = "#5db888";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && !success) {
                    e.currentTarget.style.backgroundColor = "#4a9d6f";
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-5 " />
                    CREATE ACCOUNT
                  </>
                )}
              </button>

              {/* Login Link */}
              <div className="text-center text-white/60 text-sm">
                Already have an account?{" "}
                <Link to="/login" className="text-[#4a9d6f] hover:text-[#5db888] font-semibold transition-colors">
                  Login here
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}