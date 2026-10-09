from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String

from database import Base


MOCK_PAYMENT_AMOUNT = Decimal("50.00")
MOCK_PAYMENT_CURRENCY = "INR"


def generate_transaction_id() -> str:
    return f"mock_txn_{uuid4().hex}"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(
        Integer,
        ForeignKey("reservations.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=MOCK_PAYMENT_AMOUNT,
    )
    currency = Column(
        String(3),
        nullable=False,
        default=MOCK_PAYMENT_CURRENCY,
    )
    method = Column(String(20), nullable=False)
    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )
    transaction_id = Column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        default=generate_transaction_id,
    )
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    parking_duration_minutes = Column(Integer, nullable=True)
    failure_reason = Column(String(255), nullable=True)
