from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.config import VALID_VEHICLE_TYPES
from schemas.reservation import ReservationResponse


PaymentMethod = Literal["upi", "card", "cash"]
PaymentStatus = Literal["pending", "succeeded", "failed", "refunded"]


class PaymentCreate(BaseModel):
    method: PaymentMethod = Field(
        description="Mock payment method; no sensitive payment credentials are accepted"
    )


class CheckoutRequest(BaseModel):
    parking_lot_id: int = Field(gt=0)
    parking_slot_id: int = Field(gt=0)
    payment_method: PaymentMethod
    vehicle_type: str = Field(default="2_wheeler")
    parking_duration_minutes: int = Field(default=60, gt=0, le=10080)

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if isinstance(obj, dict):
            vehicle_type = obj.get("vehicle_type")
            if vehicle_type is not None and str(vehicle_type).strip() not in VALID_VEHICLE_TYPES:
                raise ValueError("vehicle_type must be one of: 2_wheeler, 3_wheeler, 4_wheeler")
        return super().model_validate(obj, *args, **kwargs)


class PaymentResponse(BaseModel):
    id: int
    reservation_id: int
    user_id: int
    amount: Decimal
    currency: str
    method: PaymentMethod
    status: PaymentStatus
    transaction_id: str
    created_at: datetime
    parking_duration_minutes: Optional[int] = None
    failure_reason: Optional[str] = None

    class Config:
        from_attributes = True


class CancellationFineResponse(BaseModel):
    id: int
    cancellation_reservation_id: int
    amount: Decimal
    status: Literal["PENDING", "PAID"]
    payment_method: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckoutQuoteResponse(BaseModel):
    parking_fee: Decimal
    parking_duration_minutes: int
    outstanding_cancellation_fines: list[CancellationFineResponse]
    total_amount: Decimal


class CheckoutResponse(BaseModel):
    reservation: ReservationResponse
    payment: PaymentResponse
    parking_fee: Decimal
    outstanding_cancellation_fines: list[CancellationFineResponse]
    total_amount: Decimal
