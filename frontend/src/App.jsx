import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Import komponen halaman
import DashboardPage from "./pages/DashboardPage";
import RiwayatPage from "./pages/RiwayatPage";
import LaporanPage from "./pages/LaporanPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TimPage from "./pages/TimPage";
import DetailTimPage from "./pages/DetailTimPage";
import CreateTeamPage from "./pages/CreateTeamPage";
import SessionPage from "./pages/SessionPage";
import Sidebar from "./components/Sidebar";

// Import status tracking utilities
import { setupStatusTracking } from "./utils/userStatus";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "null");

      if (!token || !userData) {
        // Clear any existing data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setIsLoading(false);
        return;
      }

      setUser(userData);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Handle redirects based on authentication status
  useEffect(() => {
    if (isLoading) return;

    const currentPath = location.pathname;
    const isAuthPage = currentPath === "/login" || currentPath === "/register";

    if (!user) {
      // Jika belum login, arahkan ke halaman login
      if (!isAuthPage) {
        navigate("/login", { replace: true });
      }
    } else if (isAuthPage) {
      // Jika sudah login tapi mencoba akses halaman auth, arahkan ke dashboard
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authenticated, only allow login/register pages
  if (!user) {
    if (location.pathname === "/login" || location.pathname === "/register") {
      return children;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const location = useLocation();
  const hideSidebar = ["login", "register"].includes(
    location.pathname.split("/")[1]
  );

  // Setup status tracking untuk user yang sudah login
  useEffect(() => {
    const cleanup = setupStatusTracking();

    return () => {
      if (cleanup && typeof cleanup === "function") {
        cleanup();
      }
    };
  }, []);

  // Redirect root path to /login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (location.pathname === "/" && !token) {
      // This is now handled by the Route component
    }
  }, [location]);
  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-auto">
      {/* Sidebar hanya tampil di halaman yang membutuhkan */}
      {!hideSidebar && <Sidebar />}

      <main
        className={
          hideSidebar
            ? "flex-1 flex justify-center items-center min-h-screen bg-gray-50"
            : "flex-1 overflow-y-auto ml-72 min-w-0"
        }
      >
        <ToastContainer position="top-right" autoClose={3000} />

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route
            path="/create-team"
            element={
              <ProtectedRoute>
                <CreateTeamPage />
              </ProtectedRoute>
            }
          />

          {/* Default route - redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Dashboard route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/riwayat"
            element={
              <ProtectedRoute>
                <RiwayatPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/laporan"
            element={
              <ProtectedRoute>
                <LaporanPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tim"
            element={
              <ProtectedRoute>
                <TimPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tim/:timId"
            element={
              <ProtectedRoute>
                <DetailTimPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/session/:sessionId"
            element={
              <ProtectedRoute>
                <SessionPage />
              </ProtectedRoute>
            }
          />

          {/* Catch all other routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
