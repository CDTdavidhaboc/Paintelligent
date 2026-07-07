import { Outlet, Link, useLocation } from "react-router";
import { BarChart3, Palette, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import garciaLogo from "@/assets/logo.png";

// Garcia Paint Center - Main Layout
export default function Layout() {
  const location = useLocation();
  const { logout, userEmail } = useAuth();

  const [currentDate, setCurrentDate] = useState("");
  const [currentSeason, setCurrentSeason] = useState("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const month = now.toLocaleString("en-US", { month: "long" });
      const day = now.getDate();
      const year = now.getFullYear();
      setCurrentDate(`${month} ${day}, ${year}`);
      const monthIndex = now.getMonth();
      const isDrySeason = monthIndex >= 10 || monthIndex <= 4;
      setCurrentSeason(isDrySeason ? "Dry Season" : "Rainy Season");
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path) => {
    if (path === "/seasonal-forecasting") {
      return location.pathname === "/" || location.pathname === "/seasonal-forecasting";
    }
    return location.pathname === path;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Top Navigation Bar */}
      <header className="bg-[#1a4d2e] text-white shadow-xl flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-3">

          {/* Logo + Greeting */}
          <div className="flex items-center gap-3">
            <img src={garciaLogo} alt="Paintelligent Logo" className="h-10 w-auto object-contain" />
            <div>
              <p className="font-bold text-base leading-tight">Hello, {userEmail || "Admin"}!</p>
              <p className="text-xs text-green-200">{currentSeason} · {currentDate}</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
           <Link
  to="/seasonal-forecasting"
  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
    isActive("/seasonal-forecasting")
      ? "bg-white text-[#1a4d2e] shadow-lg shadow-black/10"
      : "text-green-100 hover:bg-white/10 hover:text-white hover:translate-x-1"
  }`}
>
  <BarChart3
    className={`size-5 transition-transform duration-200 ${
      isActive("/seasonal-forecasting")
        ? "text-[#2d6b45]"
        : "group-hover:scale-110"
    }`}
  />
  <span>Sales Forecasting</span>
</Link>

<Link
  to="/paint-analyzer"
  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
    isActive("/paint-analyzer")
      ? "bg-white text-[#1a4d2e] shadow-lg shadow-black/10"
      : "text-green-100 hover:bg-white/10 hover:text-white hover:translate-x-1"
  }`}
>
  <Palette
    className={`size-5 transition-transform duration-200 ${
      isActive("/paint-analyzer")
        ? "text-[#2d6b45]"
        : "group-hover:rotate-12 group-hover:scale-110"
    }`}
  />
  <span>Paint Analyzer</span>
</Link>
            <Link
  to="/user-profile"
  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
    isActive("/user-profile")
      ? "bg-white text-[#1a4d2e] shadow-lg shadow-black/10"
      : "text-green-100 hover:bg-white/10 hover:text-white hover:translate-x-1"
  }`}
>
  <User
    className={`size-5 transition-transform duration-200 ${
      isActive("/user-profile")
        ? "text-[#2d6b45]"
        : "group-hover:scale-110"
    }`}
  />
  <span>User Profile</span>
</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}