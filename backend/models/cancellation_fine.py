from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String

from database import Base


class CancellationFine(Base):
    __tablename__ = "cancellation_fines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cancellation_reservation_id = Column(
        Integer,
        ForeignKey("reservations.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    payment_method = Column(String(20), nullable=True)
    settlement_reservation_id = Column(
        Integer,
        ForeignKey("reservations.id"),
        nullable=True,
        index=True,
    )
    settlement_payment_id = Column(
        Integer,
        ForeignKey("payments.id"),
        nullable=True,
    )
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    paid_at = Column(DateTime, nullable=True)
