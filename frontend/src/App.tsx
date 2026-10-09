import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./HomePage";
import Login from "./Login";
import Register from "./Register";
import UserDashboard from "./UserDashboard";
import OwnerDashboard from "./OwnerDashboard";
import ParkingLotDetails from "./ParkingLotDetails";
import AdminDashboard from "./AdminDashboard";

import { useAuth } from "./context/AuthContext";


function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: string;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p style={{ padding: "20px" }}>Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== requiredRole) {
    if (user.role === "owner") {
      return <Navigate to="/owner-dashboard" replace />;
    }

    if (user.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    }

    return <Navigate to="/user-dashboard" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p style={{ padding: "20px" }}>Loading...</p>;
  }

  if (user) {
    return (
      <Navigate
        to={
          user.role === "admin"
            ? "/admin-dashboard"
            : user.role === "owner"
              ? "/owner-dashboard"
              : "/user-dashboard"
        }
        replace
      />
    );
  }

  return <>{children}</>;
}


function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />

      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />

      <Route
        path="/user-dashboard"
        element={
          <ProtectedRoute requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parking/:lotId"
        element={
          <ProtectedRoute requiredRole="user">
            <ParkingLotDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/owner-dashboard"
        element={
          <ProtectedRoute requiredRole="owner">
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
