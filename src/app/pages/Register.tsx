// src/app/pages/Register.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, User, Mail, AlertCircle, Eye, EyeOff, Loader2, CheckCircle2, UserPlus } from "lucide-react";
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
  const { register } = useAuth();
  const navigate = useNavigate();

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

    // Email validation
    if (!email.includes('@') || !email.includes('.')) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, fullName);
      
      if (result.success) {
        setSuccess(true);
        setError("");
        // Clear form
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        // Show success message for 3 seconds then redirect to login
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

      {/* Content */}
      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="relative flex justify-center">
          <div className="absolute top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#4a9d6f]/20 blur-3xl" />
          <img
            src={paintelligentLogo}
            alt="Paintelligent Logo"
            className="relative h-48 w-48 object-contain drop-shadow-2xl"
          />
          <p className="text-sm text-white/70 absolute bottom-3">by Garcia Paint Center</p>
        </div>

        {/* Glass Card */}
        <div className="bg-white/20 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl px-8 py-6">
          <h1 className="text-center text-white/90 text-3xl font-semibold mb-2">CREATE ACCOUNT</h1>
          <p className="text-center text-white/60 text-sm mb-6">Sign up to get started with Paintelligent</p>

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/20 border border-green-300/40 rounded-lg p-4 mb-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-300">
                <CheckCircle2 className="size-6" />
                <span className="font-semibold">Registration successful!</span>
              </div>
              <p className="text-green-200 text-sm mt-1">Redirecting to login...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                  placeholder="Enter your email"
                  disabled={isLoading || success}
                  required
                />
              </div>
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
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
                  className="w-full pl-10 pr-12 py-2.5 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
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
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full mt-2 text-white py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "#4a9d6f" }}
              onMouseEnter={(e) => {
                if (!isLoading && !success) {
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
                  <UserPlus className="size-5" />
                  REGISTER
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

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-4">
          © 2026 Garcia Paint Center. All rights reserved.
        </p>
      </div>
    </div>
  );
}