// src/components/Layout.tsx

import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeather } from "../context/WeatherContext";
import { useState, useEffect, useCallback } from "react";
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
  Wind,
  RefreshCw,
  Thermometer,
  Gauge,
  Eye,
} from "lucide-react";
import logo from "@/assets/logo.png";

export default function Layout() {
  const { userEmail } = useAuth();
  const { weather, isLoading: weatherLoading, error: weatherError } = useWeather();
  const [userName, setUserName] = useState<string>("Loading...");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWeatherTooltip, setShowWeatherTooltip] = useState(false);
  const [season, setSeason] = useState<{ name: string; icon: JSX.Element; description: string }>({
    name: "Dry Season",
    icon: <Sun className="size-3 text-yellow-300" />,
    description: "Sunny weather"
  });

  // ============================================================
  // USER NAME FUNCTIONS
  // ============================================================

  const loadUserName = useCallback(async () => {
    console.log("🔄 Loading user name for:", userEmail);
    
    if (!userEmail) {
      console.log("❌ No user email, setting to Guest");
      setUserName("Guest");
      return;
    }

    const userNameKey = `user_${userEmail}_userName`;
    const savedName = localStorage.getItem(userNameKey);
    
    if (savedName) {
      console.log("✅ Found saved name in localStorage:", savedName);
      setUserName(savedName);
      return;
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
          console.log("✅ Loaded name from profile data:", parsedData.name);
          setUserName(parsedData.name);
          localStorage.setItem(userNameKey, parsedData.name);
          return;
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }

    try {
      const userData = await getUserData(userEmail);
      if (userData) {
        const name = userData.full_name || userData.name;
        if (name) {
          console.log("✅ Loaded name from Supabase:", name);
          setUserName(name);
          localStorage.setItem(userNameKey, name);
          return;
        }
      }
    } catch (error) {
      console.error("Error loading from Supabase:", error);
    }

    if (userEmail) {
      const emailName = userEmail.split('@')[0];
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      console.log("ℹ️ Using email fallback:", displayName);
      setUserName(displayName);
    }
  }, [userEmail]);

  // ============================================================
  // SEASON DETECTION
  // ============================================================

  const getSeason = useCallback(() => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    
    if (month >= 11 || month <= 4) {
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
  }, []);

  // ============================================================
  // WEATHER ICON HELPER
  // ============================================================

  const getWeatherIcon = (main: string, size: string = "size-4") => {
    switch (main.toLowerCase()) {
      case 'clear':
        return <Sun className={`${size} text-yellow-300`} />;
      case 'clouds':
        return <Cloud className={`${size} text-blue-300`} />;
      case 'rain':
      case 'drizzle':
        return <CloudRain className={`${size} text-blue-400`} />;
      case 'thunderstorm':
        return <CloudRain className={`${size} text-purple-400`} />;
      case 'snow':
        return <Droplets className={`${size} text-white`} />;
      case 'mist':
      case 'fog':
      case 'haze':
        return <Cloud className={`${size} text-gray-300`} />;
      default:
        return <Sun className={`${size} text-yellow-300`} />;
    }
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  // Set season
  useEffect(() => {
    setSeason(getSeason());
  }, [getSeason]);

  // Load user name
  useEffect(() => {
    loadUserName();
  }, [userEmail, loadUserName]);

  // Profile update event listener
  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      console.log("📥 Profile update event received");
      
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.name) {
        console.log("✅ Immediately updating name to:", customEvent.detail.name);
        setUserName(customEvent.detail.name);
        
        if (userEmail) {
          const userNameKey = `user_${userEmail}_userName`;
          localStorage.setItem(userNameKey, customEvent.detail.name);
        }
      } else {
        console.log("ℹ️ No name in event, reloading from storage");
        loadUserName();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [userEmail, loadUserName]);

  // Storage change listener for multi-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `user_${userEmail}_userName` || e.key === 'userName') {
        console.log("📥 Storage changed, reloading name");
        loadUserName();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userEmail, loadUserName]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.weather-tooltip-container')) {
        setShowWeatherTooltip(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();

  const navItems = [
    { path: "/sales-forecasting", icon: LineChart, label: "Sales Forecasting" },
    { path: "/paint-analyzer", icon: Paintbrush, label: "Paint Analyzer" },
    { path: "/user-profile", icon: User, label: "User Profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-[#174d32] border-b border-[#1a4d2e] sticky top-0 z-50 shadow-lg rounded-b-xl">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left section - Logo and user info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden text-white hover:text-green-200 transition-colors p-2 rounded-lg hover:bg-white/10"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>

              <div className="flex items-center gap-2">
                <img src={logo} alt="Paintelligent" className="h-8 w-auto" />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white flex items-center gap-1">
                    Hello and welcome, {userName}!
                  </p>
                  <p className="text-xs text-green-300 flex items-center gap-2 flex-wrap relative">
                    <CalendarDays className="size-3" />
                    {month} {day}, {year}
                    <span className="w-px h-3 bg-green-500/50 mx-1"></span>
                    <span className="flex items-center gap-1">
                      {season.icon}
                      <span className="text-green-300/80">{season.name}</span>
                    </span>
                    
                    {/* Weather Information - Only shows temperature with hover tooltip */}
                    {weather && !weatherLoading && !weatherError && (
                      <>
                        <span className="w-px h-3 bg-green-500/50 mx-1"></span>
                        
                        {/* Weather Tooltip Container - Only shows temperature */}
                        <div className="weather-tooltip-container relative inline-block">
                          <span 
                            className="flex items-center gap-1 text-green-300/80 cursor-help hover:text-green-200 transition-colors"
                            onMouseEnter={() => setShowWeatherTooltip(true)}
                            onMouseLeave={() => setShowWeatherTooltip(false)}
                            onClick={() => setShowWeatherTooltip(!showWeatherTooltip)}
                          >
                            {getWeatherIcon(weather.weather[0]?.main || '')}
                            <span className="font-medium underline decoration-dotted underline-offset-2">
                              {Math.round(weather.temp)}°C
                            </span>
                          </span>

                          {/* Tooltip - Detailed Weather Information (only shows on hover) */}
                          {showWeatherTooltip && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-[#1a4d2e] text-white rounded-xl shadow-2xl p-4 border border-green-500/20 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* Arrow pointing UP to the text */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full -mb-1">
                                <div className="border-8 border-transparent border-b-[#1a4d2e]"></div>
                              </div>

                              {/* Weather Header */}
                              <div className="flex items-center gap-3 mb-3 pb-2 border-b border-green-500/20">
                                <div className="text-3xl">
                                  {getWeatherIcon(weather.weather[0]?.main || '', 'size-8')}
                                </div>
                                <div>
                                  <div className="text-lg font-bold">
                                    {Math.round(weather.temp)}°C
                                    
                                  </div>
                                  <div className="text-sm text-green-300/80 capitalize">
                                    {weather.weather[0]?.description}
                                  </div>
                                </div>
                              </div>

                              {/* Weather Details Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Thermometer className="size-4 text-yellow-300" />
                                  <div>
                                    <div className="text-green-300/60">Temperature</div>
                                    <div className="font-medium">{Math.round(weather.temp)}°C</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Droplets className="size-4 text-blue-300" />
                                  <div>
                                    <div className="text-green-300/60">Humidity</div>
                                    <div className="font-medium">{weather.humidity}%</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Wind className="size-4 text-cyan-300" />
                                  <div>
                                    <div className="text-green-300/60">Wind Speed</div>
                                    <div className="font-medium">{Math.round(weather.wind_speed)} m/s</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Gauge className="size-4 text-purple-300" />
                                  <div>
                                    <div className="text-green-300/60">Pressure</div>
                                    <div className="font-medium">{weather.pressure} hPa</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Cloud className="size-4 text-gray-300" />
                                  <div>
                                    <div className="text-green-300/60">Cloud Cover</div>
                                    <div className="font-medium">{weather.clouds}%</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                  <Eye className="size-4 text-green-300" />
                                  <div>
                                    <div className="text-green-300/60">Visibility</div>
                                    <div className="font-medium">{(weather.visibility / 1000).toFixed(1)} km</div>
                                  </div>
                                </div>
                              </div>

                              {/* Weather Details Footer */}
                              <div className="mt-2 pt-2 border-t border-green-500/20 text-[10px] text-green-300/40 flex justify-between">
                                <span>Last updated: {new Date().toLocaleTimeString()}</span>
                                <span>Powered by OpenWeather</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {weatherLoading && (
                      <span className="flex items-center gap-1 text-green-300/60 text-xs animate-pulse">
                        <RefreshCw className="size-3 animate-spin" />
                        Loading weather...
                      </span>
                    )}
                    
                    {weatherError && !weatherLoading && (
                      <span className="flex items-center gap-1 text-yellow-300/60 text-xs">
                        <Cloud className="size-3" />
                        Weather unavailable
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Right section - Navigation */}
            <div className="flex items-center gap-2">
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

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden py-3 space-y-1 border-t border-white/10 animate-in slide-in-from-top-2 duration-200">
              {/* Mobile Weather Info - Only shows on hover/click on mobile */}
              {weather && !weatherLoading && !weatherError && (
                <div 
                  className="px-4 py-2 mb-2 bg-white/5 rounded-lg flex flex-wrap items-center gap-3 text-xs text-white/80 cursor-help"
                  onMouseEnter={() => setShowWeatherTooltip(true)}
                  onMouseLeave={() => setShowWeatherTooltip(false)}
                  onClick={() => setShowWeatherTooltip(!showWeatherTooltip)}
                >
                  <span className="flex items-center gap-1.5">
                    {getWeatherIcon(weather.weather[0]?.main || '')}
                    <span className="font-medium underline decoration-dotted underline-offset-2">
                      {Math.round(weather.temp)}°C
                    </span>
                  </span>
                </div>
              )}
              
              {weatherLoading && (
                <div className="px-4 py-2 mb-2 bg-white/5 rounded-lg flex items-center gap-2 text-xs text-white/60">
                  <RefreshCw className="size-4 animate-spin" />
                  Loading weather...
                </div>
              )}

              {weatherError && !weatherLoading && (
                <div className="px-4 py-2 mb-2 bg-white/5 rounded-lg flex items-center gap-2 text-xs text-yellow-300/60">
                  <Cloud className="size-4" />
                  Weather data unavailable
                </div>
              )}

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

      <main>
        <Outlet />
      </main>
    </div>
  );
}