import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./CancelReservationModal.css";

type CancelReservationModalProps = {
  isOpen: boolean;
  reservationId: number;
  parkingLotName: string;
  slotNumber: string;
  reservedAt: string;
  status: string;
  cancellationFine?: number;
  cashAtLocation?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
};

function CancelReservationModal({
  isOpen,
  reservationId,
  parkingLotName,
  slotNumber,
  reservedAt,
  status,
  cancellationFine = 20,
  cashAtLocation = false,
  error = "",
  onClose,
  onConfirm,
}: CancelReservationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (isSubmitting || isClosing) {
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [isClosing, isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = requestAnimationFrame(() =>
      modalRef.current
        ?.querySelector<HTMLElement>("button:not([disabled])")
        ?.focus()
    );

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(focusFrame);
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, requestClose]);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await Promise.resolve(onConfirm());
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      className={`cancel-reservation-overlay${isClosing ? " is-closing" : ""}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="cancel-reservation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-reservation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cancel-reservation-header">
          <div>
            <p className="cancel-reservation-kicker">Reservation</p>
            <h2 id="cancel-reservation-title">Cancel Reservation?</h2>
          </div>

          <button
            type="button"
            className="cancel-reservation-close"
            aria-label="Close cancel reservation dialog"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className="cancel-reservation-body">
          <p className="cancel-reservation-warning">
            {cashAtLocation
              ? "This will release the slot. The ₹20 cancellation fine will remain outstanding until the parking owner confirms cash receipt."
              : "This action will cancel the booking below."}
          </p>
          {error && <p className="cancel-reservation-warning" role="alert">{error}</p>}

          <div className="cancel-reservation-grid">
            <div className="cancel-detail-row">
              <span>Reservation ID</span>
              <strong>#{reservationId}</strong>
            </div>

            <div className="cancel-detail-row">
              <span>Parking Lot</span>
              <strong>{parkingLotName}</strong>
            </div>

            <div className="cancel-detail-row">
              <span>Slot</span>
              <strong>{slotNumber}</strong>
            </div>

            <div className="cancel-detail-row">
              <span>Date & Time</span>
              <strong>{reservedAt}</strong>
            </div>

            <div className="cancel-detail-row">
              <span>Current Status</span>
              <strong>{status}</strong>
            </div>

            <div className="cancel-detail-row">
              <span>Cancellation Fine</span>
              <strong>₹{cancellationFine}</strong>
            </div>
          </div>

          <div className="cancel-reservation-actions">
            <button
              type="button"
              className="cancel-reservation-secondary"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Keep Reservation
            </button>

            <button
              type="button"
              className="cancel-reservation-primary"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="button-spinner" aria-hidden="true" />}
              {isSubmitting
                ? cashAtLocation
                  ? "Cancelling..."
                  : "Preparing payment..."
                : cashAtLocation
                  ? "Cancel and Add Fine to Balance"
                  : "Proceed to Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CancelReservationModal;
