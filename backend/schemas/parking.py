import math
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.core.config import VALID_VEHICLE_TYPES


class ParkingLotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=1, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    total_slots: int = Field(default=0, ge=1)

    @field_validator("name", "address", mode="before")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_coordinate(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not math.isfinite(value):
            raise ValueError("must be a finite number")
        return value


class ParkingLotResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: Optional[float]
    longitude: Optional[float]
    owner_id: int
    total_slots: int

    class Config:
        from_attributes = True


class ParkingSlotCreate(BaseModel):
    slot_number: str = Field(min_length=1, max_length=20)
    parking_lot_id: int = Field(gt=0)
    vehicle_type: str = Field(default="2_wheeler")

    @field_validator("slot_number", mode="before")
    @classmethod
    def validate_slot_number(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("must be text")

        normalized_value = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _-]{0,19}", normalized_value):
            raise ValueError(
                "must be 1-20 characters using letters, numbers, spaces, hyphens, or underscores"
            )

        return normalized_value

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: str) -> str:
        normalized = str(value).strip()
        if normalized not in VALID_VEHICLE_TYPES:
            raise ValueError(
                "vehicle_type must be one of: 2_wheeler, 3_wheeler, 4_wheeler"
            )
        return normalized


class ParkingSlotResponse(BaseModel):
    id: int
    slot_number: str
    parking_lot_id: int
    vehicle_type: str
    status: str
    is_available: bool

    class Config:
        from_attributes = True
