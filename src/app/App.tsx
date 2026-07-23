// src/app/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
        element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} 
      />
      <Route 
        path="/register" 
        element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} 
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
        <Route index element={<SeasonalForecasting />} />
        <Route path="paint-analyzer" element={<PaintComponentAnalyzer />} />
        <Route path="user-profile" element={<UserProfile />} />
        <Route path="seasonal-forecasting" element={<SeasonalForecasting />} />
      </Route>
    </Routes>
  );
}

// ✅ FIXED: AuthProvider wraps BrowserRouter
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;