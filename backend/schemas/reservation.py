from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import VALID_VEHICLE_TYPES


class ReservationCreate(BaseModel):
    parking_lot_id: int = Field(gt=0)
    parking_slot_id: int = Field(gt=0)
    vehicle_type: str = Field(default="2_wheeler")

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: str) -> str:
        normalized = str(value).strip()
        if normalized not in VALID_VEHICLE_TYPES:
            raise ValueError("vehicle_type must be one of: 2_wheeler, 3_wheeler, 4_wheeler")
        return normalized


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    parking_lot_id: int
    parking_slot_id: int
    vehicle_type: str = "2_wheeler"
    status: str
    parking_status: str = "AVAILABLE"
    reserved_at: Optional[datetime] = None
    parking_started_at: Optional[datetime] = None
    parking_completed_at: Optional[datetime] = None
    cancellation_fine: Optional[float] = None
    final_amount: Optional[float] = None

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: str) -> str:
        normalized = str(value).strip()
        if normalized not in VALID_VEHICLE_TYPES:
            raise ValueError("vehicle_type must be one of: 2_wheeler, 3_wheeler, 4_wheeler")
        return normalized
