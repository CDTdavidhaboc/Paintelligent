// src/app/components/Layout.tsx
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { getUserData } from "../lib/supabase";
import { 
  Menu, 
  X,
  CalendarDays,
  LineChart,
  Paintbrush,
  User,
  CloudRain,
  Sun,
  Cloud,
  Droplets,
} from "lucide-react";
import logo from "@/assets/logo.png";

export default function Layout() {
  const { userEmail } = useAuth();
  const [userName, setUserName] = useState<string>("Loading...");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [season, setSeason] = useState<{ name: string; icon: JSX.Element; description: string }>({
    name: "Dry Season",
    icon: <Sun className="size-3 text-yellow-300" />,
    description: "Sunny weather"
  });

  // Load user name from Supabase first, then localStorage
  const loadUserName = async () => {
    console.log("🔄 Loading user name for:", userEmail);
    
    if (!userEmail) {
      console.log("❌ No user email, setting to Guest");
      setUserName("Guest");
      return;
    }

    try {
      const userData = await getUserData(userEmail);
      if (userData) {
        const name = userData.full_name || userData.name;
        if (name) {
          console.log("✅ Loaded name from Supabase:", name);
          setUserName(name);
          const userDataKey = `user_${userEmail}_profileData`;
          localStorage.setItem(userDataKey, JSON.stringify({ name: name }));
          return;
        }
      }
    } catch (error) {
      console.error("Error loading from Supabase:", error);
    }

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

    if (userEmail) {
      const emailName = userEmail.split('@')[0];
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      console.log("ℹ️ Using email fallback:", displayName);
      setUserName(displayName);
    }
  };

  // Determine season based on month (Philippines - wet/dry seasons)
  const getSeason = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    
    // Philippine seasons based on months
    // Dry Season: November to April
    // Wet Season: May to October
    if (month >= 11 || month <= 4) {
      // Check if it's peak dry season (Feb-Apr)
      if (month >= 2 && month <= 4) {
        return {
          name: "Dry Season",
          icon: <Sun className="size-3 text-yellow-300" />,
          description: "Hot and dry weather"
        };
      }
      return {
        name: "Cool Dry Season",
        icon: <Cloud className="size-3 text-blue-300" />,
        description: "Cool and dry weather"
      };
    } else {
      // Check if it's peak wet season (Jul-Sep)
      if (month >= 7 && month <= 9) {
        return {
          name: "Rainy Season",
          icon: <CloudRain className="size-3 text-blue-300" />,
          description: "Heavy rainfall expected"
        };
      }
      return {
        name: "Wet Season",
        icon: <Droplets className="size-3 text-blue-300" />,
        description: "Occasional rain showers"
      };
    }
  };

  useEffect(() => {
    setSeason(getSeason());
  }, []);

  useEffect(() => {
    loadUserName();
  }, [userEmail]);

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

  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();

  const navItems = [
    { path: "/", icon: LineChart, label: "Sales Forecasting" },
    { path: "/paint-analyzer", icon: Paintbrush, label: "Paint Analyzer" },
    { path: "/user-profile", icon: User, label: "User Profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-[#1a4d2e] border-b border-[#2d6b45] sticky top-0 z-50 shadow-lg">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Greeting */}
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden text-white hover:text-green-200 transition-colors p-2 rounded-lg hover:bg-white/10"
              >
                {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>

              <div className="flex items-center gap-2">
                <img src={logo} alt="Paintelligent" className="h-8 w-auto" />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white flex items-center gap-1">
                    Hello, {userName}! 😊
                  </p>
                  <p className="text-xs text-green-300 flex items-center gap-2">
                    <CalendarDays className="size-3" />
                    {month} {day}, {year}
                    <span className="w-px h-3 bg-green-500/50 mx-1"></span>
                    <span className="flex items-center gap-1">
                      {season.icon}
                      <span className="text-green-300/80">{season.name}</span>
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Right: Navigation Links */}
            <div className="flex items-center gap-2">
              {/* Desktop Navigation */}
              <div className="flex items-center gap-1">
                {navItems.map((item) => (
                  <NavLink 
                    key={item.path}
                    to={item.path} 
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive 
                          ? "bg-white/20 text-white shadow-lg" 
                          : "text-green-100 hover:text-white hover:bg-white/10"
                      }`
                    }
                    end={item.path === "/"}
                  >
                    <item.icon className="size-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="lg:hidden py-3 space-y-1 border-t border-white/10 animate-in slide-in-from-top-2 duration-200">
              {navItems.map((item) => (
                <NavLink 
                  key={item.path}
                  to={item.path} 
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "text-green-100 hover:text-white hover:bg-white/10"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                  end={item.path === "/"}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}