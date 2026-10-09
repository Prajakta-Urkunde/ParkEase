import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getAvailableParkingLots,
  getParkingLotSlots,
  checkoutReservation,
  getCheckoutQuote,
  type CheckoutQuote,
  type CheckoutResponse,
  type PaymentMethod,
} from "./services/api";

import ReservationConfirmation from "./ReservationConfirmation";
import ReservationModal from "./components/ReservationModal";
import PaymentMethodModal from "./components/PaymentMethodModal";
import "./ReservationConfirmation.css";
import "./ParkingSearch.css";

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
  vehicle_type?: string;
  status?: string;
  is_available: boolean;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

type LocationStatus =
  | "idle"
  | "locating"
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

type ReservationConfirmationData = {
  reservationId: number;
  parkingLotName: string;
  parkingLotAddress: string;
  slotNumber: string;
  status: string;
  reservedAt: string;
  paymentStatus: string;
  paymentAmount: string;
  paymentCurrency: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
};

type ParkingLotCardProps = {
  lot: ParkingLot;
  index: number;
  userLocation: UserLocation | null;
  isLoadingSlots: boolean;
  onOpenDetails: (lotId: number) => void;
  onSelectLot: (lot: ParkingLot) => void;
  onNavigate: (lot: ParkingLot) => void;
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

const ParkingLotCard = memo(function ParkingLotCard({
  lot,
  index,
  userLocation,
  isLoadingSlots,
  onOpenDetails,
  onSelectLot,
  onNavigate,
}: ParkingLotCardProps) {
  const distance =
    userLocation && lot.latitude !== null && lot.longitude !== null
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          lot.latitude,
          lot.longitude
        )
      : null;

  return (
    <div
      className="parking-lot-card"
      style={{ animationDelay: `${Math.min(index * 15, 120)}ms` }}
      role="button"
      aria-label={`Open details for ${lot.name}`}
      tabIndex={0}
      onClick={() => onOpenDetails(lot.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails(lot.id);
        }
      }}
    >
      <h3>{lot.name}</h3>

      <p>{lot.address}</p>

      <p>
        Available: <strong>{lot.available_slots}</strong> / {lot.total_slots}
      </p>

      <p
        className={
          lot.available_slots > 0
            ? "availability available"
            : "availability full"
        }
      >
        {lot.available_slots > 0 ? "Parking Available" : "Parking Full"}
      </p>

      {distance !== null && (
        <p className="distance">Distance: {distance.toFixed(1)} km</p>
      )}

      <div className="parking-card-actions">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSelectLot(lot);
          }}
          disabled={isLoadingSlots}
          aria-busy={isLoadingSlots}
        >
          {isLoadingSlots && (
            <span className="button-spinner" aria-hidden="true" />
          )}
          {isLoadingSlots ? "Loading..." : "View Slots"}
        </button>

        <button
          type="button"
          style={{ background: "#059669" }}
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(lot);
          }}
        >
          Navigate
        </button>
      </div>
    </div>
  );
});

function ParkingSearch() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);

  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [availabilityRefreshError, setAvailabilityRefreshError] =
    useState(false);

  const [search, setSearch] = useState("");
  const [selectedVehicleType, setSelectedVehicleType] = useState("2_wheeler");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"distance" | "availability">(
    "availability"
  );

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");

  const [confirmation, setConfirmation] =
    useState<ReservationConfirmationData | null>(null);
  const [selectedReservationLot, setSelectedReservationLot] =
    useState<ParkingLot | null>(null);
  const [selectedReservationSlot, setSelectedReservationSlot] =
    useState<ParkingSlot | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] =
    useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutQuote, setCheckoutQuote] = useState<CheckoutQuote | null>(null);
  const [checkoutDurationMinutes, setCheckoutDurationMinutes] = useState(60);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const refreshInFlight = useRef(false);
  const checkoutInFlight = useRef(false);
  const checkoutQuoteRequestId = useRef(0);
  const availabilityPollingPaused = useRef(false);
  const selectedLotRef = useRef<ParkingLot | null>(null);
  selectedLotRef.current = selectedLot;

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      if (!availabilityPollingPaused.current) {
        void refreshParkingAvailability();
      }
    }, 10000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, []);

  async function refreshParkingAvailability() {
    if (refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;

    try {
      const updatedLots = await getAvailableParkingLots();
      setLots(updatedLots);
      setAvailabilityRefreshError(false);

      const currentSelectedLot = selectedLotRef.current;

      if (currentSelectedLot) {
        const updatedSlotsResult = await getParkingLotSlots(
          currentSelectedLot.id
        );
        if (selectedLotRef.current?.id === currentSelectedLot.id) {
          setSlots(updatedSlotsResult.slots);
        }

        const updatedSelectedLot = updatedLots.find(
          (lot: ParkingLot) => lot.id === currentSelectedLot.id
        );

        if (updatedSelectedLot) {
          setSelectedLot(updatedSelectedLot);
        }
      }
    } catch (error) {
      console.error("Failed to refresh parking availability:", error);
      setAvailabilityRefreshError(true);
    } finally {
      refreshInFlight.current = false;
    }
  }

  async function loadLots() {
    try {
      setLoading(true);

      const result = await getAvailableParkingLots();
      setLots(result);
      setAvailabilityRefreshError(false);
    } catch (error) {
      console.error("Failed to load parking lots:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load parking lots"
      );
    } finally {
      setLoading(false);
    }
  }

  const selectLot = useCallback(async (lot: ParkingLot) => {
    if (isLoadingSlots) {
      return;
    }

    try {
      setIsLoadingSlots(true);
      setMessage("");
      setSlotsError("");
      setSelectedLot(lot);

      const result = await getParkingLotSlots(lot.id);
      setSlots(result.slots.filter((slot: ParkingSlot) => !selectedVehicleType || slot.vehicle_type === selectedVehicleType));
    } catch (error) {
      console.error("Failed to load parking slots:", error);
      setSlotsError("We couldn't load the parking slots. Please try again.");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load parking slots"
      );
    } finally {
      setIsLoadingSlots(false);
    }
  }, [isLoadingSlots, selectedVehicleType]);

  function openReservationModal(slot: ParkingSlot) {
    if (!selectedLot) {
      return;
    }

    setSelectedReservationLot(selectedLot);
    setSelectedReservationSlot(slot);
    setMessage("");
    setCheckoutError("");
    setCheckoutDurationMinutes(60);
    availabilityPollingPaused.current = true;
    setIsReservationModalOpen(true);
  }

  async function loadCheckoutQuote(durationMinutes = checkoutDurationMinutes) {
    const requestId = checkoutQuoteRequestId.current + 1;
    checkoutQuoteRequestId.current = requestId;
    setIsQuoteLoading(true);
    setCheckoutError("");
    try {
      const quote = await getCheckoutQuote(durationMinutes);
      if (requestId === checkoutQuoteRequestId.current) {
        setCheckoutQuote(quote);
      }
    } catch (error) {
      if (requestId === checkoutQuoteRequestId.current) {
        setCheckoutQuote(null);
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "Unable to load the latest payment breakdown."
        );
      }
    } finally {
      if (requestId === checkoutQuoteRequestId.current) {
        setIsQuoteLoading(false);
      }
    }
  }

  function proceedToPayment() {
    if (!selectedReservationLot || !selectedReservationSlot) {
      return;
    }

    setCheckoutError("");
    setCheckoutQuote(null);
    setIsReservationModalOpen(false);
    availabilityPollingPaused.current = true;
    setIsPaymentModalOpen(true);
    void loadCheckoutQuote();
  }

  async function confirmCheckout(paymentMethod: PaymentMethod) {
    if (
      !selectedReservationLot ||
      !selectedReservationSlot ||
      checkoutInFlight.current
    ) {
      return false;
    }

    checkoutInFlight.current = true;
    setIsCheckoutLoading(true);
    setCheckoutError("");
    setMessage("");

    try {
      const result: CheckoutResponse = await checkoutReservation(
        selectedReservationLot.id,
        selectedReservationSlot.id,
        paymentMethod,
        selectedVehicleType,
        checkoutDurationMinutes
      );

      const reservationData: ReservationConfirmationData = {
        reservationId: result.reservation.id,
        parkingLotName: selectedReservationLot.name,
        parkingLotAddress: selectedReservationLot.address,
        slotNumber: selectedReservationSlot.slot_number,
        status: result.reservation.status,
        reservedAt: result.reservation.reserved_at,
        paymentStatus: result.payment.status,
        paymentAmount: result.payment.amount,
        paymentCurrency: result.payment.currency,
        paymentMethod: result.payment.method,
        transactionId: result.payment.transaction_id,
      };

      setConfirmation(reservationData);
      setIsPaymentModalOpen(false);
      setSelectedReservationLot(null);
      setSelectedReservationSlot(null);
      setCheckoutQuote(null);
      setCheckoutDurationMinutes(60);
      availabilityPollingPaused.current = false;
      void refreshParkingAvailability();
      return true;
    } catch (error) {
      console.error("Failed to complete payment checkout:", error);
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to complete payment checkout. Please try again."
      );
      return false;
    } finally {
      checkoutInFlight.current = false;
      setIsCheckoutLoading(false);
    }
  }

  function closeReservationModal() {
    setSelectedReservationLot(null);
    setSelectedReservationSlot(null);
    availabilityPollingPaused.current = false;
    setIsReservationModalOpen(false);
  }

  function closePaymentModal() {
    if (isCheckoutLoading) {
      return;
    }

    setIsPaymentModalOpen(false);
    setCheckoutError("");
    setSelectedReservationLot(null);
    setSelectedReservationSlot(null);
    setCheckoutQuote(null);
    availabilityPollingPaused.current = false;
  }

  const navigateToParkingLot = useCallback((lot: ParkingLot) => {
    if (lot.latitude === null || lot.longitude === null) {
      setMessage(
        "Navigation is unavailable because this parking lot has no location coordinates."
      );
      return;
    }

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`;
    window.open(navigationUrl, "_blank");
  }, []);

  const openParkingLotDetails = useCallback((lotId: number) => {
    navigate(`/parking/${lotId}`);
  }, [navigate]);

  function useMyLocation() {
    if (locationStatus === "locating" || locationStatus === "granted") {
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationMessage(
        "Location is not supported by this browser. You can still search parking manually."
      );
      return;
    }

    setLocationStatus("locating");
    setLocationMessage("Requesting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationStatus("granted");
        setLocationMessage("Your location has been detected.");
      },
      (error) => {
        if (error.code === 1) {
          setLocationStatus("denied");
          setLocationMessage(
            "Location permission was denied. You can still search parking manually, or try again after enabling it in your browser settings."
          );
        } else if (error.code === 2) {
          setLocationStatus("error");
          setLocationMessage(
            "Your location is temporarily unavailable. Check your device location settings and try again."
          );
        } else if (error.code === 3) {
          setLocationStatus("error");
          setLocationMessage(
            "Location detection timed out. Try again, or continue searching manually."
          );
        } else {
          setLocationStatus("error");
          setLocationMessage(
            "Unable to detect your location. You can continue searching manually."
          );
        }
      }
    );
  }

  const filteredLots = useMemo(() => {
    const searchText = search.toLowerCase();
    const getDistance = (lot: ParkingLot): number | null => {
      if (
        !userLocation ||
        lot.latitude === null ||
        lot.longitude === null
      ) {
        return null;
      }

      return calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        lot.latitude,
        lot.longitude
      );
    };

    return lots
      .filter((lot) => {
        const matchesSearch =
          lot.name.toLowerCase().includes(searchText) ||
          lot.address.toLowerCase().includes(searchText);
        const matchesAvailability =
          !availableOnly || lot.available_slots > 0;
        const distance = getDistance(lot);
        const matchesNearMe = !nearMeOnly || distance !== null;

        return matchesSearch && matchesAvailability && matchesNearMe;
      })
      .sort((a, b) => {
        if (sortBy === "availability") {
          return b.available_slots - a.available_slots;
        }

        if (!userLocation) {
          return 0;
        }

        const distanceA = getDistance(a);
        const distanceB = getDistance(b);

        if (distanceA === null) {
          return distanceB === null ? 0 : 1;
        }
        if (distanceB === null) {
          return -1;
        }

        return distanceA - distanceB;
      });
  }, [availableOnly, lots, nearMeOnly, search, sortBy, userLocation]);

  if (loading) {
    return (
      <div className="parking-container">
        <p>Loading parking lots...</p>
      </div>
    );
  }

  return (
    <div className="parking-container">
      <ReservationModal
        isOpen={isReservationModalOpen}
        parkingLotName={selectedReservationLot?.name ?? "Selected Parking Lot"}
        parkingLotAddress={selectedReservationLot?.address ?? ""}
        slotNumber={selectedReservationSlot?.slot_number ?? ""}
        availabilityStatus={
          selectedReservationSlot?.is_available ? "Available" : "Occupied"
        }
        onClose={closeReservationModal}
        onProceedToPayment={proceedToPayment}
      />

      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        loading={isCheckoutLoading}
        error={checkoutQuote ? checkoutError : ""}
        quote={checkoutQuote}
        quoteLoading={isQuoteLoading}
        quoteError={checkoutError && !checkoutQuote ? checkoutError : ""}
        parkingDurationMinutes={checkoutDurationMinutes}
        onRetryQuote={() => {
          void loadCheckoutQuote();
        }}
        onDurationChange={(durationMinutes) => {
          setCheckoutDurationMinutes(durationMinutes);
          void loadCheckoutQuote(durationMinutes);
        }}
        reservationIdentifier={selectedReservationSlot?.slot_number ?? "selected slot"}
        onClose={closePaymentModal}
        onConfirm={confirmCheckout}
      />

      {confirmation && (
        <ReservationConfirmation
          reservationId={confirmation.reservationId}
          parkingLotName={confirmation.parkingLotName}
          parkingLotAddress={confirmation.parkingLotAddress}
          slotNumber={confirmation.slotNumber}
          status={confirmation.status}
          reservedAt={confirmation.reservedAt}
          paymentStatus={confirmation.paymentStatus}
          paymentAmount={confirmation.paymentAmount}
          paymentCurrency={confirmation.paymentCurrency}
          paymentMethod={confirmation.paymentMethod}
          transactionId={confirmation.transactionId}
          onBookAnother={() => setConfirmation(null)}
        />
      )}

      <div className="parking-search-heading">
        <div>
          <p className="parking-search-kicker">Parking discovery</p>
          <h2>Find Parking</h2>
          <p>Compare nearby spaces and choose the right place to park.</p>
        </div>
        <span className="parking-result-count">
          {filteredLots.length} {filteredLots.length === 1 ? "location" : "locations"}
        </span>
      </div>

      <div className="location-control">
        <div className="location-control-copy">
          <strong>Find parking near you</strong>
          <span>
            Location access helps sort parking lots by distance. Your manual
            search remains available if you decline.
          </span>
        </div>
        <button
          className="location-button"
          onClick={useMyLocation}
          disabled={
            locationStatus === "locating" || locationStatus === "granted"
          }
        >
          {locationStatus === "locating"
            ? "Finding location..."
            : locationStatus === "granted"
              ? "Location enabled"
              : "Use My Location"}
        </button>
      </div>

      {locationMessage && (
        <p
          className={`location-message location-message-${locationStatus}`}
          role={locationStatus === "error" ? "alert" : "status"}
        >
          {locationMessage}
        </p>
      )}

      {userLocation && (
        <p className="nearby-message">📍 Showing nearest parking first</p>
      )}

      {message && <p className="parking-message">{message}</p>}

      <div className="availability-status" role="status">
        <span className="availability-status-dot" aria-hidden="true" />
        <span>LIVE AVAILABILITY</span>
        {availabilityRefreshError && (
          <small>Refresh temporarily unavailable</small>
        )}
      </div>

      <div className="parking-search-controls">
        <div className="vehicle-type-selector" aria-label="Vehicle type selector">
          <span className="vehicle-type-label">Select Vehicle Type</span>
          <div className="vehicle-type-options">
            {[
              { value: "2_wheeler", label: "🏍 2 Wheeler" },
              { value: "3_wheeler", label: "🛺 3 Wheeler" },
              { value: "4_wheeler", label: "🚗 4 Wheeler" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={selectedVehicleType === option.value ? "vehicle-type-btn active" : "vehicle-type-btn"}
                onClick={() => {
                  setSelectedVehicleType(option.value);
                  if (selectedLot) {
                    void selectLot(selectedLot);
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <input
          className="parking-search-input"
          id="parking-search"
          type="text"
          aria-label="Search parking by name or address"
          placeholder="Search by parking name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="parking-search-filter-row">
          <label className="parking-filter-toggle">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <span>Available Now</span>
          </label>

          <label className="parking-filter-toggle">
            <input
              type="checkbox"
              checked={nearMeOnly}
              onChange={(e) => setNearMeOnly(e.target.checked)}
            />
            <span>Near Me</span>
          </label>

          <label className="parking-sort-control">
            <span>Sort by</span>
            <select
              aria-label="Sort parking lots"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "distance" | "availability")
              }
            >
              <option value="availability">Availability</option>
              <option value="distance">Distance</option>
            </select>
          </label>
        </div>
      </div>

      <div className="parking-lots">
        {filteredLots.length === 0 ? (
          <div className="parking-empty-state">
            <span className="parking-empty-icon" aria-hidden="true">
              ⌕
            </span>
            <h3>No parking lots found</h3>
            <p>
              {nearMeOnly && !userLocation
                ? "Use My Location to find lots near you, or turn off the Near Me filter."
                : "Try a different search or adjust your filters to see more parking options."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAvailableOnly(false);
                setNearMeOnly(false);
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredLots.map((lot, index) => (
            <ParkingLotCard
              key={lot.id}
              lot={lot}
              index={index}
              userLocation={userLocation}
              isLoadingSlots={isLoadingSlots}
              onOpenDetails={openParkingLotDetails}
              onSelectLot={selectLot}
              onNavigate={navigateToParkingLot}
            />
          ))
        )}
      </div>

      {selectedLot && (
        <div className="slot-section">
          <h2>{selectedLot.name} — Parking Slots</h2>

          {isLoadingSlots ? (
            <div className="slot-state" aria-live="polite">
              <div className="slot-spinner" aria-hidden="true" />
              <p>Loading parking slots...</p>
            </div>
          ) : slotsError ? (
            <div className="slot-state slot-state-error" role="alert">
              <p>{slotsError}</p>
              <button type="button" onClick={() => selectLot(selectedLot)}>
                Try again
              </button>
            </div>
          ) : slots.length === 0 ? (
            <div className="slot-state">
              <p>No parking slots have been created for this lot yet.</p>
            </div>
          ) : (
            <div className="slot-grid">
              {slots
                .filter((slot) => slot.vehicle_type === selectedVehicleType)
                .map((slot) => (
                  <div
                    className={
                      slot.is_available
                        ? "slot available"
                        : "slot occupied"
                    }
                    key={slot.id}
                  >
                    <strong>{slot.slot_number}</strong>
                    <span>{slot.vehicle_type === "2_wheeler" ? "2 Wheeler" : slot.vehicle_type === "3_wheeler" ? "3 Wheeler" : "4 Wheeler"}</span>
                    <span>
                      {slot.status ? slot.status.charAt(0).toUpperCase() + slot.status.slice(1).toLowerCase() : slot.is_available ? "Available" : "Occupied"}
                    </span>

                    {slot.is_available && (
                      <button
                        type="button"
                        onClick={() => openReservationModal(slot)}
                        disabled={isCheckoutLoading}
                      >
                        {isCheckoutLoading ? "Please wait..." : "Reserve"}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ParkingSearch;
