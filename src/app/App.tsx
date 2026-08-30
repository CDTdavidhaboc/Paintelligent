// src/app/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WeatherProvider } from "./context/WeatherContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Layout from "./components/Layout";
import PaintComponentAnalyzer from "./pages/PaintComponentAnalyzer";
import SeasonalForecasting from "./pages/SeasonalForecasting";
import UserProfile from "./pages/UserProfile";
import ResetPassword from "./pages/ResetPassword";

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="size-12 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login /> : <Navigate to="/sales-forecasting" replace />} 
      />
      <Route 
        path="/register" 
        element={!isAuthenticated ? <Register /> : <Navigate to="/sales-forecasting" replace />} 
      />
      
      {/* Reset Password Route - Public */}
      <Route 
        path="/reset-password" 
        element={<ResetPassword />} 
      />
      
      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        {/* Root redirects to sales-forecasting */}
        <Route index element={<Navigate to="/sales-forecasting" replace />} />
        
        {/* Main Routes */}
        <Route path="sales-forecasting" element={<SeasonalForecasting />} />
        <Route path="paint-analyzer" element={<PaintComponentAnalyzer />} />
        <Route path="user-profile" element={<UserProfile />} />
      </Route>
    </Routes>
  );
}

// ✅ AuthProvider and WeatherProvider wrap BrowserRouter
function App() {
  return (
    <AuthProvider>
      <WeatherProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </WeatherProvider>
    </AuthProvider>
  );
}

export default App;