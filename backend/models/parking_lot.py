from sqlalchemy import Column, Integer, String, Float, ForeignKey
from database import Base


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )
    total_slots = Column(
        Integer,
        nullable=False,
        default=0
    )
