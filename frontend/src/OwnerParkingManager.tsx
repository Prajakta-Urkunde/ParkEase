import { useState, useEffect, type FormEvent } from "react";
import {
  AlertCircle,
  Building2,
  CarFront,
  CheckCircle2,
  Gauge,
  LoaderCircle,
  MapPin,
  ParkingCircle,
  Plus,
} from "lucide-react";

import {
  createParkingLot,
  createParkingSlot,
  getOwnerParkingLots,
  getOwnerParkingLotSlots,
  getParkingLotSummary,
} from "./services/api";
import "./OwnerParkingManager.css";

type ParkingLot = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_slots: number;
};

type OwnerSlot = {
  id: number;
  slot_number: string;
  vehicle_type?: string;
  status?: string;
  is_available: boolean;
};

type VehicleSummaryEntry = {
  vehicle_type: string;
  total: number;
  available: number;
  reserved: number;
  occupied: number;
};

type LotSummary = {
  capacity: number;
  created_slots: number;
  available_slots: number;
  occupied_slots: number;
  reserved_slots?: number;
  vehicle_summary?: VehicleSummaryEntry[];
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  "2_wheeler": "2 Wheeler",
  "3_wheeler": "3 Wheeler",
  "4_wheeler": "4 Wheeler",
};

function formatVehicleType(vehicleType?: string) {
  if (!vehicleType) return "Unknown";
  return VEHICLE_TYPE_LABELS[vehicleType] ?? vehicleType;
}

function getSlotStatus(slot: OwnerSlot) {
  const normalizedStatus = (slot.status ?? "").trim().toLowerCase();

  if (normalizedStatus === "reserved") {
    return { label: "Reserved", statusClass: "slot-card--reserved" };
  }

  if (normalizedStatus === "occupied" || !slot.is_available) {
    return { label: "Occupied", statusClass: "slot-card--occupied" };
  }

  return { label: "Available", statusClass: "slot-card--available" };
}

function OwnerParkingManager({ canPublish }: { canPublish: boolean }) {
  const [lots, setLots] = useState<ParkingLot[]>([]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [totalSlots, setTotalSlots] = useState(0);

  const [slotNumber, setSlotNumber] = useState("");
  const [selectedVehicleType, setSelectedVehicleType] = useState("2_wheeler");
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);

  const [ownerSlots, setOwnerSlots] = useState<OwnerSlot[]>([]);
  const [summary, setSummary] = useState<LotSummary | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );
  const [isLoadingLots, setIsLoadingLots] = useState(true);
  const [isViewingSlots, setIsViewingSlots] = useState(false);
  const [isCreatingLot, setIsCreatingLot] = useState(false);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);

  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;

  useEffect(() => {
    loadLots();
  }, []);

  async function loadLots() {
    try {
      setIsLoadingLots(true);
      const result = await getOwnerParkingLots();
      setLots(result);
    } catch (error) {
      console.error("Failed to load owner parking lots:", error);
      setFeedback(
        "We couldn't load your parking lots. Please try again.",
        "error"
      );
    } finally {
      setIsLoadingLots(false);
    }
  }

  async function viewSlots(lotId: number) {
    try {
      setIsViewingSlots(true);
      setMessage("");

      const result = await getOwnerParkingLotSlots(lotId);
      setOwnerSlots(result.slots);
      setSelectedLotId(lotId);

      const summaryResult = await getParkingLotSummary(lotId);
      setSummary(summaryResult);
    } catch (error) {
      console.error("Failed to load owner parking information:", error);
      setFeedback(
        "We couldn't load this parking lot's slots. Please try again.",
        "error"
      );
    } finally {
      setIsViewingSlots(false);
    }
  }

  function setFeedback(nextMessage: string, type: "success" | "error") {
    setMessage(nextMessage);
    setMessageType(type);
  }

  async function handleCreateLot(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setMessageType("error");

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedAddress) {
      setFeedback("Parking lot name and address are required.", "error");
      return;
    }

    if (trimmedName.length > 150 || trimmedAddress.length > 255) {
      setFeedback(
        "Parking lot name must be 150 characters or fewer and address must be 255 characters or fewer.",
        "error"
      );
      return;
    }

    if (!Number.isInteger(totalSlots) || totalSlots < 1) {
      setFeedback("Total capacity must be a whole number greater than zero.", "error");
      return;
    }

    try {
      setIsCreatingLot(true);
      await createParkingLot({
        name: trimmedName,
        address: trimmedAddress,
        total_slots: totalSlots,
      });

      setFeedback("Parking lot created successfully.", "success");

      setName("");
      setAddress("");
      setTotalSlots(0);

      await loadLots();
    } catch (error) {
      console.error("Failed to create parking lot:", error);
      setFeedback(
        "We couldn't create the parking lot. Please check the details and try again.",
        "error"
      );
    } finally {
      setIsCreatingLot(false);
    }
  }

  async function handleCreateSlot(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (selectedLotId === null) {
      setFeedback("Please select a parking lot.", "error");
      return;
    }

    const trimmedSlotNumber = slotNumber.trim();

    if (!trimmedSlotNumber) {
      setFeedback("Enter a slot number.", "error");
      return;
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,19}$/.test(trimmedSlotNumber)) {
      setFeedback(
        "Slot information must be 1-20 characters and use letters, numbers, spaces, hyphens, or underscores.",
        "error"
      );
      return;
    }

    if (summary && summary.created_slots >= summary.capacity) {
      setFeedback("This parking lot has reached its slot capacity.", "error");
      return;
    }

    if (
      ownerSlots.some(
        (slot) =>
          slot.slot_number.toLowerCase() === trimmedSlotNumber.toLowerCase()
      )
    ) {
      setFeedback("A slot with this number already exists in this lot.", "error");
      return;
    }

    try {
      setIsCreatingSlot(true);
      await createParkingSlot(trimmedSlotNumber, selectedLotId, selectedVehicleType);

      setSlotNumber("");
      setSelectedVehicleType("2_wheeler");
      setFeedback(`Slot ${trimmedSlotNumber} created successfully!`, "success");

      await viewSlots(selectedLotId);
    } catch (error) {
      console.error("Failed to create parking slot:", error);
      setFeedback(
        "We couldn't add this parking slot. Please check the slot details and try again.",
        "error"
      );
    } finally {
      setIsCreatingSlot(false);
    }
  }

  const reservedCount =
    summary?.reserved_slots ??
    Math.max(0, (summary?.created_slots ?? 0) - (summary?.available_slots ?? 0) - (summary?.occupied_slots ?? 0));

  return (
    <div className="owner-parking-manager">
      <header className="owner-parking-manager__header">
        <div className="owner-parking-manager__heading">
          <div className="owner-parking-manager__title-row">
            <div className="owner-parking-manager__title-icon" aria-hidden="true">
              <ParkingCircle size={22} />
            </div>
            <div>
              <p className="owner-parking-manager__eyebrow">Smart Parking</p>
              <h2>Parking Management</h2>
            </div>
          </div>
          <p className="owner-parking-manager__subtitle">
            Manage your parking lots, slots and vehicle availability
          </p>
        </div>

        {canPublish && (
          <button
            type="button"
            className="owner-parking-manager__primary-button"
            onClick={() =>
              document
                .getElementById("create-parking-lot-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Plus size={18} />
            Add Parking Lot
          </button>
        )}
      </header>

      {message && (
        <div
          role={messageType === "error" ? "alert" : "status"}
          className={`owner-parking-manager__message owner-parking-manager__message--${messageType}`}
          aria-live="polite"
        >
          <span className="owner-parking-manager__message-icon" aria-hidden="true">
            {messageType === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          </span>
          <span>{message}</span>
        </div>
      )}

      {!canPublish && (
        <div className="owner-parking-manager__message owner-parking-manager__message--error" role="status">
          Property verification must be approved before a parking lot can be published.
        </div>
      )}

      {canPublish && (
      <section id="create-parking-lot-section" className="owner-parking-manager__section owner-parking-manager__section--form">
        <div className="owner-parking-manager__section-header">
          <div className="owner-parking-manager__section-badge">
            <Building2 size={16} />
            New lot
          </div>
          <h3>Create Parking Lot</h3>
        </div>

        <form onSubmit={handleCreateLot} className="owner-parking-manager__form">
          <div className="owner-parking-manager__field">
            <label htmlFor="parking-lot-name">Parking lot name</label>
            <input
              id="parking-lot-name"
              type="text"
              placeholder="Parking lot name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
              required
            />
          </div>

          <div className="owner-parking-manager__field">
            <label htmlFor="parking-lot-address">Address</label>
            <input
              id="parking-lot-address"
              type="text"
              placeholder="Parking lot address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={255}
              required
            />
            <small>Use the exact address approved in your property verification. The approved map location will be used for this listing.</small>
          </div>

          <div className="owner-parking-manager__field">
            <label htmlFor="parking-lot-total-slots">Total Slots</label>
            <input
              id="parking-lot-total-slots"
              type="number"
              min="1"
              placeholder="Total slots"
              value={totalSlots || ""}
              onChange={(e) => setTotalSlots(Number(e.target.value))}
              required
            />
          </div>

          <button type="submit" className="owner-parking-manager__submit-button" disabled={isCreatingLot} aria-busy={isCreatingLot}>
            {isCreatingLot && <span className="button-spinner" aria-hidden="true" />}
            {isCreatingLot ? "Creating parking lot..." : "Create Parking Lot"}
          </button>
        </form>
      </section>
      )}

      <section className="owner-parking-manager__section owner-parking-manager__section--lots">
        <div className="owner-parking-manager__section-header owner-parking-manager__section-header--stacked">
          <div className="owner-parking-manager__section-badge">
            <Gauge size={16} />
            Active lots
          </div>
          <h3>My Parking Lots</h3>
        </div>

        {isLoadingLots ? (
          <div className="owner-parking-manager__state-card owner-parking-manager__state-card--loading">
            <LoaderCircle className="owner-parking-manager__spinner" size={28} />
            <p>Loading parking lots...</p>
          </div>
        ) : lots.length === 0 ? (
          <div className="owner-parking-manager__empty-state">
            <div className="owner-parking-manager__empty-icon" aria-hidden="true">
              <ParkingCircle size={42} />
            </div>
            <h3>No Parking Lots Yet</h3>
            <p>
              {canPublish
                ? "Start by creating your first parking lot and add slots to begin managing availability."
                : "Complete property verification before publishing a parking lot."}
            </p>
            {canPublish && (
              <button
                type="button"
                className="owner-parking-manager__primary-button"
                onClick={() =>
                  document
                    .getElementById("create-parking-lot-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <Plus size={18} />
                Add Parking Lot
              </button>
            )}
          </div>
        ) : (
          <div className="owner-parking-manager__lot-grid">
            {lots.map((lot) => (
              <article key={lot.id} className="owner-parking-manager__lot-card">
                <div className="owner-parking-manager__lot-header">
                  <div>
                    <p className="owner-parking-manager__lot-kicker">Parking lot</p>
                    <h3>{lot.name}</h3>
                  </div>
                  <span className={`owner-parking-manager__status-pill ${selectedLotId === lot.id ? "owner-parking-manager__status-pill--active" : ""}`}>
                    {selectedLotId === lot.id ? "Selected" : "Ready"}
                  </span>
                </div>

                <div className="owner-parking-manager__location">
                  <MapPin size={16} />
                  <span>{lot.address}</span>
                </div>

                <div className="owner-parking-manager__summary-grid">
                  <div className="owner-parking-manager__mini-stat owner-parking-manager__mini-stat--neutral">
                    <span>Total</span>
                    <strong>{lot.total_slots}</strong>
                  </div>
                  <div className="owner-parking-manager__mini-stat owner-parking-manager__mini-stat--secondary">
                    <span>Manage</span>
                    <strong>{selectedLotId === lot.id ? "Live" : "Open"}</strong>
                  </div>
                </div>

                <div className="owner-parking-manager__lot-actions">
                  <button type="button" className="owner-parking-manager__secondary-button" onClick={() => viewSlots(lot.id)}>
                    View Slots
                  </button>
                  {canPublish && (
                    <button
                      type="button"
                      className="owner-parking-manager__secondary-button owner-parking-manager__secondary-button--accent"
                      onClick={() => viewSlots(lot.id)}
                      disabled={isViewingSlots}
                      aria-busy={isViewingSlots && selectedLotId === lot.id}
                    >
                      {isViewingSlots && selectedLotId === lot.id && <span className="button-spinner" aria-hidden="true" />}
                      {isViewingSlots && selectedLotId === lot.id ? "Loading..." : "Add Slot"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedLotId && (
        <>
          <section className="owner-parking-manager__section owner-parking-manager__section--details">
            <div className="owner-parking-manager__section-header">
              <div className="owner-parking-manager__section-badge">
                <CarFront size={16} />
                {selectedLot?.name ?? "Parking lot"}
              </div>
              <h3>Parking Slot Status</h3>
            </div>

            {isViewingSlots && (
              <div className="owner-parking-manager__state-card owner-parking-manager__state-card--loading">
                <LoaderCircle className="owner-parking-manager__spinner" size={24} />
                <p>Loading slot information...</p>
              </div>
            )}

            {summary && (
              <div className="owner-parking-manager__stats-grid">
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--neutral">
                  <span>Capacity</span>
                  <strong>{summary.capacity}</strong>
                </div>
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--neutral">
                  <span>Total Created</span>
                  <strong>{summary.created_slots}</strong>
                </div>
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--available">
                  <span>Available</span>
                  <strong>{summary.available_slots}</strong>
                </div>
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--reserved">
                  <span>Reserved</span>
                  <strong>{reservedCount}</strong>
                </div>
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--occupied">
                  <span>Occupied</span>
                  <strong>{summary.occupied_slots}</strong>
                </div>
                <div className="owner-parking-manager__stat-box owner-parking-manager__stat-box--accent">
                  <span>Total</span>
                  <strong>{summary.capacity}</strong>
                </div>
              </div>
            )}

            {summary?.vehicle_summary && (
              <div className="owner-parking-manager__vehicle-summary">
                <h4>Vehicle Type Summary</h4>
                <div className="owner-parking-manager__vehicle-grid">
                  {summary.vehicle_summary.map((entry) => (
                    <div key={entry.vehicle_type} className="owner-parking-manager__vehicle-card">
                      <div className="owner-parking-manager__vehicle-card-header">
                        <span className="owner-parking-manager__vehicle-pill">{formatVehicleType(entry.vehicle_type)}</span>
                      </div>
                      <ul>
                        <li>Total: {entry.total}</li>
                        <li>Available: {entry.available}</li>
                        <li>Reserved: {entry.reserved}</li>
                        <li>Occupied: {entry.occupied}</li>
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ownerSlots.length === 0 ? (
              <div className="owner-parking-manager__state-card">
                <p>No slots created yet.</p>
              </div>
            ) : (
              <div className="owner-parking-manager__slot-grid">
                {ownerSlots.map((slot) => {
                  const slotStatus = getSlotStatus(slot);

                  return (
                    <div key={slot.id} className={`owner-parking-manager__slot-card ${slotStatus.statusClass}`}>
                      <div className="owner-parking-manager__slot-card-top">
                        <span className="owner-parking-manager__slot-number">{slot.slot_number}</span>
                        <span className="owner-parking-manager__slot-status">{slotStatus.label}</span>
                      </div>
                      <p className="owner-parking-manager__slot-vehicle">{formatVehicleType(slot.vehicle_type)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {canPublish && (
          <section className="owner-parking-manager__section owner-parking-manager__section--form">
            <div className="owner-parking-manager__section-header">
              <div className="owner-parking-manager__section-badge">
                <Plus size={16} />
                Slot setup
              </div>
              <h3>Add Parking Slot</h3>
            </div>

            <form onSubmit={handleCreateSlot} className="owner-parking-manager__form owner-parking-manager__form--inline">
              <div className="owner-parking-manager__field">
                <label htmlFor="parking-slot-number">Slot number</label>
                <input
                  id="parking-slot-number"
                  type="text"
                  placeholder="Example: A1"
                  value={slotNumber}
                  onChange={(e) => setSlotNumber(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>

              <div className="owner-parking-manager__field">
                <label htmlFor="vehicle-type">Vehicle Type</label>
                <select
                  id="vehicle-type"
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                >
                  <option value="2_wheeler">2 Wheeler</option>
                  <option value="3_wheeler">3 Wheeler</option>
                  <option value="4_wheeler">4 Wheeler</option>
                </select>
              </div>

              <button
                type="submit"
                className="owner-parking-manager__submit-button"
                disabled={
                  isCreatingSlot ||
                  isViewingSlots ||
                  Boolean(summary && summary.created_slots >= summary.capacity)
                }
                aria-busy={isCreatingSlot}
              >
                {isCreatingSlot && <span className="button-spinner" aria-hidden="true" />}
                {isCreatingSlot ? "Adding slot..." : "Add Slot"}
              </button>
            </form>
          </section>
          )}
        </>
      )}
    </div>
  );
}

export default OwnerParkingManager;
