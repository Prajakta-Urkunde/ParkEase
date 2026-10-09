from math import ceil

from app.core.config import HOURLY_RATE


def calculate_final_charge(minutes: int | float) -> int:
    if minutes <= 0:
        return 0
    billed_hours = ceil(minutes / 60)
    return billed_hours * HOURLY_RATE


def is_slot_compatible(vehicle_type: str, slot_vehicle_type: str) -> bool:
    return vehicle_type == slot_vehicle_type
