import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Lock, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import paintelligentLogo from "@/assets/logo.png";
import garciaPaintCenterBg from "@/assets/garciapaintcenter.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
const VALID_USERNAME = import.meta.env.VITE_APP_USERNAME;
const VALID_PASSWORD = import.meta.env.VITE_APP_PASSWORD;
const { login } = useAuth();
  const handleSubmit = (e) => {
  e.preventDefault();

  setError("");

  if (
    email === VALID_USERNAME &&
    password === VALID_PASSWORD
  ) {

    login(); // <-- VERY IMPORTANT

    navigate("/");

  } else {

    setError("Invalid username or password. Please try again.");

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
        <div className="flex flex-col items-center relative mb-2">
          <img src={paintelligentLogo} alt="Paintelligent Logo" className="w-56 h-56 mb-2    object-contain drop-shadow-2xl" />
          <p className="text-sm text-white/70 absolute bottom-2">by Garcia Paint Center</p>
        </div>

        {/* Glass Card */}
        <div className="bg-white/20 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl px-8 py-8">
          <h1 className="text-center text-white/90 text-3xl font-semibold mb-6">USER LOGIN</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/20 border border-red-300/40 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="size-5 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  placeholder="Enter your username"
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
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
              style={{ backgroundColor: "#4a9d6f" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5db888")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4a9d6f")}
            >
              LOGIN
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-4">
          © 2026 Garcia Paint Center. All rights reserved.
        </p>
      </div>
    </div>
  );
}
