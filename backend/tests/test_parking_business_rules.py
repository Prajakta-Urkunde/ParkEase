from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import CANCELLATION_FINE, HOURLY_RATE, VALID_VEHICLE_TYPES
from app.core.pricing import calculate_final_charge, is_slot_compatible
from database import Base


def test_vehicle_types_are_supported():
    assert VALID_VEHICLE_TYPES == ("2_wheeler", "3_wheeler", "4_wheeler")
    assert is_slot_compatible("2_wheeler", "2_wheeler") is True
    assert is_slot_compatible("2_wheeler", "4_wheeler") is False
    assert is_slot_compatible("4_wheeler", "2_wheeler") is False
    assert is_slot_compatible("4_wheeler", "4_wheeler") is True


def test_final_parking_charge_uses_hourly_pricing_and_ceiling():
    assert calculate_final_charge(minutes=30) == HOURLY_RATE
    assert calculate_final_charge(minutes=70) == HOURLY_RATE * 2
    assert calculate_final_charge(minutes=185) == HOURLY_RATE * 4
    assert calculate_final_charge(minutes=0) == 0


def test_cancellation_fine_is_configurable():
    assert CANCELLATION_FINE == 20


def test_normalize_datetime_to_utc_handles_naive_values():
    from datetime import datetime, timezone

    from routes.parking import normalize_datetime_to_utc

    naive = datetime(2024, 1, 1, 10, 0, 0)
    aware = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

    assert normalize_datetime_to_utc(naive).tzinfo == timezone.utc
    assert normalize_datetime_to_utc(aware).tzinfo == timezone.utc


def test_complete_reservation_normalizes_naive_start_time_before_duration_calculation():
    from models.parking_slot import ParkingSlot
    from models.reservation import Reservation
    from routes.parking import complete_reservation, normalize_datetime_to_utc

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        slot = ParkingSlot(
            slot_number="A1",
            parking_lot_id=1,
            vehicle_type="2_wheeler",
            status="OCCUPIED",
            is_available=False,
        )
        reservation = Reservation(
            user_id=1,
            parking_lot_id=1,
            parking_slot_id=1,
            status="active",
            vehicle_type="2_wheeler",
            parking_started_at=datetime(2024, 1, 1, 9, 0, 0),
        )
        db.add(slot)
        db.add(reservation)
        db.commit()
        db.refresh(slot)
        db.refresh(reservation)

        with patch("routes.parking.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
            completed = complete_reservation(reservation.id, current_user={"id": 1}, db=db)

        started_utc = normalize_datetime_to_utc(datetime(2024, 1, 1, 9, 0, 0))
        completed_utc = normalize_datetime_to_utc(datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc))

        assert started_utc.tzinfo == timezone.utc
        assert completed_utc.tzinfo == timezone.utc
        assert (completed_utc - started_utc) == timedelta(minutes=60)
        assert completed.status == "completed"
        assert completed.final_amount == Decimal("50")
        assert completed.parking_started_at is not None
        assert completed.parking_completed_at is not None
        assert slot.status == "AVAILABLE"
        assert slot.is_available is True
