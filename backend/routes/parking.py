from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import CANCELLATION_FINE, HOURLY_RATE, VALID_VEHICLE_TYPES
from app.core.pricing import calculate_final_charge, is_slot_compatible
from database import get_db
from models.cancellation_fine import CancellationFine
from models.parking_lot import ParkingLot
from models.parking_slot import ParkingSlot
from models.owner_verification import OwnerVerification
from models.payment import Payment
from models.reservation import Reservation
from schemas.parking import (
    ParkingLotCreate,
    ParkingLotResponse,
    ParkingSlotCreate,
    ParkingSlotResponse,
)
from schemas.reservation import ReservationCreate, ReservationResponse
from routes.owner_verification import (
    require_verified_owner,
    verification_matches_property,
)
from utils.auth import require_role

router = APIRouter(prefix="/parking", tags=["Parking Management"])


class CancelReservationRequest(BaseModel):
    payment_method: str = Field(default="cash")


def simulate_mock_payment(payment_method: str) -> tuple[str, str | None]:
    candidate = str(payment_method or "").strip().lower()
    if candidate not in {"upi", "card", "cash"}:
        return "failed", "Unsupported payment method"
    return "succeeded", None


def require_positive_id(value: int, resource_name: str) -> None:
    if value <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"{resource_name} ID must be a positive integer",
        )


def normalize_slot_status(slot: ParkingSlot) -> str:
    status_value = (slot.status or "").upper().strip() if getattr(slot, "status", None) else ""
    if status_value in {"AVAILABLE", "RESERVED", "OCCUPIED"}:
        return status_value
    return "AVAILABLE" if slot.is_available else "RESERVED"


def apply_slot_status(slot: ParkingSlot, status: str) -> None:
    normalized = status.upper().strip()
    if normalized not in {"AVAILABLE", "RESERVED", "OCCUPIED"}:
        raise ValueError("Slot status must be AVAILABLE, RESERVED, or OCCUPIED")
    slot.status = normalized
    slot.is_available = normalized == "AVAILABLE"


def normalize_datetime_to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("/lots", response_model=ParkingLotResponse)
def create_parking_lot(
    lot_data: ParkingLotCreate,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    verification = require_verified_owner(db, current_user["id"])
    if not verification_matches_property(
        verification,
        lot_data.address,
        verification.latitude,
        verification.longitude,
    ):
        raise HTTPException(
            status_code=403,
            detail="Parking lot address must match the approved property",
        )
    parking_lot = ParkingLot(
        name=lot_data.name,
        address=verification.property_address,
        latitude=verification.latitude,
        longitude=verification.longitude,
        total_slots=lot_data.total_slots,
        owner_id=current_user["id"],
    )

    db.add(parking_lot)
    db.commit()
    db.refresh(parking_lot)
    return parking_lot


@router.post("/slots", response_model=ParkingSlotResponse)
def create_parking_slot(
    slot_data: ParkingSlotCreate,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == slot_data.parking_lot_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    if parking_lot.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this parking lot")
    require_verified_owner(
        db,
        current_user["id"],
        property_address=parking_lot.address,
        latitude=parking_lot.latitude,
        longitude=parking_lot.longitude,
    )

    existing_slot = (
        db.query(ParkingSlot)
        .filter(
            ParkingSlot.parking_lot_id == slot_data.parking_lot_id,
            ParkingSlot.slot_number == slot_data.slot_number,
        )
        .first()
    )
    if existing_slot:
        raise HTTPException(status_code=400, detail="Slot already exists")

    slot_count = db.query(ParkingSlot).filter(ParkingSlot.parking_lot_id == slot_data.parking_lot_id).count()
    if slot_count >= parking_lot.total_slots:
        raise HTTPException(status_code=400, detail="Parking lot has reached its maximum slot capacity")

    if slot_data.vehicle_type not in VALID_VEHICLE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")

    parking_slot = ParkingSlot(
        slot_number=slot_data.slot_number,
        parking_lot_id=slot_data.parking_lot_id,
        vehicle_type=slot_data.vehicle_type,
    )
    apply_slot_status(parking_slot, "AVAILABLE")

    db.add(parking_slot)
    db.commit()
    db.refresh(parking_slot)
    return parking_slot


@router.get("/lots", response_model=list[ParkingLotResponse])
def get_owner_parking_lots(
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    return db.query(ParkingLot).filter(ParkingLot.owner_id == current_user["id"]).all()


@router.get("/lots/available")
def get_available_parking_lots(
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    verified_properties = (
        db.query(ParkingLot, OwnerVerification)
        .join(OwnerVerification, OwnerVerification.owner_id == ParkingLot.owner_id)
        .filter(OwnerVerification.status == "VERIFIED")
        .all()
    )
    result = []
    for lot, verification in verified_properties:
        if not verification_matches_property(
            verification,
            lot.address,
            lot.latitude,
            lot.longitude,
        ):
            continue
        available_slots = db.query(ParkingSlot).filter(
            ParkingSlot.parking_lot_id == lot.id,
            ParkingSlot.status == "AVAILABLE",
        ).count()
        result.append(
            {
                "id": lot.id,
                "name": lot.name,
                "address": lot.address,
                "latitude": lot.latitude,
                "longitude": lot.longitude,
                "total_slots": lot.total_slots,
                "available_slots": available_slots,
            }
        )
    return result


@router.get("/lots/{lot_id}/slots")
def get_parking_lot_slots(
    lot_id: int,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    require_positive_id(lot_id, "Parking lot")
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    try:
        require_verified_owner(
            db,
            parking_lot.owner_id,
            property_address=parking_lot.address,
            latitude=parking_lot.latitude,
            longitude=parking_lot.longitude,
        )
    except HTTPException:
        raise HTTPException(status_code=404, detail="Parking lot is not publicly bookable")

    slots = db.query(ParkingSlot).filter(ParkingSlot.parking_lot_id == lot_id).all()
    return {
        "parking_lot": {"id": parking_lot.id, "name": parking_lot.name, "address": parking_lot.address},
        "slots": [
            {
                "id": slot.id,
                "slot_number": slot.slot_number,
                "vehicle_type": slot.vehicle_type,
                "status": normalize_slot_status(slot),
                "is_available": slot.is_available,
            }
            for slot in slots
        ],
    }


@router.get("/lots/{lot_id}/owner-slots")
def get_owner_parking_lot_slots(
    lot_id: int,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    require_positive_id(lot_id, "Parking lot")
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    if parking_lot.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this parking lot")

    slots = db.query(ParkingSlot).filter(ParkingSlot.parking_lot_id == lot_id).all()
    return {
        "parking_lot": {"id": parking_lot.id, "name": parking_lot.name, "total_slots": parking_lot.total_slots},
        "slots": [
            {
                "id": slot.id,
                "slot_number": slot.slot_number,
                "vehicle_type": slot.vehicle_type,
                "status": normalize_slot_status(slot),
                "is_available": slot.is_available,
            }
            for slot in slots
        ],
    }


@router.get("/lots/{lot_id}/summary")
def get_parking_lot_summary(
    lot_id: int,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    require_positive_id(lot_id, "Parking lot")
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    if parking_lot.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this parking lot")

    slots = db.query(ParkingSlot).filter(ParkingSlot.parking_lot_id == lot_id).all()
    total_slots = len(slots)
    available_slots = sum(1 for slot in slots if normalize_slot_status(slot) == "AVAILABLE")
    reserved_slots = sum(1 for slot in slots if normalize_slot_status(slot) == "RESERVED")
    occupied_slots = sum(1 for slot in slots if normalize_slot_status(slot) == "OCCUPIED")
    vehicle_summary = []
    for vehicle_type in VALID_VEHICLE_TYPES:
        category_slots = [slot for slot in slots if slot.vehicle_type == vehicle_type]
        vehicle_summary.append(
            {
                "vehicle_type": vehicle_type,
                "total": len(category_slots),
                "available": sum(1 for slot in category_slots if normalize_slot_status(slot) == "AVAILABLE"),
                "reserved": sum(1 for slot in category_slots if normalize_slot_status(slot) == "RESERVED"),
                "occupied": sum(1 for slot in category_slots if normalize_slot_status(slot) == "OCCUPIED"),
            }
        )

    return {
        "parking_lot_id": parking_lot.id,
        "parking_lot_name": parking_lot.name,
        "capacity": parking_lot.total_slots,
        "created_slots": total_slots,
        "available_slots": available_slots,
        "reserved_slots": reserved_slots,
        "occupied_slots": occupied_slots,
        "vehicle_summary": vehicle_summary,
    }


@router.post("/reservations", response_model=ReservationResponse)
def create_reservation(
    reservation_data: ReservationCreate,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == reservation_data.parking_lot_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    require_verified_owner(
        db,
        parking_lot.owner_id,
        property_address=parking_lot.address,
        latitude=parking_lot.latitude,
        longitude=parking_lot.longitude,
    )

    vehicle_type = str(reservation_data.vehicle_type or "").strip()
    if vehicle_type not in VALID_VEHICLE_TYPES:
        raise HTTPException(status_code=400, detail="Vehicle type is required and must be one of 2_wheeler, 3_wheeler, 4_wheeler")

    parking_slot = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.id == reservation_data.parking_slot_id)
        .with_for_update()
        .first()
    )
    if not parking_slot:
        raise HTTPException(status_code=404, detail="Parking slot not found")
    if parking_slot.parking_lot_id != reservation_data.parking_lot_id:
        raise HTTPException(status_code=400, detail="Slot does not belong to this parking lot")
    if not is_slot_compatible(vehicle_type, parking_slot.vehicle_type):
        raise HTTPException(status_code=400, detail="Selected vehicle type is not compatible with this parking slot")
    if normalize_slot_status(parking_slot) != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Parking slot is not available")

    existing_reservation = (
        db.query(Reservation)
        .filter(
            Reservation.parking_lot_id == reservation_data.parking_lot_id,
            Reservation.parking_slot_id == reservation_data.parking_slot_id,
            Reservation.status == "active",
        )
        .first()
    )
    if existing_reservation:
        raise HTTPException(status_code=400, detail="Parking slot is already reserved")

    reservation = Reservation(
        user_id=current_user["id"],
        parking_lot_id=reservation_data.parking_lot_id,
        parking_slot_id=reservation_data.parking_slot_id,
        status="active",
        vehicle_type=vehicle_type,
        cancellation_fine=Decimal(str(CANCELLATION_FINE)),
    )

    apply_slot_status(parking_slot, "RESERVED")
    db.add(reservation)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Reservation could not be created because the slot state changed; please try again")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Reservation could not be created")

    db.refresh(reservation)
    reservation.parking_status = normalize_slot_status(parking_slot)
    return reservation


@router.get("/reservations")
def get_user_reservations(
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    reservations = db.query(Reservation).filter(Reservation.user_id == current_user["id"]).order_by(Reservation.reserved_at.desc()).all()

    result = []
    for reservation in reservations:
        parking_lot = db.query(ParkingLot).filter(ParkingLot.id == reservation.parking_lot_id).first()
        parking_slot = db.query(ParkingSlot).filter(ParkingSlot.id == reservation.parking_slot_id).first()
        parking_status = "AVAILABLE"
        if parking_slot is not None:
            parking_status = normalize_slot_status(parking_slot)

        cancellation_fine = float(reservation.cancellation_fine) if reservation.cancellation_fine else float(CANCELLATION_FINE)
        if reservation.status == "active" and parking_status != "OCCUPIED":
            cancellation_fine = float(CANCELLATION_FINE)
        fine = (
            db.query(CancellationFine)
            .filter(
                CancellationFine.cancellation_reservation_id == reservation.id
            )
            .first()
        )
        payment = (
            db.query(Payment)
            .filter(Payment.reservation_id == reservation.id)
            .first()
        )

        result.append(
            {
                "id": reservation.id,
                "parking_lot_id": reservation.parking_lot_id,
                "parking_lot_name": parking_lot.name if parking_lot else "Unknown",
                "parking_slot_id": reservation.parking_slot_id,
                "slot_number": parking_slot.slot_number if parking_slot else "Unknown",
                "vehicle_type": getattr(parking_slot, "vehicle_type", getattr(reservation, "vehicle_type", "2_wheeler")),
                "status": reservation.status,
                "parking_status": parking_status,
                "reserved_at": reservation.reserved_at.isoformat() if reservation.reserved_at else "",
                "parking_started_at": reservation.parking_started_at.isoformat() if reservation.parking_started_at else None,
                "parking_completed_at": reservation.parking_completed_at.isoformat() if reservation.parking_completed_at else None,
                "cancellation_fine": cancellation_fine,
                "cancellation_fine_status": fine.status if fine else None,
                "payment_method": payment.method if payment else None,
                "payment_status": payment.status if payment else None,
                "payment_amount": float(payment.amount) if payment else None,
                "final_amount": float(reservation.final_amount) if reservation.final_amount else None,
            }
        )
    return result


@router.patch("/reservations/{reservation_id}/start")
def start_parking(
    reservation_id: int,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    require_positive_id(reservation_id, "Reservation")
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).with_for_update().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this reservation")
    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Only active reservations can be started")

    parking_slot = db.query(ParkingSlot).filter(ParkingSlot.id == reservation.parking_slot_id).with_for_update().first()
    if not parking_slot:
        raise HTTPException(status_code=409, detail="Reservation cannot start because its parking slot no longer exists")
    if normalize_slot_status(parking_slot) != "RESERVED":
        raise HTTPException(status_code=400, detail="Reservation slot must be RESERVED before parking can start")

    if reservation.parking_started_at is None:
        reservation.parking_started_at = datetime.now(timezone.utc)
    apply_slot_status(parking_slot, "OCCUPIED")
    db.commit()
    db.refresh(reservation)
    reservation.parking_status = normalize_slot_status(parking_slot)
    return {
        "message": "Parking started successfully",
        "reservation_id": reservation.id,
        "status": reservation.status,
        "parking_status": normalize_slot_status(parking_slot),
        "parking_started_at": reservation.parking_started_at.isoformat() if reservation.parking_started_at else None,
    }


@router.patch("/reservations/{reservation_id}/cancel")
def cancel_reservation(
    reservation_id: int,
    payment_data: CancelReservationRequest | None = Body(default=None),
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    require_positive_id(reservation_id, "Reservation")
    request_data = payment_data or CancelReservationRequest()
    payment_method = str(request_data.payment_method or "cash").strip().lower()

    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).with_for_update().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this reservation")
    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Only active reservations can be cancelled")

    parking_slot = db.query(ParkingSlot).filter(ParkingSlot.id == reservation.parking_slot_id).with_for_update().first()
    if not parking_slot:
        raise HTTPException(status_code=409, detail="Reservation cannot be cancelled because its parking slot no longer exists")
    if normalize_slot_status(parking_slot) == "OCCUPIED":
        raise HTTPException(status_code=400, detail="Parking has already started. It cannot be cancelled.")

    payment = (
        db.query(Payment)
        .filter(Payment.reservation_id == reservation.id)
        .with_for_update()
        .first()
    )
    defer_fine = (
        payment_method == "cash"
        or (payment is not None and payment.method == "cash")
    )
    payment_status, failure_reason = (
        ("pending", None)
        if defer_fine
        else simulate_mock_payment(payment_method)
    )
    if payment_status != "succeeded" and not defer_fine:
        raise HTTPException(
            status_code=402,
            detail=failure_reason or "Payment failed. Your reservation is still active.",
        )

    cancellation_fine = Decimal(str(CANCELLATION_FINE))
    if payment is None:
        payment = Payment(
            reservation_id=reservation.id,
            user_id=current_user["id"],
            amount=cancellation_fine,
            currency="INR",
            method="cash" if defer_fine else payment_method,
            status="pending" if defer_fine else "succeeded",
        )
        db.add(payment)
    else:
        payment.amount = cancellation_fine
        payment.currency = "INR"
        payment.method = "cash" if defer_fine else payment_method
        payment.status = "pending" if defer_fine else "succeeded"
        payment.failure_reason = None

    fine = CancellationFine(
        user_id=current_user["id"],
        cancellation_reservation_id=reservation.id,
        amount=cancellation_fine,
        status="PENDING" if defer_fine else "PAID",
        payment_method="cash" if defer_fine else payment_method,
        settlement_payment_id=None,
        paid_at=None if defer_fine else datetime.now(timezone.utc),
    )
    db.add(fine)
    db.flush()
    if not defer_fine:
        fine.settlement_payment_id = payment.id

    payment.transaction_id = payment.transaction_id or f"mock_txn_cancel_{reservation.id}_{datetime.now(timezone.utc).timestamp()}"

    reservation.status = "cancelled"
    reservation.cancellation_fine = cancellation_fine
    apply_slot_status(parking_slot, "AVAILABLE")
    reservation.parking_status = normalize_slot_status(parking_slot)

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Reservation cancellation could not be completed")

    db.refresh(reservation)
    db.refresh(payment)
    db.refresh(fine)

    return {
        "message": "Reservation cancelled successfully",
        "reservation_id": reservation.id,
        "status": reservation.status,
        "cancellation_fine": float(reservation.cancellation_fine),
        "parking_status": normalize_slot_status(parking_slot),
        "fine_status": fine.status,
        "payment": {
            "amount": float(payment.amount),
            "currency": payment.currency,
            "method": payment.method,
            "status": payment.status,
            "transaction_id": payment.transaction_id,
        },
    }


@router.patch("/reservations/{reservation_id}/complete", response_model=ReservationResponse)
def complete_reservation(
    reservation_id: int,
    current_user: dict = Depends(require_role("user")),
    db: Session = Depends(get_db),
):
    require_positive_id(reservation_id, "Reservation")
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).with_for_update().first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this reservation")
    if reservation.status != "active":
        if reservation.status == "cancelled":
            detail = "Cancelled reservations cannot be completed"
        elif reservation.status == "completed":
            detail = "Reservation is already completed"
        else:
            detail = "Reservation cannot be completed from its current state"
        raise HTTPException(status_code=400, detail=detail)
    if reservation.parking_started_at is None:
        raise HTTPException(status_code=400, detail="Parking must be started before it can be completed")

    parking_slot = db.query(ParkingSlot).filter(ParkingSlot.id == reservation.parking_slot_id).with_for_update().first()
    if not parking_slot:
        raise HTTPException(status_code=409, detail="Reservation cannot be completed because its parking slot no longer exists")
    if normalize_slot_status(parking_slot) != "OCCUPIED":
        raise HTTPException(status_code=400, detail="Reservation slot must be OCCUPIED before parking can be completed")

    parking_started_at_utc = normalize_datetime_to_utc(reservation.parking_started_at)
    completed_at_utc = normalize_datetime_to_utc(datetime.now(timezone.utc))
    if parking_started_at_utc is None:
        raise HTTPException(status_code=400, detail="Parking must be started before it can be completed")

    duration_minutes = int((completed_at_utc - parking_started_at_utc).total_seconds() // 60)
    if duration_minutes <= 0:
        duration_minutes = 1
    final_amount = Decimal(str(calculate_final_charge(duration_minutes)))

    reservation.status = "completed"
    reservation.parking_started_at = parking_started_at_utc
    reservation.parking_completed_at = completed_at_utc
    reservation.final_amount = final_amount
    payment = db.query(Payment).filter(Payment.reservation_id == reservation.id).with_for_update().first()
    if payment is None:
        payment = Payment(
            reservation_id=reservation.id,
            user_id=current_user["id"],
            amount=final_amount,
            currency="INR",
            method="cash",
            status="pending",
        )
        db.add(payment)
    else:
        if payment.method == "cash":
            settlement_fines = (
                db.query(CancellationFine)
                .filter(
                    CancellationFine.settlement_reservation_id == reservation.id,
                    CancellationFine.status.in_(("PENDING", "PAID")),
                )
                .all()
            )
            payment.amount = final_amount + sum(
                (Decimal(str(fine.amount)) for fine in settlement_fines),
                start=Decimal("0.00"),
            )
            if payment.status != "succeeded":
                payment.status = "pending"
        else:
            paid_fines = (
                db.query(CancellationFine)
                .filter(
                    CancellationFine.settlement_reservation_id == reservation.id,
                    CancellationFine.status == "PAID",
                )
                .all()
            )
            payment.amount = final_amount + sum(
                (Decimal(str(fine.amount)) for fine in paid_fines),
                start=Decimal("0.00"),
            )
            payment.status = "succeeded"
        payment.parking_duration_minutes = duration_minutes
    payment.parking_duration_minutes = duration_minutes
    payment.currency = "INR"
    apply_slot_status(parking_slot, "AVAILABLE")
    reservation.parking_status = normalize_slot_status(parking_slot)

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Reservation completion could not be completed")

    db.refresh(reservation)
    if payment.id is not None:
        db.refresh(payment)
    return reservation


@router.patch("/owner/reservations/{reservation_id}/confirm-cash-payment")
def confirm_owner_cash_payment(
    reservation_id: int,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    require_positive_id(reservation_id, "Reservation")
    reservation = (
        db.query(Reservation)
        .filter(Reservation.id == reservation_id)
        .with_for_update()
        .first()
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")

    parking_lot = db.query(ParkingLot).filter(
        ParkingLot.id == reservation.parking_lot_id
    ).first()
    if parking_lot is None or parking_lot.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this parking reservation")

    payment = (
        db.query(Payment)
        .filter(Payment.reservation_id == reservation.id)
        .with_for_update()
        .first()
    )
    if payment is None or payment.method != "cash":
        raise HTTPException(
            status_code=400,
            detail="This reservation does not have a cash payment awaiting confirmation",
        )
    if payment.status == "succeeded":
        raise HTTPException(status_code=409, detail="Cash payment has already been confirmed")

    pending_fines = (
        db.query(CancellationFine)
        .filter(
            CancellationFine.user_id == reservation.user_id,
            CancellationFine.status == "PENDING",
            (
                (CancellationFine.settlement_reservation_id == reservation.id)
                | (CancellationFine.cancellation_reservation_id == reservation.id)
            ),
        )
        .with_for_update()
        .all()
    )
    if Decimal(str(payment.amount)) <= 0 and not pending_fines:
        raise HTTPException(status_code=409, detail="No cash amount remains due for this reservation")
    now = datetime.now(timezone.utc)
    for fine in pending_fines:
        fine.status = "PAID"
        fine.paid_at = now
        fine.settlement_payment_id = payment.id

    payment.status = "succeeded"
    payment.failure_reason = None
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Cash receipt could not be recorded")

    return {
        "message": "Cash receipt confirmed",
        "reservation_id": reservation.id,
        "payment_status": payment.status,
        "settled_cancellation_fines": len(pending_fines),
        "settled_fine_amount": float(
            sum(
                (Decimal(str(fine.amount)) for fine in pending_fines),
                start=Decimal("0.00"),
            )
        ),
    }


@router.get("/owner/reservations")
def get_owner_reservations(
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    reservations = (
        db.query(Reservation)
        .join(ParkingLot, Reservation.parking_lot_id == ParkingLot.id)
        .filter(ParkingLot.owner_id == current_user["id"])
        .order_by(Reservation.reserved_at.desc())
        .all()
    )

    result = []
    for reservation in reservations:
        parking_lot = db.query(ParkingLot).filter(ParkingLot.id == reservation.parking_lot_id).first()
        parking_slot = db.query(ParkingSlot).filter(ParkingSlot.id == reservation.parking_slot_id).first()
        payment = (
            db.query(Payment)
            .filter(Payment.reservation_id == reservation.id)
            .first()
        )
        pending_fines = (
            db.query(CancellationFine)
            .filter(
                CancellationFine.user_id == reservation.user_id,
                CancellationFine.status == "PENDING",
                (
                    (CancellationFine.settlement_reservation_id == reservation.id)
                    | (CancellationFine.cancellation_reservation_id == reservation.id)
                ),
            )
            .all()
        )
        result.append(
            {
                "id": reservation.id,
                "parking_lot_id": reservation.parking_lot_id,
                "parking_lot_name": parking_lot.name if parking_lot else "Unknown",
                "parking_slot_id": reservation.parking_slot_id,
                "slot_number": parking_slot.slot_number if parking_slot else "Unknown",
                "vehicle_type": getattr(parking_slot, "vehicle_type", "2_wheeler"),
                "user_id": reservation.user_id,
                "status": reservation.status,
                "reserved_at": reservation.reserved_at.isoformat() if reservation.reserved_at else "",
                "parking_status": normalize_slot_status(parking_slot) if parking_slot else "AVAILABLE",
                "payment_method": payment.method if payment else None,
                "payment_status": payment.status if payment else None,
                "payment_amount": float(payment.amount) if payment else None,
                "pending_cancellation_fines": [
                    {
                        "id": fine.id,
                        "amount": float(fine.amount),
                    }
                    for fine in pending_fines
                ],
            }
        )
    return result
