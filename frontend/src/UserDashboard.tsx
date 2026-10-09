import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import ParkingSearch from "./ParkingSearch";
import ReservationHistory from "./ReservationHistory";
import ParkingMap from "./ParkingMap";
import UserProfile from "./UserProfile";

import { getAvailableParkingLots } from "./services/api";

import "./UserDashboard.css";

type ParkingLot = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_slots: number;
  available_slots: number;
};

type Tab = "map" | "search" | "reservations" | "profile";

function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("map");

  useEffect(() => {
    loadLots();
  }, []);

  async function loadLots() {
    try {
      const result = await getAvailableParkingLots();
      setLots(result);
    } catch (error) {
      console.error("Failed to load parking lots:", error);
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "map", label: "Parking Map", icon: "🗺️" },
    { key: "search", label: "Find Parking", icon: "🔍" },
    { key: "reservations", label: "My Reservations", icon: "📋" },
    { key: "profile", label: "Profile", icon: "👤" },
  ];

  return (
    <div className="ud-root">
      {/* ── TOP NAVBAR ── */}
      <header className="ud-header">
        <div className="ud-header-inner">
          {/* Logo */}
          <button className="ud-logo" onClick={() => navigate("/")}>
            <span className="ud-logo-mark">P</span>
            <span className="ud-logo-text">ParkEase</span>
          </button>

          {/* Tab navigation */}
          <nav className="ud-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`ud-tab ${activeTab === t.key ? "ud-tab-active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                <span className="ud-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* User + logout */}
          <div className="ud-header-right">
            <div className="ud-user-chip">
              <span className="ud-avatar">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
              </span>
              <span className="ud-username">{user?.name}</span>
            </div>
            <button className="ud-logout" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── PAGE BODY ── */}
      <main className="ud-main">
        {/* MAP TAB */}
        {activeTab === "map" && (
          <div className="ud-panel">
            <div className="ud-panel-heading">
              <h2>Parking Near You</h2>
              <p>Click a marker on the map to view parking details.</p>
            </div>
            <ParkingMap
              lots={lots}
              selectedLot={selectedLot}
              onSelectLot={setSelectedLot}
            />
            {selectedLot && (
              <div className="ud-selected-lot">
                <div className="ud-selected-lot-info">
                  <h3>{selectedLot.name}</h3>
                  <p>{selectedLot.address}</p>
                </div>
                <div className="ud-slot-badge">
                  <span
                    className={
                      selectedLot.available_slots > 0
                        ? "ud-badge-available"
                        : "ud-badge-full"
                    }
                  >
                    {selectedLot.available_slots > 0
                      ? `${selectedLot.available_slots} slots free`
                      : "Full"}
                  </span>
                </div>
                <button
                  className="ud-goto-search"
                  onClick={() => navigate(`/parking/${selectedLot.id}`)}
                >
                  View parking details →
                </button>
              </div>
            )}

            {/* Quick stats row */}
            <div className="ud-stats-row">
              <div className="ud-stat-card">
                <strong>{lots.length}</strong>
                <span>Parking Locations</span>
              </div>
              <div className="ud-stat-card ud-stat-green">
                <strong>
                  {lots.filter((l) => l.available_slots > 0).length}
                </strong>
                <span>Locations with Space</span>
              </div>
              <div className="ud-stat-card">
                <strong>
                  {lots.reduce((s, l) => s + l.available_slots, 0)}
                </strong>
                <span>Total Free Slots</span>
              </div>
              <div className="ud-stat-card ud-stat-blue">
                <strong>
                  {lots.reduce((s, l) => s + l.total_slots, 0)}
                </strong>
                <span>Total Capacity</span>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === "search" && (
          <div className="ud-panel">
            <ParkingSearch />
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {activeTab === "reservations" && (
          <div className="ud-panel">
            <ReservationHistory onReservationChange={loadLots} />
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="ud-panel">
            <UserProfile />
          </div>
        )}
      </main>
    </div>
  );
}

export default UserDashboard;
