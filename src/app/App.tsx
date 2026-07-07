import { useEffect } from "react";
import { RouterProvider, createBrowserRouter, Outlet } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import SeasonalForecasting from "./pages/SeasonalForecasting";
import PaintComponentAnalyzer from "./pages/PaintComponentAnalyzer";
import UserProfile from "./pages/UserProfile";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Root component that provides the AuthContext
function Root() {
  useEffect(() => {
    // Suppress Recharts duplicate key warnings
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Encountered two children with the same key')
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/",
        Component: ProtectedRoute,
        children: [
          {
            path: "/",
            Component: Layout,
            children: [
              { index: true, Component: SeasonalForecasting },
              { path: "seasonal-forecasting", Component: SeasonalForecasting },
              { path: "paint-analyzer", Component: PaintComponentAnalyzer },
              { path: "user-profile", Component: UserProfile },
            ],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}