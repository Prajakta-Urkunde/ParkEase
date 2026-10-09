import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import OwnerVerification from "./OwnerVerification";
import type { OwnerVerificationStatus } from "./services/api";
import OwnerParkingManager from "./OwnerParkingManager";
import OwnerStats from "./OwnerStats";
import OwnerReservations from "./OwnerReservations";
import "./OwnerDashboard.css";

function OwnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationStatus, setVerificationStatus] =
    useState<OwnerVerificationStatus["status"]>("NOT_SUBMITTED");
  const verificationNotice = (
    location.state as { verificationNotice?: string } | null
  )?.verificationNotice;

  return (
    <div>
      <header
        className="owner-dashboard-header"
        style={{
          padding: "20px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "white",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>ParkEase</h1>

          <p style={{ margin: "5px 0 0", color: "#666" }}>
            Welcome, {user?.name}
          </p>

          <p style={{ margin: "3px 0 0", fontSize: "14px", color: "#2563eb", fontWeight: 600 }}>
            Account Type: Parking Owner
          </p>
        </div>

        <div className="owner-dashboard-actions" style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              padding: "8px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              background: "white",
              color: "#1e293b",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => navigate("/")}
          >
            Home
          </button>

          <button
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: "#ef4444",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <OwnerStats />

      <OwnerVerification
        notice={verificationNotice}
        onStatusChange={setVerificationStatus}
      />

      <OwnerParkingManager canPublish={verificationStatus === "VERIFIED"} />

      <OwnerReservations />
    </div>
  );
}

export default OwnerDashboard;
