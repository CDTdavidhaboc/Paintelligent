// src/app/components/Layout.tsx
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "@/assets/logo.png";

export default function Layout() {
  const { userEmail } = useAuth();

  // Get user name from email or use default
  const userName = userEmail ? userEmail.split('@')[0] : "New User";
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Get current date
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-[#1a4d2e] border-b border-[#2d6b45] sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Greeting */}
            <div className="flex items-center gap-3">
              <img src={logo} alt="Paintelligent" className="h-8 w-auto" />
              <div>
                <p className="text-sm font-medium text-white">
                  Hello, {displayName}! 😊
                </p>
                <p className="text-xs text-green-300">
                  {month} {day}, {year}
                </p>
              </div>
            </div>
            
            {/* Right: Navigation Links with active states */}
            <div className="flex items-center space-x-8">
              <NavLink 
                to="/" 
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive 
                      ? "text-green-300 font-semibold" 
                      : "text-green-100 hover:text-green-300"
                  }`
                }
                end
              >
                Sales Forecasting
              </NavLink>
              <NavLink 
                to="/paint-analyzer" 
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive 
                      ? "text-green-300 font-semibold" 
                      : "text-green-100 hover:text-green-300"
                  }`
                }
              >
                Paint Analyzer
              </NavLink>
              <NavLink 
                to="/user-profile" 
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive 
                      ? "text-green-300 font-semibold" 
                      : "text-green-100 hover:text-green-300"
                  }`
                }
              >
                User Profile
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content - NO PADDING */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}