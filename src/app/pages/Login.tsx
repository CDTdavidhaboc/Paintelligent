// src/app/pages/Login.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, User, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

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

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 disabled:opacity-50"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-8 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

            <div className="text-center text-white/60 text-sm">
              Don't have an account?{" "}
              <Link to="/register" className="text-[#4a9d6f] hover:text-[#5db888] font-semibold">
                Register here
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-4">
          © 2026 Garcia Paint Center. All rights reserved.
        </p>
      </div>
    </div>
  );
}