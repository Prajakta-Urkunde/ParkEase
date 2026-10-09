import { useEffect, useState } from "react";

import {
  confirmOwnerCashPayment,
  getOwnerReservations,
} from "./services/api";

import "./OwnerReservations.css";

type Reservation = {
  id: number;
  parking_lot_id: number;
  parking_lot_name: string;
  parking_slot_id: number;
  slot_number: string;
  user_id: number;
  status: string;
  reserved_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  pending_cancellation_fines?: Array<{ id: number; amount: number }>;
};

type StatusFilter = "all" | "active" | "cancelled" | "completed";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All reservations",
  active: "Active",
  cancelled: "Cancelled",
  completed: "Completed",
};

function OwnerReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [confirmingCashId, setConfirmingCashId] = useState<number | null>(null);

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    try {
      if (reservations.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setMessage("");

      const result = await getOwnerReservations();
      setReservations(result);
    } catch (error) {
      console.error("Failed to load owner reservations:", error);
      setMessage("We couldn't load reservations. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleConfirmCashReceipt(reservation: Reservation) {
    if (confirmingCashId !== null) {
      return;
    }

    try {
      setConfirmingCashId(reservation.id);
      setMessage("");
      await confirmOwnerCashPayment(reservation.id);
      await loadReservations();
      setMessage(`Cash receipt confirmed for reservation #${reservation.id}.`);
    } catch (error) {
      console.error("Failed to confirm cash receipt:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Cash receipt could not be confirmed. Please retry."
      );
    } finally {
      setConfirmingCashId(null);
    }
  }

  const filteredReservations = reservations.filter(
    (reservation) =>
      statusFilter === "all" || reservation.status === statusFilter
  );

  function formatTimestamp(timestamp: string) {
    if (!timestamp) {
      return "Not available";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getStatusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <section className="owner-reservations">
      <div className="owner-reservations-heading">
        <div>
          <p className="owner-reservations-kicker">Owner monitoring</p>
          <h2>Parking Reservations</h2>
          <p>Reservations across your parking lots.</p>
        </div>

        <button
          type="button"
          className="owner-reservations-refresh"
          onClick={loadReservations}
          disabled={loading || refreshing}
          aria-busy={refreshing}
        >
          {refreshing && <span className="button-spinner" aria-hidden="true" />}
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message && (
        <p className="reservation-message" role="alert">
          {message}
        </p>
      )}

      {loading ? (
        <div className="owner-reservations-state">
          <div className="owner-reservations-spinner" aria-hidden="true" />
          <p>Loading reservations...</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="owner-reservations-state">
          <h3>No reservations yet</h3>
          <p>No reservations have been made in your parking lots yet.</p>
        </div>
      ) : (
        <>
          <div className="owner-reservations-toolbar">
            <div className="owner-reservation-filters" aria-label="Filter reservations" role="group">
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
                <button
                  type="button"
                  key={status}
                  className={statusFilter === status ? "is-selected" : ""}
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <span className="owner-reservation-count">
              {filteredReservations.length} shown
            </span>
          </div>

          {filteredReservations.length === 0 ? (
            <div className="owner-reservations-state">
              <h3>No {statusFilter} reservations</h3>
              <p>Try another status filter to view more reservations.</p>
            </div>
          ) : (
            <div className="reservation-table-wrapper">
              <table className="reservation-table">
                <thead>
                  <tr>
                    <th>Reservation</th>
                    <th>Parking Lot</th>
                    <th>Slot</th>
                    <th>Status</th>
                    <th>Reserved At</th>
                    <th>Payment</th>
                    <th>Cancellation Fines</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td data-label="Reservation">#{reservation.id}</td>
                      <td data-label="Parking Lot">
                        {reservation.parking_lot_name}
                      </td>
                      <td data-label="Slot">
                        <strong>{reservation.slot_number}</strong>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`status-badge status-${reservation.status}`}
                        >
                          {getStatusLabel(reservation.status)}
                        </span>
                      </td>
                      <td data-label="Reserved At">
                        {formatTimestamp(reservation.reserved_at)}
                      </td>
                      <td data-label="Payment">
                        {reservation.payment_method
                          ? `${reservation.payment_method.toUpperCase()} — ${reservation.payment_status || "pending"}`
                          : "Not recorded"}
                        {reservation.payment_amount !== null &&
                          reservation.payment_amount !== undefined &&
                          ` — ₹${Number(reservation.payment_amount).toFixed(2)}`}
                      </td>
                      <td data-label="Cancellation Fines">
                        {reservation.pending_cancellation_fines?.length
                          ? reservation.pending_cancellation_fines
                              .map(
                                (fine) =>
                                  `#${fine.id}: ₹${Number(fine.amount).toFixed(2)}`
                              )
                              .join(", ")
                          : "None outstanding"}
                      </td>
                      <td data-label="Actions">
                        {reservation.payment_method === "cash" &&
                          reservation.payment_status === "pending" && (
                            reservation.payment_amount !== null &&
                            reservation.payment_amount !== undefined &&
                            reservation.payment_amount > 0 && (
                            <button
                              type="button"
                              className="owner-reservations-refresh"
                              onClick={() => handleConfirmCashReceipt(reservation)}
                              disabled={confirmingCashId !== null}
                            >
                              {confirmingCashId === reservation.id
                                ? "Recording..."
                                : "Confirm Cash Received"}
                            </button>
                            )
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default OwnerReservations;
