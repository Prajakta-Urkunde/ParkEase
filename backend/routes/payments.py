from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import VALID_VEHICLE_TYPES
from app.core.pricing import calculate_final_charge
from app.core.pricing import is_slot_compatible
from database import get_db
from models.cancellation_fine import CancellationFine
from models.payment import (
    MOCK_PAYMENT_CURRENCY,
    Payment,
)
from models.parking_lot import ParkingLot
from models.parking_slot import ParkingSlot
from models.reservation import Reservation
from routes.owner_verification import require_verified_owner
from schemas.payment import (
    CancellationFineResponse,
    CheckoutQuoteResponse,
    CheckoutRequest,
    CheckoutResponse,
    PaymentStatus,
)
from schemas.reservation import ReservationResponse
from utils.auth import require_role

router = APIRouter(
    prefix="/parking",
    tags=["Payment Checkout"],
)


def get_pending_fines(db: Session, user_id: int, *, lock: bool = False):
    query = (
        db.query(CancellationFine)
        .filter(
            CancellationFine.user_id == user_id,
            CancellationFine.status == "PENDING",
        )
        .order_by(CancellationFine.id)
    )
    if lock:
        query = query.with_for_update()
    return query.all()


def build_checkout_quote(
    db: Session, user_id: int, parking_duration_minutes: int, *, lock_fines: bool = False
):
    parking_fee = Decimal(
        str(calculate_final_charge(parking_duration_minutes))
    )
    outstanding_fines = get_pending_fines(db, user_id, lock=lock_fines)
    total_amount = parking_fee + sum(
        (Decimal(str(fine.amount)) for fine in outstanding_fines),
        start=Decimal("0.00"),
    )
    return parking_fee, outstanding_fines, total_amount


@router.get("/reservations/cancellation-fines", response_model=list[CancellationFineResponse])
def get_cancellation_fines(
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    return (
        db.query(CancellationFine)
        .filter(CancellationFine.user_id == current_user["id"])
        .order_by(CancellationFine.created_at.desc())
        .all()
    )


@router.get("/reservations/checkout-quote", response_model=CheckoutQuoteResponse)
def get_checkout_quote(
    parking_duration_minutes: int = 60,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    if parking_duration_minutes <= 0 or parking_duration_minutes > 10080:
        raise HTTPException(
            status_code=422,
            detail="parking_duration_minutes must be between 1 and 10080",
        )
    parking_fee, fines, total_amount = build_checkout_quote(
        db, current_user["id"], parking_duration_minutes
    )
    return CheckoutQuoteResponse(
        parking_fee=parking_fee,
        parking_duration_minutes=parking_duration_minutes,
        outstanding_cancellation_fines=[
            CancellationFineResponse.model_validate(fine) for fine in fines
        ],
        total_amount=total_amount,
    )


def simulate_mock_payment(
    payment_method: str,
) -> tuple[PaymentStatus, Optional[str]]:
    """Return a deterministic success result for the mock payment flow.

    Tests can monkeypatch this helper to return ("failed", reason) without
    creating any payment or reservation records.
    """
    return "succeeded", None


@router.post(
    "/reservations/checkout",
    response_model=CheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
def checkout_reservation(
    checkout_data: CheckoutRequest,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    parking_lot = db.query(ParkingLot).filter(
        ParkingLot.id == checkout_data.parking_lot_id
    ).first()

    if not parking_lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking lot not found",
        )
    require_verified_owner(
        db,
        parking_lot.owner_id,
        property_address=parking_lot.address,
        latitude=parking_lot.latitude,
        longitude=parking_lot.longitude,
    )

    parking_slot = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.id == checkout_data.parking_slot_id)
        .with_for_update()
        .first()
    )

    if not parking_slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking slot not found",
        )

    if parking_slot.parking_lot_id != checkout_data.parking_lot_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slot does not belong to this parking lot",
        )

    vehicle_type = str(checkout_data.vehicle_type or "").strip()
    if vehicle_type not in VALID_VEHICLE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle type is required and must be one of 2_wheeler, 3_wheeler, 4_wheeler",
        )
    if not is_slot_compatible(vehicle_type, parking_slot.vehicle_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected vehicle type is not compatible with this parking slot",
        )
    if parking_slot.status not in ("AVAILABLE", "available") or not parking_slot.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking slot is already occupied",
        )

    existing_reservation = db.query(Reservation).filter(
        Reservation.parking_lot_id == checkout_data.parking_lot_id,
        Reservation.parking_slot_id == checkout_data.parking_slot_id,
        Reservation.status == "active",
    ).first()

    if existing_reservation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking slot is already reserved",
        )

    parking_fee, outstanding_fines, total_amount = build_checkout_quote(
        db,
        current_user["id"],
        checkout_data.parking_duration_minutes,
        lock_fines=True,
    )

    payment_status, failure_reason = simulate_mock_payment(
        checkout_data.payment_method
    )

    if payment_status != "succeeded":
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=failure_reason or "Mock payment failed",
        )

    reservation = Reservation(
        user_id=current_user["id"],
        parking_lot_id=checkout_data.parking_lot_id,
        parking_slot_id=checkout_data.parking_slot_id,
        status="active",
        vehicle_type=vehicle_type,
    )
    parking_slot.status = "RESERVED"
    parking_slot.is_available = False

    db.add(reservation)
    db.flush()

    payment = Payment(
        reservation_id=reservation.id,
        user_id=current_user["id"],
        amount=total_amount,
        currency=MOCK_PAYMENT_CURRENCY,
        method=checkout_data.payment_method,
        status="pending" if checkout_data.payment_method == "cash" else "succeeded",
        parking_duration_minutes=checkout_data.parking_duration_minutes,
    )
    db.add(payment)
    db.flush()

    settled_at = datetime.now(timezone.utc)
    for fine in outstanding_fines:
        previous_reservation_id = (
            fine.settlement_reservation_id or fine.cancellation_reservation_id
        )
        if previous_reservation_id is not None:
            previous_payment = (
                db.query(Payment)
                .filter(Payment.reservation_id == previous_reservation_id)
                .with_for_update()
                .first()
            )
            if (
                previous_payment is not None
                and previous_payment.method == "cash"
                and previous_payment.status == "pending"
            ):
                previous_payment.amount = max(
                    Decimal("0.00"),
                    Decimal(str(previous_payment.amount))
                    - Decimal(str(fine.amount)),
                )
        fine.settlement_reservation_id = reservation.id
        fine.payment_method = checkout_data.payment_method
        if checkout_data.payment_method != "cash":
            fine.status = "PAID"
            fine.settlement_payment_id = payment.id
            fine.paid_at = settled_at

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Checkout could not be completed because the slot state changed; please try again",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Checkout could not be completed",
        )

    db.refresh(reservation)
    db.refresh(payment)

    return CheckoutResponse(
        reservation=ReservationResponse.model_validate(reservation),
        payment=payment,
        parking_fee=parking_fee,
        outstanding_cancellation_fines=[
            CancellationFineResponse.model_validate(fine)
            for fine in outstanding_fines
        ],
        total_amount=total_amount,
    )
