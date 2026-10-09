from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String

from database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    parking_lot_id = Column(
        Integer,
        ForeignKey("parking_lots.id"),
        nullable=False,
    )
    parking_slot_id = Column(
        Integer,
        ForeignKey("parking_slots.id"),
        nullable=False,
    )
    status = Column(
        String(20),
        nullable=False,
        default="active",
    )
    vehicle_type = Column(
        String(20),
        nullable=False,
        default="2_wheeler",
    )
    reserved_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    parking_started_at = Column(DateTime, nullable=True)
    parking_completed_at = Column(DateTime, nullable=True)
    cancellation_fine = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
    )
    final_amount = Column(
        Numeric(10, 2),
        nullable=True,
    )
