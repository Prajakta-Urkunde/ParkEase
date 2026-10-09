import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getAvailableParkingLots,
  getParkingLotSlots,
} from "./services/api";
import "./ParkingLotDetails.css";

type ParkingLot = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_slots: number;
  available_slots: number;
};

type ParkingSlot = {
  id: number;
  slot_number: string;
  is_available: boolean;
};

function ParkingLotDetails() {
  const navigate = useNavigate();
  const { lotId } = useParams<{ lotId: string }>();
  const parkingLotId = Number(lotId);
  const [parkingLot, setParkingLot] = useState<ParkingLot | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadParkingLotDetails() {
      setLoading(true);
      setError("");
      setParkingLot(null);
      setSlots([]);
      setSelectedSlotId(null);

      if (!lotId || !Number.isInteger(parkingLotId) || parkingLotId <= 0) {
        setError("not-found");
        setLoading(false);
        return;
      }

      try {
        const parkingLots = await getAvailableParkingLots();
        const selectedLot = parkingLots.find(
          (lot: ParkingLot) => lot.id === parkingLotId
        );

        if (!selectedLot) {
          if (!isCancelled) {
            setError("not-found");
          }
          return;
        }

        const slotsResult = await getParkingLotSlots(parkingLotId);

        if (!isCancelled) {
          setParkingLot(selectedLot);
          setSlots(slotsResult.slots);
        }
      } catch (loadError) {
        console.error("Failed to load parking lot details:", loadError);
        if (!isCancelled) {
          setError("We couldn't load this parking lot. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadParkingLotDetails();

    return () => {
      isCancelled = true;
    };
  }, [lotId, parkingLotId]);

  function navigateToParkingLot() {
    if (
      !parkingLot ||
      parkingLot.latitude === null ||
      parkingLot.longitude === null
    ) {
      return;
    }

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${parkingLot.latitude},${parkingLot.longitude}`;
    window.open(navigationUrl, "_blank");
  }

  function goToUserDashboard() {
    navigate("/user-dashboard");
  }

  function selectParkingSlot(slot: ParkingSlot) {
    if (!slot.is_available) {
      return;
    }

    setSelectedSlotId((currentSlotId) =>
      currentSlotId === slot.id ? null : slot.id
    );
  }

  if (loading) {
    return (
      <section className="parking-details-state" aria-live="polite">
        <button
          type="button"
          className="parking-details-back"
          onClick={goToUserDashboard}
        >
          Back to dashboard
        </button>
        <div className="parking-details-spinner" aria-hidden="true" />
        <h2>Loading parking lot</h2>
        <p>Fetching the latest parking information...</p>
      </section>
    );
  }

  if (error === "not-found") {
    return (
      <section className="parking-details-state" role="status">
        <button
          type="button"
          className="parking-details-back"
          onClick={goToUserDashboard}
        >
          Back to dashboard
        </button>
        <span className="parking-details-state-icon" aria-hidden="true">
          ?
        </span>
        <h2>Parking lot not found</h2>
        <p>This parking lot may no longer be available.</p>
      </section>
    );
  }

  if (error || !parkingLot) {
    return (
      <section className="parking-details-state parking-details-error" role="alert">
        <button
          type="button"
          className="parking-details-back"
          onClick={goToUserDashboard}
        >
          Back to dashboard
        </button>
        <span className="parking-details-state-icon" aria-hidden="true">
          !
        </span>
        <h2>Unable to load parking lot</h2>
        <p>{error || "Parking lot details are unavailable right now."}</p>
      </section>
    );
  }

  const occupiedSlots = Math.max(
    parkingLot.total_slots - parkingLot.available_slots,
    0
  );

  return (
    <main className="parking-details-page">
      <header className="parking-details-header">
        <button
          type="button"
          className="parking-details-back"
          onClick={goToUserDashboard}
        >
          Back to dashboard
        </button>
        <div>
          <p className="parking-details-kicker">Parking lot details</p>
          <h1>{parkingLot.name}</h1>
        </div>
      </header>

      <section className="parking-details-overview">
        <article className="parking-details-location-card">
          <p className="parking-details-kicker">Location</p>
          <h2>Find this parking lot</h2>
          <p className="parking-details-address">{parkingLot.address}</p>

          <button
            type="button"
            className="parking-details-navigation"
            onClick={navigateToParkingLot}
            disabled={
              parkingLot.latitude === null || parkingLot.longitude === null
            }
          >
            Get Directions
          </button>
        </article>

        <article className="parking-details-summary-card">
          <div className="parking-details-section-heading">
            <div>
              <p className="parking-details-kicker">Parking summary</p>
              <h2>Current capacity</h2>
            </div>
            <span>{parkingLot.available_slots} available</span>
          </div>

          <div className="parking-details-summary" aria-label="Parking capacity">
            <div className="parking-details-stat">
              <span>Total capacity</span>
              <strong>{parkingLot.total_slots}</strong>
            </div>

            <div className="parking-details-stat parking-details-stat-primary">
              <span>Available slots</span>
              <strong>{parkingLot.available_slots}</strong>
            </div>

            <div className="parking-details-stat">
              <span>Occupied slots</span>
              <strong>{occupiedSlots}</strong>
            </div>
          </div>

          <div className="parking-details-progress-label">
            <span>Availability</span>
            <strong>
              {parkingLot.total_slots > 0
                ? Math.round(
                    (parkingLot.available_slots / parkingLot.total_slots) * 100
                  )
                : 0}
              %
            </strong>
          </div>
          <div
            className="parking-details-progress-track"
            role="progressbar"
            aria-label="Available parking capacity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              parkingLot.total_slots > 0
                ? Math.round(
                    (parkingLot.available_slots / parkingLot.total_slots) * 100
                  )
                : 0
            }
          >
            <span
              className="parking-details-progress-fill"
              style={{
                width: `${
                  parkingLot.total_slots > 0
                    ? Math.min(
                        Math.max(
                          (parkingLot.available_slots /
                            parkingLot.total_slots) *
                            100,
                          0
                        ),
                        100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </article>
      </section>

      <section className="parking-details-slots" aria-labelledby="parking-slots-heading">
        <div className="parking-details-section-heading">
          <div>
            <p className="parking-details-kicker">Live layout</p>
            <h2 id="parking-slots-heading">Parking slots</h2>
          </div>
          <span>{slots.length} listed</span>
        </div>

        <div className="parking-layout-legend" aria-label="Parking slot legend">
          <span>
            <i className="parking-layout-swatch is-available" aria-hidden="true" />
            Available
          </span>
          <span>
            <i className="parking-layout-swatch is-occupied" aria-hidden="true" />
            Occupied
          </span>
          <span>
            <i className="parking-layout-swatch is-selected" aria-hidden="true" />
            Selected
          </span>
        </div>

        {slots.length === 0 ? (
          <p className="parking-details-empty">No slot information is available.</p>
        ) : (
          <div className="parking-layout-shell">
            <div className="parking-layout-edge parking-layout-entrance">
              Entrance
            </div>
            <div className="parking-layout-lane" aria-hidden="true">
              <span>Driving lane</span>
            </div>
            <div className="parking-details-slot-grid">
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const slotClassName = `parking-details-slot ${
                  slot.is_available ? "is-available" : "is-occupied"
                }${isSelected ? " is-selected" : ""}`;

                if (!slot.is_available) {
                  return (
                    <div className={slotClassName} key={slot.id}>
                      <strong>{slot.slot_number}</strong>
                      <span>Occupied</span>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    className={slotClassName}
                    key={slot.id}
                    aria-pressed={isSelected}
                    onClick={() => selectParkingSlot(slot)}
                  >
                    <strong>{slot.slot_number}</strong>
                    <span>{isSelected ? "Selected" : "Available"}</span>
                  </button>
                );
              })}
            </div>
            <div className="parking-layout-edge parking-layout-exit">Exit</div>
          </div>
        )}

        {selectedSlotId !== null && (
          <p className="parking-layout-selection" role="status">
            Slot {slots.find((slot) => slot.id === selectedSlotId)?.slot_number} selected
          </p>
        )}
      </section>
    </main>
  );
}

export default ParkingLotDetails;
