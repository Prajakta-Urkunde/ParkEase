from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.cancellation_fine import CancellationFine
from models.owner_verification import OwnerVerification
from models.parking_lot import ParkingLot
from models.parking_slot import ParkingSlot
from models.payment import Payment
from models.reservation import Reservation
from models.user import User
from routes.parking import (
    CancelReservationRequest,
    cancel_reservation,
    complete_reservation,
    confirm_owner_cash_payment,
)
from routes.payments import checkout_reservation, get_checkout_quote
from schemas.payment import CheckoutRequest


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'cancellation-fines.db'}")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    session.add_all(
        [
            User(name="Parking Owner", email="owner@test.local", password="hash", role="owner"),
            User(name="Parking User", email="user@test.local", password="hash", role="user"),
            User(name="Other Owner", email="other@test.local", password="hash", role="owner"),
        ]
    )
    session.commit()
    verification = OwnerVerification(
        owner_id=1,
        property_name="Test Lot",
        property_address="10 Test Road",
        latitude=18.5,
        longitude=73.8,
        property_relationship="OWNER",
        status="VERIFIED",
    )
    session.add(verification)
    lot = ParkingLot(
        name="Test Lot",
        address="10 Test Road",
        latitude=18.5,
        longitude=73.8,
        total_slots=4,
        owner_id=1,
    )
    session.add(lot)
    session.flush()
    session.add_all(
        [
            ParkingSlot(
                slot_number=f"A{index}",
                parking_lot_id=lot.id,
                vehicle_type="2_wheeler",
                status="AVAILABLE",
                is_available=True,
            )
            for index in range(1, 5)
        ]
    )
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def checkout(db, slot_id: int, method: str, duration_minutes: int = 60):
    return checkout_reservation(
        CheckoutRequest(
            parking_lot_id=1,
            parking_slot_id=slot_id,
            payment_method=method,
            vehicle_type="2_wheeler",
            parking_duration_minutes=duration_minutes,
        ),
        current_user={"id": 2, "role": "user"},
        db=db,
    )


def cancel_cash_reservation(db, slot_id: int):
    booking = checkout(db, slot_id, "cash")
    cancellation = cancel_reservation(
        booking.reservation.id,
        payment_data=CancelReservationRequest(payment_method="cash"),
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    return booking.reservation.id, cancellation


def test_cash_cancellation_releases_slot_and_records_pending_fine(db):
    reservation_id, result = cancel_cash_reservation(db, 1)

    fine = db.query(CancellationFine).one()
    reservation = db.query(Reservation).filter_by(id=reservation_id).one()
    payment = db.query(Payment).filter_by(reservation_id=reservation_id).one()
    slot = db.query(ParkingSlot).filter_by(id=1).one()

    assert result["fine_status"] == "PENDING"
    assert reservation.status == "cancelled"
    assert slot.status == "AVAILABLE" and slot.is_available is True
    assert fine.amount == Decimal("20.00")
    assert fine.status == "PENDING"
    assert payment.amount == Decimal("20.00")
    assert payment.status == "pending"


def test_online_checkout_collects_multiple_fines_once_and_returns_breakdown(db):
    first_cancelled_id, _ = cancel_cash_reservation(db, 1)
    second_cancelled_id, _ = cancel_cash_reservation(db, 2)

    quote = get_checkout_quote(
        parking_duration_minutes=120,
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    assert quote.parking_fee == Decimal("100")
    assert len(quote.outstanding_cancellation_fines) == 2
    assert quote.total_amount == Decimal("140.00")

    result = checkout(db, 3, "upi", duration_minutes=120)
    fines = db.query(CancellationFine).order_by(CancellationFine.id).all()
    assert result.payment.amount == Decimal("140.00")
    assert result.payment.status == "succeeded"
    assert result.parking_fee == Decimal("100")
    assert result.total_amount == Decimal("140.00")
    assert [fine.status for fine in fines] == ["PAID", "PAID"]
    assert all(fine.settlement_reservation_id == result.reservation.id for fine in fines)
    assert (
        db.query(Payment)
        .filter_by(reservation_id=first_cancelled_id)
        .one()
        .amount
        == Decimal("0.00")
    )
    assert (
        db.query(Payment)
        .filter_by(reservation_id=second_cancelled_id)
        .one()
        .amount
        == Decimal("0.00")
    )

    next_result = checkout(db, 4, "upi")
    assert next_result.total_amount == Decimal("50.00")
    assert len(next_result.outstanding_cancellation_fines) == 0


def test_cash_checkout_keeps_fines_pending_until_owner_confirms_receipt(db):
    cancel_cash_reservation(db, 1)
    result = checkout(db, 2, "cash")
    fine = db.query(CancellationFine).one()

    assert result.payment.amount == Decimal("70.00")
    assert result.payment.status == "pending"
    assert result.total_amount == Decimal("70.00")
    assert fine.status == "PENDING"
    assert fine.settlement_reservation_id == result.reservation.id

    with pytest.raises(HTTPException) as unauthorized:
        confirm_owner_cash_payment(
            result.reservation.id,
            current_user={"id": 3, "role": "owner"},
            db=db,
        )
    assert unauthorized.value.status_code == 403

    receipt = confirm_owner_cash_payment(
        result.reservation.id,
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    assert receipt["settled_cancellation_fines"] == 1
    assert fine.status == "PAID"
    assert (
        db.query(Payment)
        .filter_by(reservation_id=result.reservation.id)
        .one()
        .status
        == "succeeded"
    )
    with pytest.raises(HTTPException) as repeated:
        confirm_owner_cash_payment(
            result.reservation.id,
            current_user={"id": 1, "role": "owner"},
            db=db,
        )
    assert repeated.value.status_code == 409


def test_repeated_cash_checkout_transfers_fine_balance_without_double_due(db):
    cancel_cash_reservation(db, 1)
    first_booking = checkout(db, 2, "cash")
    second_booking = checkout(db, 3, "cash")
    fine = db.query(CancellationFine).one()
    first_payment = (
        db.query(Payment)
        .filter_by(reservation_id=first_booking.reservation.id)
        .one()
    )
    second_payment = (
        db.query(Payment)
        .filter_by(reservation_id=second_booking.reservation.id)
        .one()
    )

    assert first_booking.total_amount == Decimal("70.00")
    assert second_booking.total_amount == Decimal("70.00")
    assert first_payment.amount == Decimal("50.00")
    assert second_payment.amount == Decimal("70.00")
    assert fine.settlement_reservation_id == second_booking.reservation.id

    confirm_owner_cash_payment(
        first_booking.reservation.id,
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    assert fine.status == "PENDING"
    confirm_owner_cash_payment(
        second_booking.reservation.id,
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    assert fine.status == "PAID"


def test_checkout_payment_failure_preserves_outstanding_fines(db, monkeypatch):
    cancel_cash_reservation(db, 1)

    import routes.payments as payment_routes

    monkeypatch.setattr(
        payment_routes,
        "simulate_mock_payment",
        lambda method: ("failed", "Mock payment declined"),
    )
    with pytest.raises(HTTPException) as failure:
        checkout(db, 2, "card")
    assert failure.value.status_code == 402
    assert db.query(CancellationFine).one().status == "PENDING"
    assert db.query(Reservation).filter_by(parking_slot_id=2).count() == 0
    assert db.query(Payment).count() == 1


def test_cash_owner_receipt_can_settle_fine_on_cancelled_cash_booking(db):
    reservation_id, _ = cancel_cash_reservation(db, 1)
    fine = db.query(CancellationFine).one()
    assert fine.status == "PENDING"

    confirm_owner_cash_payment(
        reservation_id,
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    assert fine.status == "PAID"
    assert fine.paid_at is not None
    assert db.query(Payment).filter_by(reservation_id=reservation_id).one().status == "succeeded"


def test_two_hour_completion_keeps_parking_and_fine_amounts_separate(db):
    cancel_cash_reservation(db, 1)
    result = checkout(db, 2, "upi", duration_minutes=120)
    reservation = (
        db.query(Reservation).filter_by(id=result.reservation.id).one()
    )
    slot = db.query(ParkingSlot).filter_by(id=2).one()
    reservation.parking_started_at = datetime.now(timezone.utc) - timedelta(
        minutes=120
    )
    slot.status = "OCCUPIED"
    slot.is_available = False
    db.commit()

    completed = complete_reservation(
        reservation.id,
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    payment = db.query(Payment).filter_by(reservation_id=reservation.id).one()

    assert completed.final_amount == Decimal("100.00")
    assert payment.amount == Decimal("120.00")
    assert payment.status == "succeeded"
    assert db.query(CancellationFine).one().status == "PAID"
