import { useEffect } from "react";
import { createPortal } from "react-dom";

import "./CompleteReservationModal.css";

type CompleteReservationModalProps = {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
};

function CompleteReservationModal({
  isOpen,
  loading = false,
  onClose,
  onConfirm,
}: CompleteReservationModalProps) {
  const handleConfirmClick = () => {
    console.log("COMPLETE BUTTON CLICKED");
    if (loading) {
      return;
    }
    void onConfirm();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="complete-reservation-overlay"
      role="presentation"
      onClick={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      <div
        className="complete-reservation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-reservation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="complete-reservation-kicker">Parking session</p>
        <h2 id="complete-reservation-title">Complete Parking</h2>
        <p className="complete-reservation-message">
          Are you sure you want to complete this parking session?
        </p>

        <div className="complete-reservation-actions">
          <button
            type="button"
            className="complete-reservation-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Keep Active
          </button>
          <button
            type="button"
            className="complete-reservation-primary"
            onClick={handleConfirmClick}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <span className="button-spinner" aria-hidden="true" />}
            {loading ? "Completing..." : "Complete Parking"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CompleteReservationModal;
