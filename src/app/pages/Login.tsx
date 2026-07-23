// src/app/pages/Login.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Lock, 
  User, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Loader2, 
  Mail,
  Shield
} from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }

    try {
      const success = await login(email, password);
      if (success) {
        window.location.href = "/";
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");
    setError("");
    setResetSuccess(false);
    setIsResetLoading(true);

    if (!resetEmail) {
      setError("Please enter your email address.");
      setIsResetLoading(false);
      return;
    }

    try {
      const result = await requestPasswordReset(resetEmail);
      
      if (result.success) {
        setResetSuccess(true);
        setResetMessage(result.message || "A 6-digit PIN has been sent to your email.");
        
        // ✅ Navigate to ResetPassword page after a short delay
        setTimeout(() => {
          setShowForgotPassword(false);
          navigate("/reset-password", { state: { email: resetEmail } });
        }, 1500);
      } else {
        setError(result.error || "Failed to send PIN. Please try again.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden relative flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${garciaPaintCenterBg})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="relative flex justify-center">
          <div className="absolute top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#4a9d6f]/20 blur-3xl" />
          <img
            src={paintelligentLogo}
            alt="Paintelligent Logo"
            className="relative h-64 w-64 object-contain drop-shadow-2xl mb-1"
          />
          <p className="text-sm text-white/70 absolute bottom-3">by Garcia Paint Center</p>
        </div>

        <div className="bg-white/20 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl px-8 py-6 pt-7">
          <h1 className="text-center text-white/90 text-3xl font-semibold mb-4">USER LOGIN</h1>

          <form onSubmit={handleSubmit} className="space-y-1">
            {error && !showForgotPassword && (
              <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-6/13 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 py-3 mb-2 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 mb-1 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="text-right mb-1">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-[#4a9d6f] hover:text-[#5db888] font-medium transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "#4a9d6f" }}
              onMouseEnter={(e) => {
                if (!isLoading) {
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
                  Logging in...
                </>
              ) : (
                "LOGIN"
              )}
            </button>

            <div className="text-center text-white/60 text-sm mt-4">
              Don't have an account?{" "}
              <Link to="/register" className="text-[#4a9d6f] hover:text-[#5db888] font-semibold">
                Register here
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-2">
          A Capstone Project.
        </p>
      </div>

      {/* Forgot Password Modal - Updated to navigate to ResetPassword */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetMessage("");
                setError("");
                setResetSuccess(false);
              }}
              className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors text-2xl"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-6 text-[#4a9d6f]" />
              <h2 className="text-white text-2xl font-semibold">Reset Password</h2>
            </div>
            <p className="text-white/70 text-sm mb-6">
              Enter your email address and we'll send you a 6-digit PIN to reset your password.
            </p>

            {error && (
              <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2 mb-4">
                <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {resetMessage && resetSuccess && (
              <div className="bg-green-500/20 border border-green-300/40 rounded-lg p-3 flex items-start gap-2 mb-4">
                <Mail className="size-5 text-green-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-200">{resetMessage}</p>
                <p className="text-sm text-green-200 ml-auto">
                  Redirecting...
                </p>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-white/90 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50 pointer-events-none" />
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                    placeholder="Enter your email"
                    disabled={isResetLoading || resetSuccess}
                    required
                  />
                </div>
                <p className="text-white/40 text-xs mt-1">
                  PIN expires in 10 minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={isResetLoading || resetSuccess}
                className="w-full text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: "#4a9d6f" }}
                onMouseEnter={(e) => {
                  if (!isResetLoading && !resetSuccess) {
                    e.currentTarget.style.backgroundColor = "#5db888";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResetLoading && !resetSuccess) {
                    e.currentTarget.style.backgroundColor = "#4a9d6f";
                  }
                }}
              >
                {isResetLoading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Sending PIN...
                  </>
                ) : resetSuccess ? (
                  "Sent!"
                ) : (
                  "Send PIN"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetMessage("");
                  setError("");
                  setResetSuccess(false);
                }}
                className="w-full text-center text-white/60 hover:text-white/90 text-sm transition-colors"
              >
                Back to Login
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}