// src/app/components/Layout.tsx
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { getUserData } from "../lib/supabase";
import logo from "@/assets/logo.png";

export default function Layout() {
  const { userEmail } = useAuth();
  const [userName, setUserName] = useState<string>("Loading...");

  // Load user name from Supabase first, then localStorage
  const loadUserName = async () => {
    console.log("🔄 Loading user name for:", userEmail);
    
    if (!userEmail) {
      console.log("❌ No user email, setting to Guest");
      setUserName("Guest");
      return;
    }

    // FIRST: Try to load from Supabase (source of truth)
    try {
      const userData = await getUserData(userEmail);
      if (userData) {
        // Check for full_name first, then fallback to name
        const name = userData.full_name || userData.name;
        if (name) {
          console.log("✅ Loaded name from Supabase:", name);
          setUserName(name);
          
          // Cache in localStorage for faster loading
          const userDataKey = `user_${userEmail}_profileData`;
          localStorage.setItem(userDataKey, JSON.stringify({ name: name }));
          
          return;
        }
      }
    } catch (error) {
      console.error("Error loading from Supabase:", error);
    }

    // SECOND: Try localStorage
    const userDataKey = `user_${userEmail}_profileData`;
    let savedData = localStorage.getItem(userDataKey);

    if (!savedData) {
      savedData = localStorage.getItem("userProfileData");
    }

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.name) {
          console.log("✅ Loaded name from storage:", parsedData.name);
          setUserName(parsedData.name);
          return;
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }

    // Fallback: use email
    if (userEmail) {
      const emailName = userEmail.split('@')[0];
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      console.log("ℹ️ Using email fallback:", displayName);
      setUserName(displayName);
    }
  };

  // Load when userEmail changes
  useEffect(() => {
    loadUserName();
  }, [userEmail]);

  // Listen for storage events (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userEmail' || e.key === 'isAuthenticated') {
        console.log("📥 Storage event - reloading user name");
        loadUserName();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userEmail]);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = () => {
      console.log("📥 Profile update event - reloading user name");
      loadUserName();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [userEmail]);

  // Listen for page visibility changes (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("👀 Page became visible - reloading user name");
        loadUserName();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userEmail]);

  // Get current date
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-[#1a4d2e] border-b border-[#2d6b45] sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Paintelligent" className="h-8 w-auto" />
              <div>
                <p className="text-sm font-medium text-white">
                  Hello, {userName}! 😊
                </p>
                <p className="text-xs text-green-300">
                  {month} {day}, {year}
                </p>
              </div>
            </div>
            
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

      <main>
        <Outlet />
      </main>
    </div>
  );
}