import { useEffect, useMemo, useState } from "react";
import {
  getUserReservations,
  cancelReservation,
  completeReservation,
  startParking,
  getCancellationFines,
  type PaymentMethod,
  type CancellationFineRecord,
} from "./services/api";
import CancelReservationModal from "./components/CancelReservationModal";
import CompleteReservationModal from "./components/CompleteReservationModal";
import PaymentMethodModal from "./components/PaymentMethodModal";
import "./ReservationHistory.css";

type Reservation = {
  id: number;
  parking_lot_id: number;
  parking_lot_name?: string;
  parking_slot_id: number;
  slot_number?: string;
  vehicle_type?: string;
  status: string;
  parking_status?: string;
  reserved_at: string;
  parking_started_at?: string | null;
  parking_completed_at?: string | null;
  cancellation_fine?: number;
  final_amount?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  transaction_id?: string | null;
  cancellation_fine_status?: "PENDING" | "PAID" | null;
};

type ReservationHistoryProps = {
  onReservationChange?: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  completed: "Completed",
  past: "Past",
};

function ReservationHistory({
  onReservationChange,
}: ReservationHistoryProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [cancellationFines, setCancellationFines] =
    useState<CancellationFineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [selectedReservationToCancel, setSelectedReservationToCancel] =
    useState<Reservation | null>(null);
  const [selectedReservationToComplete, setSelectedReservationToComplete] =
    useState<Reservation | null>(null);
  const [isCancellationPaymentOpen, setIsCancellationPaymentOpen] =
    useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    loadReservations();
  }, []);

  const summary = useMemo(() => {
    const activeCount = reservations.filter(
      (reservation) => reservation.status === "active"
    ).length;
    const cancelledCount = reservations.filter(
      (reservation) => reservation.status === "cancelled"
    ).length;
    const completedCount = reservations.filter(
      (reservation) =>
        reservation.status === "completed" || reservation.status === "past"
    ).length;

    return {
      total: reservations.length,
      active: activeCount,
      cancelled: cancelledCount,
      completed: completedCount,
    };
  }, [reservations]);

  async function loadReservations() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const [result, fines] = await Promise.all([
        getUserReservations(),
        getCancellationFines(),
      ]);
      setReservations(result);
      setCancellationFines(fines);
    } catch (error) {
      console.error("Failed to load reservations:", error);
      const nextMessage =
        "We couldn't load your reservations. Please try again.";

      setError(nextMessage);
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelConfirmation() {
    if (!selectedReservationToCancel || cancellingId !== null) {
      return;
    }

    if (selectedReservationToCancel.payment_method === "cash") {
      await handleCancellationPayment("cash");
      return;
    }

    setIsCancellationPaymentOpen(true);
  }

  async function handleCancellationPayment(method: PaymentMethod) {
    if (!selectedReservationToCancel || cancellingId !== null) {
      return false;
    }

    try {
      setPaymentLoading(true);
      setPaymentError("");
      setError("");
      setMessage("");

      const result = await cancelReservation(
        selectedReservationToCancel.id,
        method
      );

      setIsCancellationPaymentOpen(false);
      setSelectedReservationToCancel(null);
      await loadReservations();

      if (onReservationChange) {
        onReservationChange();
      }

      setMessage(
        result.fine_status === "PENDING"
          ? "Reservation cancelled. The ₹20 cancellation fine is outstanding and will be included with your next booking."
          : "Reservation cancelled and the cancellation fine was paid."
      );
      return true;
    } catch (error) {
      console.error("Failed to cancel reservation after mock payment:", error);
      const nextMessage =
        error instanceof Error ? error.message : "Payment failed. Your reservation is still active.";

      setPaymentError(nextMessage);
      setError("Payment failed. Your reservation is still active.");
      setMessage("Payment failed. Your reservation is still active.");
      return false;
    } finally {
      setPaymentLoading(false);
      setCancellingId(null);
    }
  }

  async function handleCompleteConfirmation() {
    if (!selectedReservationToComplete || completingId !== null) {
      console.log("COMPLETE HANDLER RETURNED EARLY", {
        hasSelectedReservation: Boolean(selectedReservationToComplete),
        completingId,
      });
      return;
    }

    console.log("COMPLETE HANDLER CALLED", selectedReservationToComplete.id);

    try {
      setCompletingId(selectedReservationToComplete.id);
      setError("");
      setMessage("");

      console.log("CALLING COMPLETE API", selectedReservationToComplete.id);
      await completeReservation(selectedReservationToComplete.id);

      setSelectedReservationToComplete(null);
      await loadReservations();

      if (onReservationChange) {
        onReservationChange();
      }

      setMessage("Parking session completed successfully.");
    } catch (error) {
      console.error("Failed to complete reservation:", error);
      const nextMessage =
        error instanceof Error
          ? error.message
          : "We couldn't complete this parking session. Please try again.";

      setError(nextMessage);
      setMessage(nextMessage);
    } finally {
      setCompletingId(null);
    }
  }

  async function handleStartParking(reservation: Reservation) {
    if (startingId !== null) {
      return;
    }

    try {
      setStartingId(reservation.id);
      setError("");
      setMessage("");

      await startParking(reservation.id);
      await loadReservations();
      if (onReservationChange) {
        onReservationChange();
      }
      setMessage("Parking started successfully.");
    } catch (error) {
      console.error("Failed to start parking:", error);
      const nextMessage =
        error instanceof Error
          ? error.message
          : "We couldn't start parking for this reservation.";
      setError(nextMessage);
      setMessage(nextMessage);
    } finally {
      setStartingId(null);
    }
  }

  function formatDate(date: string) {
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime())
      ? "Not available"
      : parsedDate.toLocaleString();
  }

  function getStatusClass(status: string) {
    if (status === "active") {
      return "active";
    }

    if (status === "cancelled") {
      return "cancelled";
    }

    return "completed";
  }

  function getParkingStatusValue(status?: string) {
    return (status || "AVAILABLE").toUpperCase();
  }

  return (
    <section className="reservation-history" id="my-reservations">
      <CancelReservationModal
        isOpen={Boolean(selectedReservationToCancel) && !isCancellationPaymentOpen}
        reservationId={selectedReservationToCancel?.id ?? 0}
        parkingLotName={
          selectedReservationToCancel?.parking_lot_name ||
          `Parking Lot #${selectedReservationToCancel?.parking_lot_id ?? 0}`
        }
        slotNumber={
          selectedReservationToCancel?.slot_number ||
          `Slot #${selectedReservationToCancel?.parking_slot_id ?? 0}`
        }
        reservedAt={
          selectedReservationToCancel?.reserved_at
            ? formatDate(selectedReservationToCancel.reserved_at)
            : "-"
        }
        status={selectedReservationToCancel?.status || "active"}
        cancellationFine={
          typeof selectedReservationToCancel?.cancellation_fine === "number" &&
          selectedReservationToCancel.cancellation_fine > 0
            ? selectedReservationToCancel.cancellation_fine
            : 20
        }
        cashAtLocation={selectedReservationToCancel?.payment_method === "cash"}
        error={paymentError}
        onClose={() => {
          setSelectedReservationToCancel(null);
          setIsCancellationPaymentOpen(false);
        }}
        onConfirm={handleCancelConfirmation}
      />

      <PaymentMethodModal
        isOpen={isCancellationPaymentOpen && Boolean(selectedReservationToCancel)}
        loading={paymentLoading}
        error={paymentError}
        reservationIdentifier={`#${selectedReservationToCancel?.id ?? 0}`}
        amount={
          typeof selectedReservationToCancel?.cancellation_fine === "number" &&
          selectedReservationToCancel.cancellation_fine > 0
            ? selectedReservationToCancel.cancellation_fine
            : 20
        }
        context="cancellation"
        onClose={() => {
          setIsCancellationPaymentOpen(false);
          setPaymentError("");
        }}
        onConfirm={handleCancellationPayment}
      />

      <CompleteReservationModal
        isOpen={Boolean(selectedReservationToComplete)}
        loading={completingId !== null}
        onClose={() => setSelectedReservationToComplete(null)}
        onConfirm={handleCompleteConfirmation}
      />

      <div className="reservation-header">
        <div>
          <p className="reservation-kicker">Booking overview</p>
          <h2>My Reservations</h2>
        </div>

        <button
          className="refresh-reservations"
          onClick={loadReservations}
          disabled={loading}
          aria-busy={loading}
        >
          {loading && <span className="button-spinner" aria-hidden="true" />}
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="reservation-summary">
        <article className="summary-card primary">
          <span className="summary-label">Active</span>
          <strong>{summary.active}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Total</span>
          <strong>{summary.total}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Cancelled</span>
          <strong>{summary.cancelled}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Completed / Past</span>
          <strong>{summary.completed}</strong>
        </article>
      </div>

      {cancellationFines.length > 0 && (
        <section className="cancellation-fines" aria-labelledby="cancellation-fines-title">
          <h3 id="cancellation-fines-title">Cancellation Fines</h3>
          <p>
            Outstanding: ₹
            {cancellationFines
              .filter((fine) => fine.status === "PENDING")
              .reduce((total, fine) => total + Number(fine.amount), 0)
              .toFixed(2)}
          </p>
          <ul>
            {cancellationFines.map((fine) => (
              <li key={fine.id}>
                <span>
                  Cancellation #{fine.cancellation_reservation_id} — ₹
                  {Number(fine.amount).toFixed(2)}
                </span>
                <strong className={`fine-status fine-status-${fine.status.toLowerCase()}`}>
                  {fine.status}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && (
        <p className="reservation-message" role="status">
          {message}
        </p>
      )}

      {error && !loading && reservations.length === 0 && (
        <div className="reservation-error">
          <h3>Unable to load reservations</h3>
          <p>{error}</p>
          <button type="button" onClick={loadReservations}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="reservation-loading">
          <div className="reservation-spinner" aria-hidden="true" />
          <p>Loading your reservations...</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="empty-reservations">
          <div className="empty-icon" aria-hidden="true">
            📍
          </div>
          <h3>No reservations yet</h3>
          <p>Your parking reservations will appear here.</p>
        </div>
      ) : (
        <div className="reservation-list">
          {reservations.map((reservation) => {
            const parkingStatus = getParkingStatusValue(reservation.parking_status);
            const canStartParking =
              reservation.status === "active" && parkingStatus === "RESERVED";
            const canCompleteParking =
              reservation.status === "active" && parkingStatus === "OCCUPIED";

            return (
              <article className="reservation-card" key={reservation.id}>
                <div className="reservation-card-header">
                  <div>
                    <p className="reservation-card-label">Reservation ID</p>
                    <h3>#{reservation.id}</h3>
                  </div>

                  <span
                    className={`reservation-badge ${getStatusClass(
                      reservation.status
                    )}`}
                  >
                    {STATUS_LABELS[reservation.status] || reservation.status}
                  </span>
                </div>

                <div className="reservation-card-main">
                  <div className="reservation-card-block">
                    <span className="reservation-meta-label">Parking lot</span>
                    <strong>
                      {reservation.parking_lot_name ||
                        `Parking Lot #${reservation.parking_lot_id}`}
                    </strong>
                  </div>

                  <div className="reservation-card-block">
                    <span className="reservation-meta-label">Slot</span>
                    <strong>
                      {reservation.slot_number ||
                        `Slot #${reservation.parking_slot_id}`}
                    </strong>
                  </div>

                  <div className="reservation-card-block wide">
                    <span className="reservation-meta-label">Date & time</span>
                    <strong>{formatDate(reservation.reserved_at)}</strong>
                  </div>

                  <div className="reservation-card-block">
                    <span className="reservation-meta-label">Reservation Status</span>
                    <strong>{STATUS_LABELS[reservation.status] || reservation.status}</strong>
                  </div>

                  <div className="reservation-card-block">
                    <span className="reservation-meta-label">Parking Status</span>
                    <strong>{reservation.parking_status ? reservation.parking_status.charAt(0).toUpperCase() + reservation.parking_status.slice(1).toLowerCase() : "Available"}</strong>
                  </div>

                  {reservation.vehicle_type && (
                    <div className="reservation-card-block">
                      <span className="reservation-meta-label">Vehicle Type</span>
                      <strong>{reservation.vehicle_type === "2_wheeler" ? "2 Wheeler" : reservation.vehicle_type === "3_wheeler" ? "3 Wheeler" : "4 Wheeler"}</strong>
                    </div>
                  )}

                  {reservation.cancellation_fine !== undefined && reservation.cancellation_fine > 0 && (
                    <div className="reservation-card-block wide">
                      <span className="reservation-meta-label">Cancellation Fine</span>
                      <strong>
                        ₹{reservation.cancellation_fine}
                        {reservation.cancellation_fine_status
                          ? ` — ${reservation.cancellation_fine_status}`
                          : ""}
                      </strong>
                    </div>
                  )}
                </div>

                {reservation.status === "active" && (
                  <div className="reservation-card-actions">
                    {canStartParking && (
                      <button
                        className="complete-reservation"
                        onClick={() => handleStartParking(reservation)}
                        disabled={startingId === reservation.id || cancellingId === reservation.id || completingId === reservation.id}
                      >
                        {startingId === reservation.id ? "Starting..." : "Start Parking"}
                      </button>
                    )}

                    {canCompleteParking && (
                      <button
                        type="button"
                        className="complete-reservation"
                        onClick={() => setSelectedReservationToComplete(reservation)}
                        disabled={cancellingId === reservation.id || completingId === reservation.id || startingId === reservation.id}
                      >
                        {completingId === reservation.id ? "Completing..." : "Complete Parking"}
                      </button>
                    )}

                    {!canCompleteParking && reservation.status === "active" && (
                      <button
                        className="cancel-reservation"
                                          onClick={() => {
                                            setPaymentError("");
                                            setSelectedReservationToCancel(reservation);
                                          }}
                        disabled={
                          cancellingId === reservation.id ||
                          completingId === reservation.id ||
                          startingId === reservation.id
                        }
                      >
                        {cancellingId === reservation.id ? "Cancelling..." : "Cancel Reservation"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ReservationHistory;
