import { useEffect, useState } from "react";

import {
  getOwnerParkingLots,
  getParkingLotSummary,
} from "./services/api";

import "./OwnerStats.css";

type ParkingLot = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_slots: number;
};

type Summary = {
  capacity: number;
  created_slots: number;
  available_slots: number;
  occupied_slots: number;
};

const EMPTY_SUMMARY: Summary = {
  capacity: 0,
  created_slots: 0,
  available_slots: 0,
  occupied_slots: 0,
};

function OwnerStats() {
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError("");

      const parkingLots = await getOwnerParkingLots();
      setLots(parkingLots);

      const summaries = await Promise.all(
        parkingLots.map((lot: ParkingLot) => getParkingLotSummary(lot.id))
      );

      const aggregatedSummary = summaries.reduce<Summary>(
        (totals, lotSummary) => ({
          capacity: totals.capacity + lotSummary.capacity,
          created_slots: totals.created_slots + lotSummary.created_slots,
          available_slots:
            totals.available_slots + lotSummary.available_slots,
          occupied_slots: totals.occupied_slots + lotSummary.occupied_slots,
        }),
        EMPTY_SUMMARY
      );

      setSummary(aggregatedSummary);
    } catch (error) {
      console.error("Failed to load owner statistics:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load owner statistics"
      );
    } finally {
      setLoading(false);
    }
  }

  const availabilityPercentage =
    summary.capacity > 0
      ? Math.round((summary.available_slots / summary.capacity) * 100)
      : 0;
  const occupancyPercentage =
    summary.capacity > 0
      ? Math.round((summary.occupied_slots / summary.capacity) * 100)
      : 0;

  return (
    <section className="owner-stats">
      <h2>Parking Overview</h2>

      {loading && <p className="owner-stats-message">Loading statistics...</p>}

      {error && (
        <div className="owner-stats-message owner-stats-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadStats} disabled={loading}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && lots.length === 0 && (
        <div className="owner-stats-empty">
          <h3>No parking lots yet</h3>
          <p>Create a parking lot to start seeing owner statistics.</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Parking Lots</h3>
          <strong>{lots.length}</strong>
        </div>

        <div className="stat-card">
          <h3>Total Capacity</h3>
          <strong>{summary.capacity}</strong>
        </div>

        <div className="stat-card stat-card-available">
          <h3>Available Slots</h3>
          <strong>{summary.available_slots}</strong>
        </div>

        <div className="stat-card stat-card-occupied">
          <h3>Occupied Slots</h3>
          <strong>{summary.occupied_slots}</strong>
        </div>

        <div className="stat-card stat-card-available">
          <h3>Availability Rate</h3>
          <strong>{availabilityPercentage}%</strong>
        </div>

        <div className="stat-card stat-card-occupied">
          <h3>Occupancy Rate</h3>
          <strong>{occupancyPercentage}%</strong>
        </div>
      </div>
    </section>
  );
}

export default OwnerStats;
