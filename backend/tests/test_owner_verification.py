import asyncio
from io import BytesIO
import struct
import zlib

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.owner_verification import OwnerVerification, OwnerVerificationDocument
from models.payment import Payment
from models.user import User
from routes.owner_verification import (
    get_owner_verification_document,
    list_owner_verifications,
    require_admin,
    submit_owner_verification,
    review_owner_verification,
)
from routes.parking import (
    CancelReservationRequest,
    cancel_reservation,
    complete_reservation,
    create_parking_lot,
    create_parking_slot,
    create_reservation,
    get_available_parking_lots,
    start_parking,
)
from routes.payments import checkout_reservation
from schemas.owner_verification import OwnerVerificationReview
from schemas.parking import ParkingLotCreate, ParkingSlotCreate
from schemas.payment import CheckoutRequest
from schemas.reservation import ReservationCreate


@pytest.fixture
def db(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'verification.db'}")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    from routes import owner_verification as verification_routes

    monkeypatch.setattr(
        verification_routes,
        "PRIVATE_DOCUMENT_STORAGE_DIR",
        tmp_path / "private-documents",
    )
    session.add_all(
        [
            User(name="Property Owner", email="owner@example.test", password="unused", role="owner"),
            User(name="Parking User", email="user@example.test", password="unused", role="user"),
            User(name="Reviewer", email="admin@example.test", password="unused", role="admin"),
        ]
    )
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def pdf_upload(
    filename: str = "property-record.pdf",
    content: bytes = b"%PDF-1.7\nproperty evidence\n%%EOF",
) -> UploadFile:
    return UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "application/pdf"}),
    )


def png_upload() -> UploadFile:
    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + chunk_type
            + data
            + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    content = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
        + chunk(b"IEND", b"")
    )
    return UploadFile(
        file=BytesIO(content),
        filename="property-photo.png",
        headers=Headers({"content-type": "image/png"}),
    )


def submit(db, uploads, relationship="OWNER"):
    return asyncio.run(
        submit_owner_verification(
            property_name="Riverside Parking",
            property_address="12 Riverside Road, Pune",
            property_relationship=relationship,
            latitude=18.5204,
            longitude=73.8567,
            files=uploads,
            current_user={"id": 1, "role": "owner"},
            db=db,
        )
    )


def test_owner_without_evidence_is_not_verified_and_cannot_publish(db):
    with pytest.raises(HTTPException) as no_evidence:
        submit(db, [])
    assert no_evidence.value.status_code == 422
    assert db.query(OwnerVerification).count() == 0

    with pytest.raises(HTTPException) as publish_error:
        create_parking_lot(
            ParkingLotCreate(name="Unverified Lot", address="12 Riverside Road", total_slots=2),
            current_user={"id": 1, "role": "owner"},
            db=db,
        )
    assert publish_error.value.status_code == 403


def test_valid_evidence_is_private_and_does_not_auto_approve(db, tmp_path):
    payload = submit(db, [pdf_upload("../../sale-deed.pdf")])

    assert payload["status"] == "PENDING"
    assert payload["property_relationship"] == "OWNER"
    assert payload["documents"][0]["filename"] == "sale-deed.pdf"
    assert "storage_key" not in payload["documents"][0]
    assert str(tmp_path / "private-documents") not in repr(payload)
    assert list((tmp_path / "private-documents").iterdir())
    assert db.query(OwnerVerification).one().status == "PENDING"


def test_accepts_well_formed_png_evidence(db):
    payload = submit(db, [png_upload()])
    assert payload["status"] == "PENDING"
    assert payload["documents"][0]["mime_type"] == "image/png"


@pytest.mark.parametrize("relationship", ["TENANT", "AUTHORIZED_OPERATOR"])
def test_tenant_and_operator_can_submit_authorization_evidence(db, relationship):
    payload = submit(db, [pdf_upload()], relationship=relationship)

    assert payload["status"] == "PENDING"
    assert payload["property_relationship"] == relationship


@pytest.mark.parametrize(
    ("filename", "content_type", "content", "expected_status"),
    [
        ("proof.exe", "application/octet-stream", b"MZ executable", 415),
        ("proof.pdf", "application/pdf", b"not a PDF", 415),
        ("proof.png", "image/png", b"\x89PNG\r\n\x1a\nmalformed", 415),
        ("proof.jpg", "image/jpeg", b"\xff\xd8\xffmalformed\xff\xd9", 415),
    ],
)
def test_rejects_unsupported_or_mismatched_document_content(
    db, filename, content_type, content, expected_status
):
    from routes import owner_verification as verification_routes

    upload = UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )
    with pytest.raises(HTTPException) as upload_error:
        submit(db, [upload])

    assert upload_error.value.status_code == expected_status
    assert db.query(OwnerVerification).count() == 0
    assert not list(verification_routes.PRIVATE_DOCUMENT_STORAGE_DIR.iterdir())


def test_rejects_documents_over_configured_size_limit(db, monkeypatch):
    from routes import owner_verification as verification_routes

    monkeypatch.setattr(verification_routes, "MAX_OWNER_DOCUMENT_SIZE_BYTES", 8)
    with pytest.raises(HTTPException) as upload_error:
        submit(db, [pdf_upload(content=b"%PDF-1.7 larger than limit")])

    assert upload_error.value.status_code == 413
    assert db.query(OwnerVerification).count() == 0


def test_rejected_owner_can_resubmit_with_more_evidence(db):
    submit(db, [pdf_upload()])
    application = db.query(OwnerVerification).one()
    admin = require_admin(current_user={"id": 3, "role": "admin"}, db=db)
    review_owner_verification(
        application.id,
        OwnerVerificationReview(status="UNDER_REVIEW"),
        current_admin=admin,
        db=db,
    )
    review_owner_verification(
        application.id,
        OwnerVerificationReview(status="REJECTED", review_notes="Provide a legible property record."),
        current_admin=admin,
        db=db,
    )

    payload = submit(db, [pdf_upload("clear-copy.pdf")])

    assert payload["status"] == "PENDING"
    assert payload["review_notes"] is None
    assert {item["filename"] for item in payload["documents"]} == {
        "property-record.pdf",
        "clear-copy.pdf",
    }


def test_non_admin_cannot_review_or_download_documents(db):
    submit(db, [pdf_upload()])
    document = db.query(OwnerVerificationDocument).one()

    with pytest.raises(HTTPException) as review_error:
        require_admin(current_user={"id": 2, "role": "admin"}, db=db)
    assert review_error.value.status_code == 403

    with pytest.raises(HTTPException) as download_error:
        require_admin(current_user={"id": 1, "role": "admin"}, db=db)
    assert download_error.value.status_code == 403

    admin = require_admin(current_user={"id": 3, "role": "admin"}, db=db)
    download = get_owner_verification_document(document.id, current_admin=admin, db=db)
    assert download.headers["cache-control"] == "no-store"
    assert download.headers["x-content-type-options"] == "nosniff"


def test_admin_application_list_includes_all_statuses_and_supports_filters(db):
    submit(db, [pdf_upload()])
    db.add(
        OwnerVerification(
            owner_id=2,
            property_name="Verified Property",
            property_address="Second Street, Pune",
            latitude=18.52,
            longitude=73.85,
            property_relationship="OWNER",
            status="VERIFIED",
        )
    )
    db.commit()
    admin = require_admin(current_user={"id": 3, "role": "admin"}, db=db)

    all_applications = list_owner_verifications(
        status="ALL",
        current_admin=admin,
        db=db,
    )
    pending_applications = list_owner_verifications(
        status="PENDING",
        current_admin=admin,
        db=db,
    )

    assert {item["status"] for item in all_applications} == {"PENDING", "VERIFIED"}
    assert all(item["owner_name"] and item["owner_email"] for item in all_applications)
    assert len(pending_applications) == 1
    assert pending_applications[0]["status"] == "PENDING"


def test_approval_enables_listing_and_revocation_blocks_new_bookings_but_preserves_existing(
    db,
):
    submit(db, [pdf_upload()])
    application = db.query(OwnerVerification).one()
    admin = require_admin(current_user={"id": 3, "role": "admin"}, db=db)

    review_owner_verification(
        application.id,
        OwnerVerificationReview(status="UNDER_REVIEW"),
        current_admin=admin,
        db=db,
    )
    review_owner_verification(
        application.id,
        OwnerVerificationReview(status="VERIFIED"),
        current_admin=admin,
        db=db,
    )

    with pytest.raises(HTTPException) as address_error:
        create_parking_lot(
            ParkingLotCreate(name="Unrelated Lot", address="99 Other Street", total_slots=1),
            current_user={"id": 1, "role": "owner"},
            db=db,
        )
    assert address_error.value.status_code == 403

    lot = create_parking_lot(
        ParkingLotCreate(
            name="Riverside Lot",
            address="12 Riverside Road, Pune",
            latitude=1,
            longitude=1,
            total_slots=2,
        ),
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    assert (lot.latitude, lot.longitude) == (18.5204, 73.8567)
    first_slot = create_parking_slot(
        ParkingSlotCreate(slot_number="A1", parking_lot_id=lot.id),
        current_user={"id": 1, "role": "owner"},
        db=db,
    )
    second_slot = create_parking_slot(
        ParkingSlotCreate(slot_number="A2", parking_lot_id=lot.id),
        current_user={"id": 1, "role": "owner"},
        db=db,
    )

    active = create_reservation(
        ReservationCreate(parking_lot_id=lot.id, parking_slot_id=first_slot.id),
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    checkout = checkout_reservation(
        CheckoutRequest(
            parking_lot_id=lot.id,
            parking_slot_id=second_slot.id,
            payment_method="upi",
        ),
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    cancelled = cancel_reservation(
        checkout.reservation.id,
        payment_data=CancelReservationRequest(payment_method="cash"),
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    assert cancelled["status"] == "cancelled"
    assert len(get_available_parking_lots({"id": 2, "role": "user"}, db)) == 1

    review_owner_verification(
        application.id,
        OwnerVerificationReview(status="UNDER_REVIEW"),
        current_admin=admin,
        db=db,
    )
    assert get_available_parking_lots({"id": 2, "role": "user"}, db) == []

    with pytest.raises(HTTPException) as booking_error:
        create_reservation(
            ReservationCreate(parking_lot_id=lot.id, parking_slot_id=second_slot.id),
            current_user={"id": 2, "role": "user"},
            db=db,
        )
    assert booking_error.value.status_code == 403
    with pytest.raises(HTTPException) as checkout_error:
        checkout_reservation(
            CheckoutRequest(
                parking_lot_id=lot.id,
                parking_slot_id=second_slot.id,
                payment_method="upi",
            ),
            current_user={"id": 2, "role": "user"},
            db=db,
        )
    assert checkout_error.value.status_code == 403

    started = start_parking(
        active.id,
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    assert started["status"] == "active"
    completed = complete_reservation(
        active.id,
        current_user={"id": 2, "role": "user"},
        db=db,
    )
    assert completed.status == "completed"
    assert db.query(Payment).count() == 2
