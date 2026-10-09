from sqlalchemy import Boolean, Column, ForeignKey, Integer, String

from database import Base


class ParkingSlot(Base):
    __tablename__ = "parking_slots"

    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(String(20), nullable=False)
    parking_lot_id = Column(
        Integer,
        ForeignKey("parking_lots.id"),
        nullable=False,
    )
    vehicle_type = Column(
        String(20),
        nullable=False,
        default="2_wheeler",
    )
    status = Column(
        String(20),
        nullable=False,
        default="AVAILABLE",
    )
    is_available = Column(
        Boolean,
        nullable=False,
        default=True,
    )
