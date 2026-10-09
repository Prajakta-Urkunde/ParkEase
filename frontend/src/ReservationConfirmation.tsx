type ReservationConfirmationProps = {
  reservationId: number;
  parkingLotName: string;
  parkingLotAddress: string;
  slotNumber: string;
  status: string;
  reservedAt: string;
  paymentStatus?: string;
  paymentAmount?: string;
  paymentCurrency?: string;
  paymentMethod?: string;
  transactionId?: string;
  onBookAnother: () => void;
};

function ReservationConfirmation({
  reservationId,
  parkingLotName,
  parkingLotAddress,
  slotNumber,
  status,
  reservedAt,
  paymentStatus,
  paymentAmount,
  paymentCurrency,
  paymentMethod,
  transactionId,
  onBookAnother,
}: ReservationConfirmationProps) {
  const parsedDate = new Date(reservedAt);
  const formattedDate = Number.isNaN(parsedDate.getTime())
    ? "Not available"
    : parsedDate.toLocaleString();
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <section className="reservation-confirmation">
      <div className="confirmation-icon">✓</div>

      <h2>Reservation Confirmed!</h2>

      <p className="confirmation-message">
        Your parking slot has been successfully reserved.
      </p>

      <div className="reservation-details">
        <div className="detail-row">
          <span>Reservation ID</span>
          <strong>#{reservationId}</strong>
        </div>

        <div className="detail-row">
          <span>Parking Lot</span>
          <strong>{parkingLotName}</strong>
        </div>

        <div className="detail-row">
          <span>Address</span>
          <strong>{parkingLotAddress}</strong>
        </div>

        <div className="detail-row">
          <span>Parking Slot</span>
          <strong>{slotNumber}</strong>
        </div>

        <div className="detail-row">
          <span>Reserved At</span>
          <strong>{formattedDate}</strong>
        </div>

        <div className="detail-row">
          <span>Status</span>
          <strong className="reservation-status">{formattedStatus}</strong>
        </div>

        {paymentStatus && (
          <div className="detail-row">
            <span>Payment Status</span>
            <strong className="reservation-status">
              {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
            </strong>
          </div>
        )}

        {paymentAmount && paymentCurrency && (
          <div className="detail-row">
            <span>Amount</span>
            <strong>
              ₹{paymentAmount} {paymentCurrency}
            </strong>
          </div>
        )}

        {paymentMethod && (
          <div className="detail-row">
            <span>Payment Method</span>
            <strong>{paymentMethod.toUpperCase()}</strong>
          </div>
        )}

        {transactionId && (
          <div className="detail-row">
            <span>Transaction ID</span>
            <strong className="confirmation-transaction-id">
              {transactionId}
            </strong>
          </div>
        )}
      </div>

      <button
        type="button"
        className="book-another-button"
        onClick={onBookAnother}
      >
        Reserve Another Slot
      </button>
    </section>
  );
}

export default ReservationConfirmation;
