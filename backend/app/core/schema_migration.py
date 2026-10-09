from sqlalchemy import text

from database import engine


def ensure_parking_schema() -> None:
    with engine.begin() as connection:
        slot_columns = connection.execute(
            text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'parking_slots'"
            )
        ).fetchall()
        slot_names = {row[0] for row in slot_columns}

        if "vehicle_type" not in slot_names:
            connection.execute(
                text(
                    "ALTER TABLE parking_slots ADD COLUMN vehicle_type VARCHAR(20) DEFAULT '2_wheeler'"
                )
            )

        if "status" not in slot_names:
            connection.execute(
                text(
                    "ALTER TABLE parking_slots ADD COLUMN status VARCHAR(20) DEFAULT 'AVAILABLE'"
                )
            )

        connection.execute(
            text(
                "UPDATE parking_slots SET vehicle_type = '2_wheeler' WHERE vehicle_type IS NULL OR vehicle_type = ''"
            )
        )

        connection.execute(
            text(
                "UPDATE parking_slots SET status = CASE WHEN is_available = true THEN 'AVAILABLE' ELSE 'RESERVED' END WHERE status IS NULL OR status = ''"
            )
        )

        connection.execute(
            text(
                "UPDATE parking_slots SET is_available = CASE WHEN status = 'AVAILABLE' THEN TRUE ELSE FALSE END WHERE is_available IS NULL"
            )
        )

        reservation_columns = connection.execute(
            text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations'"
            )
        ).fetchall()
        reservation_names = {row[0] for row in reservation_columns}

        if "vehicle_type" not in reservation_names:
            connection.execute(
                text(
                    "ALTER TABLE reservations ADD COLUMN vehicle_type VARCHAR(20) DEFAULT '2_wheeler'"
                )
            )

        if "parking_started_at" not in reservation_names:
            connection.execute(
                text(
                    "ALTER TABLE reservations ADD COLUMN parking_started_at TIMESTAMP NULL"
                )
            )

        if "parking_completed_at" not in reservation_names:
            connection.execute(
                text(
                    "ALTER TABLE reservations ADD COLUMN parking_completed_at TIMESTAMP NULL"
                )
            )

        if "cancellation_fine" not in reservation_names:
            connection.execute(
                text(
                    "ALTER TABLE reservations ADD COLUMN cancellation_fine NUMERIC(10,2) DEFAULT 0"
                )
            )

        if "final_amount" not in reservation_names:
            connection.execute(
                text(
                    "ALTER TABLE reservations ADD COLUMN final_amount NUMERIC(10,2) NULL"
                )
            )

        connection.execute(
            text(
                "UPDATE reservations SET vehicle_type = '2_wheeler' WHERE vehicle_type IS NULL OR vehicle_type = ''"
            )
        )

        connection.execute(
            text(
                "UPDATE reservations SET parking_started_at = reserved_at WHERE status = 'active' AND parking_started_at IS NULL AND reserved_at IS NOT NULL"
            )
        )

        payment_columns = connection.execute(
            text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'"
            )
        ).fetchall()
        payment_names = {row[0] for row in payment_columns}

        if "parking_duration_minutes" not in payment_names:
            connection.execute(
                text(
                    "ALTER TABLE payments ADD COLUMN parking_duration_minutes INTEGER NULL"
                )
            )

        if "failure_reason" not in payment_names:
            connection.execute(
                text(
                    "ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(255) NULL"
                )
            )

        if "parking_duration_minutes" in payment_names:
            connection.execute(
                text(
                    "UPDATE payments SET parking_duration_minutes = NULL WHERE parking_duration_minutes IS NULL"
                )
            )

        connection.execute(
            text(
                """
                INSERT INTO cancellation_fines (
                    user_id,
                    cancellation_reservation_id,
                    amount,
                    status,
                    payment_method,
                    settlement_payment_id,
                    created_at,
                    paid_at
                )
                SELECT
                    reservations.user_id,
                    reservations.id,
                    reservations.cancellation_fine,
                    CASE
                        WHEN LOWER(COALESCE(payments.method, 'cash')) = 'cash'
                            THEN 'PENDING'
                        ELSE 'PAID'
                    END,
                    COALESCE(payments.method, 'cash'),
                    CASE
                        WHEN LOWER(COALESCE(payments.method, 'cash')) = 'cash'
                            THEN NULL
                        ELSE payments.id
                    END,
                    CURRENT_TIMESTAMP,
                    CASE
                        WHEN LOWER(COALESCE(payments.method, 'cash')) = 'cash'
                            THEN NULL
                        ELSE CURRENT_TIMESTAMP
                    END
                FROM reservations
                LEFT JOIN payments ON payments.reservation_id = reservations.id
                WHERE reservations.status = 'cancelled'
                    AND reservations.cancellation_fine > 0
                    AND NOT EXISTS (
                        SELECT 1
                        FROM cancellation_fines
                        WHERE cancellation_fines.cancellation_reservation_id = reservations.id
                    )
                """
            )
        )

        connection.execute(
            text(
                """
                UPDATE payments
                SET amount = (
                    SELECT cancellation_fines.amount
                    FROM cancellation_fines
                    WHERE cancellation_fines.cancellation_reservation_id = payments.reservation_id
                        AND cancellation_fines.status = 'PENDING'
                        AND cancellation_fines.settlement_reservation_id IS NULL
                ),
                    status = 'pending',
                    failure_reason = NULL
                WHERE LOWER(method) = 'cash'
                    AND reservation_id IN (
                        SELECT cancellation_reservation_id
                        FROM cancellation_fines
                        WHERE status = 'PENDING'
                            AND settlement_reservation_id IS NULL
                    )
                """
            )
        )
