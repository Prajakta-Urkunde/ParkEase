import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./ReservationModal.css";

type ReservationModalProps = {
  isOpen: boolean;
  parkingLotName: string;
  parkingLotAddress: string;
  slotNumber: string;
  availabilityStatus?: string;
  onClose: () => void;
  onProceedToPayment: () => void;
};

function ReservationModal({
  isOpen,
  parkingLotName,
  parkingLotAddress,
  slotNumber,
  availabilityStatus = "Available",
  onClose,
  onProceedToPayment,
}: ReservationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (isSubmittingRef.current || isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      isClosingRef.current = false;
      setIsClosing(false);
      onCloseRef.current();
    }, 180);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingRef.current) {
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

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = requestAnimationFrame(() =>
      modalRef.current
        ?.querySelector<HTMLElement>("button:not([disabled])")
        ?.focus()
    );

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(focusFrame);
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
        isClosingRef.current = false;
      }
      previousFocusRef.current?.focus();
    };
  }, [isOpen, requestClose]);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      onProceedToPayment();
    } catch (error) {
      console.error("Reservation confirmation failed:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't complete this reservation. Please try again."
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      className={`reservation-modal-overlay${isClosing ? " is-closing" : ""}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="reservation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="reservation-modal-header">
          <div>
            <p className="reservation-modal-eyebrow">Reservation</p>
            <h2 id="reservation-modal-title">Confirm Booking</h2>
          </div>

          <button
            type="button"
            className="reservation-modal-close"
            aria-label="Close reservation confirmation"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className="reservation-modal-body">
          <div className="reservation-modal-status">
            <span className="reservation-modal-badge">{availabilityStatus}</span>
          </div>

          <div className="reservation-modal-details">
            {submitError && (
              <p className="reservation-modal-error" role="alert">
                {submitError}
              </p>
            )}
            <div className="reservation-detail-row">
              <span>Parking Lot</span>
              <strong>{parkingLotName}</strong>
            </div>

            <div className="reservation-detail-row">
              <span>Address</span>
              <strong>{parkingLotAddress}</strong>
            </div>

            <div className="reservation-detail-row">
              <span>Selected Slot</span>
              <strong>{slotNumber}</strong>
            </div>

            <div className="reservation-detail-row">
              <span>Current Availability</span>
              <strong>{availabilityStatus}</strong>
            </div>
          </div>
        </div>

        <footer className="reservation-modal-actions">
          <button
            type="button"
            className="reservation-modal-secondary"
            onClick={requestClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="reservation-modal-primary"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting && <span className="button-spinner" aria-hidden="true" />}
            {isSubmitting ? "Opening payment..." : "Continue to Payment"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default ReservationModal;
