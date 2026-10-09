import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

import type { CheckoutQuote, PaymentMethod } from "../services/api";
import "./PaymentMethodModal.css";

type PaymentMethodModalProps = {
  isOpen: boolean;
  loading?: boolean;
  error?: string;
  reservationIdentifier: string;
  amount?: number;
  context?: "reservation" | "cancellation";
  quote?: CheckoutQuote | null;
  quoteLoading?: boolean;
  quoteError?: string;
  parkingDurationMinutes?: number;
  onRetryQuote?: () => void;
  onDurationChange?: (minutes: number) => void;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => Promise<boolean | void> | boolean | void;
};

type CardDetails = {
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
};

const EMPTY_CARD_DETAILS: CardDetails = {
  cardholderName: "",
  cardNumber: "",
  expiryDate: "",
  cvv: "",
};

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "upi",
    label: "UPI",
    description: "Mock UPI payment",
  },
  {
    value: "card",
    label: "Card",
    description: "Mock credit/debit card payment",
  },
  {
    value: "cash",
    label: "Cash",
    description: "Pay at parking location",
  },
];

function PaymentMethodModal({
  isOpen,
  loading = false,
  error = "",
  reservationIdentifier,
  amount = 50,
  context = "reservation",
  quote = null,
  quoteLoading = false,
  quoteError = "",
  parkingDurationMinutes = 60,
  onRetryQuote,
  onDurationChange,
  onClose,
  onConfirm,
}: PaymentMethodModalProps) {
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod | null>(null);
  const [cardDetails, setCardDetails] =
    useState<CardDetails>(EMPTY_CARD_DETAILS);
  const [cardError, setCardError] = useState("");
  const submitInFlight = useRef(false);

  function closeModal() {
    if (loading) {
      return;
    }

    setSelectedMethod(null);
    setCardDetails(EMPTY_CARD_DETAILS);
    setCardError("");
    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        setSelectedMethod(null);
        setCardDetails(EMPTY_CARD_DETAILS);
        setCardError("");
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

  const totalAmount = quote ? Number(quote.total_amount) : amount;
  const amountLabel = `₹${totalAmount.toFixed(2)} INR`;
  const demoQrPayload = [
    context === "cancellation" ? "ParkEase Cancellation Payment" : "ParkEase Demo Payment",
    `Amount: INR ${totalAmount}`,
    "Method: UPI",
    `Reservation: ${reservationIdentifier}`,
    "Demo: true",
  ].join("\n");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedMethod || loading || submitInFlight.current) {
      return;
    }

    if (selectedMethod === "card" && !validateCardDetails()) {
      return;
    }

    submitInFlight.current = true;
    void (async () => {
      try {
        const succeeded = await onConfirm(selectedMethod);
        if (succeeded === true) {
          setCardDetails(EMPTY_CARD_DETAILS);
          setCardError("");
        }
      } catch (error) {
        setCardError(
          error instanceof Error
            ? error.message
            : "Unable to complete this request. Please try again."
        );
      } finally {
        submitInFlight.current = false;
      }
    })();
  }

  function validateCardDetails() {
    const cardholderName = cardDetails.cardholderName.trim();
    const cardDigits = cardDetails.cardNumber.replace(/\s/g, "");

    if (cardholderName.length < 2) {
      setCardError("Enter a cardholder name.");
      return false;
    }

    if (!/^\d{16}$/.test(cardDigits)) {
      setCardError("Enter a 16-digit demo card number.");
      return false;
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardDetails.expiryDate)) {
      setCardError("Enter an expiry date in MM/YY format.");
      return false;
    }

    if (!/^\d{3}$/.test(cardDetails.cvv)) {
      setCardError("Enter a 3-digit demo CVV.");
      return false;
    }

    setCardError("");
    return true;
  }

  function selectPaymentMethod(method: PaymentMethod) {
    setSelectedMethod(method);
    setCardError("");

    if (method !== "card") {
      setCardDetails(EMPTY_CARD_DETAILS);
    }
  }

  function updateCardNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    const formatted = digits.match(/.{1,4}/g)?.join(" ") ?? "";
    setCardDetails((current) => ({ ...current, cardNumber: formatted }));
  }

  function updateExpiryDate(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted = digits.length > 2
      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
    setCardDetails((current) => ({ ...current, expiryDate: formatted }));
  }

  const modalTitle = context === "cancellation" ? "Cancellation Payment" : "Select Payment Method";
  const modalNote =
    context === "cancellation"
      ? `Cancellation Fine\n${amountLabel}`
      : `Demo payment amount: ${amountLabel}. No real financial transaction will occur.`;

  return createPortal(
    <div
      className="payment-modal-overlay"
      role="presentation"
      onClick={() => {
        closeModal();
      }}
    >
      <div
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        aria-describedby="payment-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="payment-modal-header">
          <div>
            <p className="payment-modal-eyebrow">
              {context === "cancellation" ? "Cancellation" : "Mock checkout"}
            </p>
            <h2 id="payment-modal-title">{modalTitle}</h2>
          </div>

          <button
            type="button"
            className="payment-modal-close"
            aria-label="Close payment method dialog"
            onClick={closeModal}
            disabled={loading}
          >
            ×
          </button>
        </header>

        <div className="payment-modal-body">
          <p id="payment-modal-description" className="payment-modal-demo-note">
            {context === "reservation" && quote
              ? "Your parking fee is calculated by the server. Outstanding cancellation fines are included in the total."
              : modalNote}
          </p>

          {context === "reservation" && (
            <section className="payment-breakdown" aria-label="Payment breakdown">
              <label className="payment-duration-select">
                Planned parking duration for checkout estimate
                <select
                  value={parkingDurationMinutes}
                  onChange={(event) =>
                    onDurationChange?.(Number(event.target.value))
                  }
                  disabled={loading || quoteLoading}
                >
                  {Array.from({ length: 12 }, (_, index) => (index + 1) * 60).map(
                    (minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes / 60} {minutes === 60 ? "hour" : "hours"}
                      </option>
                    )
                  )}
                </select>
              </label>
              <div>
                <span>New parking fee ({quote?.parking_duration_minutes ?? 60} min)</span>
                <strong>
                  {quote ? `₹${Number(quote.parking_fee).toFixed(2)}` : "—"}
                </strong>
              </div>
              {quote?.outstanding_cancellation_fines.map((fine) => (
                <div key={fine.id}>
                  <span>Outstanding cancellation fine #{fine.id}</span>
                  <strong>₹{Number(fine.amount).toFixed(2)}</strong>
                </div>
              ))}
              {quote && quote.outstanding_cancellation_fines.length === 0 && (
                <div>
                  <span>Outstanding cancellation fines</span>
                  <strong>₹0.00</strong>
                </div>
              )}
              <div className="payment-breakdown-total">
                <span>Total amount payable</span>
                <strong>{quote ? amountLabel.replace(" INR", "") : "—"}</strong>
              </div>
              {quoteLoading && <p role="status">Loading current charges...</p>}
              {quoteError && (
                <div className="payment-modal-error" role="alert">
                  <span>{quoteError}</span>
                  {onRetryQuote && (
                    <button type="button" onClick={onRetryQuote} disabled={quoteLoading}>
                      Retry
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          <form onSubmit={handleSubmit}>
            <fieldset className="payment-method-options">
              <legend>Payment method</legend>

              {PAYMENT_METHODS.map((method) => (
                <label
                  className={`payment-method-option${
                    selectedMethod === method.value ? " is-selected" : ""
                  }`}
                  key={method.value}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={method.value}
                    checked={selectedMethod === method.value}
                    onChange={() => selectPaymentMethod(method.value)}
                    disabled={loading}
                  />
                  <span className="payment-method-copy">
                    <strong>{method.label}</strong>
                    <span>{method.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {selectedMethod === "upi" && (
              <div className="payment-qr-section">
                <h3>UPI Payment</h3>
                <p className="payment-qr-amount">{amountLabel}</p>
                <div className="payment-qr-code">
                  <QRCodeSVG
                    value={demoQrPayload}
                    size={180}
                    includeMargin
                    level="M"
                  />
                </div>
                <strong className="payment-qr-label">
                  Demo QR — No real payment
                </strong>
                <p className="payment-qr-disclaimer">
                  This QR is for demonstration only. No real money will be
                  transferred.
                </p>
              </div>
            )}

            {selectedMethod === "card" && (
              <div className="payment-card-section">
                <p className="payment-card-warning">
                  Demo payment — do not enter real card details.
                </p>

                <label htmlFor="demo-cardholder-name">Cardholder Name</label>
                <input
                  id="demo-cardholder-name"
                  type="text"
                  value={cardDetails.cardholderName}
                  onChange={(event) =>
                    setCardDetails((current) => ({
                      ...current,
                      cardholderName: event.target.value,
                    }))
                  }
                  autoComplete="off"
                  disabled={loading}
                />

                <label htmlFor="demo-card-number">Card Number</label>
                <input
                  id="demo-card-number"
                  type="text"
                  inputMode="numeric"
                  value={cardDetails.cardNumber}
                  onChange={(event) => updateCardNumber(event.target.value)}
                  autoComplete="off"
                  maxLength={19}
                  disabled={loading}
                />

                <div className="payment-card-row">
                  <div>
                    <label htmlFor="demo-card-expiry">Expiry Date</label>
                    <input
                      id="demo-card-expiry"
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={cardDetails.expiryDate}
                      onChange={(event) => updateExpiryDate(event.target.value)}
                      autoComplete="off"
                      maxLength={5}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label htmlFor="demo-card-cvv">CVV</label>
                    <input
                      id="demo-card-cvv"
                      type="text"
                      inputMode="numeric"
                      value={cardDetails.cvv}
                      onChange={(event) =>
                        setCardDetails((current) => ({
                          ...current,
                          cvv: event.target.value.replace(/\D/g, "").slice(0, 3),
                        }))
                      }
                      autoComplete="off"
                      maxLength={3}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            {(error || cardError) && (
              <p className="payment-modal-error" role="alert">
                {cardError || error}
              </p>
            )}

            <div className="payment-modal-actions">
              <button
                type="button"
                className="payment-modal-secondary"
                onClick={closeModal}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="payment-modal-primary"
                disabled={
                  !selectedMethod ||
                  loading ||
                  quoteLoading ||
                  (context === "reservation" && !quote)
                }
                aria-busy={loading || quoteLoading}
              >
                {loading && <span className="button-spinner" aria-hidden="true" />}
                {loading || quoteLoading
                  ? "Processing..."
                  : selectedMethod === "cash"
                    ? `Confirm Booking — ${amountLabel} due`
                    : `Pay ${amountLabel}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PaymentMethodModal;
