from pydantic import ValidationError
import pytest

from schemas.reservation import ReservationResponse


def test_reservation_response_exposes_parking_status_and_vehicle_type():
    reservation = ReservationResponse(
        id=10,
        user_id=2,
        parking_lot_id=3,
        parking_slot_id=4,
        vehicle_type="2_wheeler",
        status="active",
        parking_status="RESERVED",
    )

    assert reservation.vehicle_type == "2_wheeler"
    assert reservation.parking_status == "RESERVED"


def test_reservation_response_rejects_invalid_vehicle_type():
    with pytest.raises(ValidationError):
        ReservationResponse(
            id=10,
            user_id=2,
            parking_lot_id=3,
            parking_slot_id=4,
            vehicle_type="bike",
            status="active",
        )
