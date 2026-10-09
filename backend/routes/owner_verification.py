import logging
import math
import os
import re
import secrets
import struct
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import (
    MAX_OWNER_DOCUMENT_COUNT,
    MAX_OWNER_DOCUMENT_SIZE_BYTES,
    MAX_OWNER_DOCUMENT_TOTAL_BYTES,
    PRIVATE_DOCUMENT_STORAGE_DIR,
    PROJECT_DIR,
)
from database import get_db
from models.owner_verification import OwnerVerification, OwnerVerificationDocument
from models.user import User
from schemas.owner_verification import OwnerVerificationReview
from utils.auth import get_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Property Verification"])
ALLOWED_FILE_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
}
STORAGE_KEY_PATTERN = re.compile(r"^[0-9a-f]{32}\.(pdf|jpg|jpeg|png)$")
def private_storage_root() -> Path:
    frontend_root = (PROJECT_DIR / "frontend").resolve()
    try:
        PRIVATE_DOCUMENT_STORAGE_DIR.relative_to(frontend_root)
    except ValueError:
        pass
    else:
        raise HTTPException(
            status_code=500,
            detail="Private document storage must be outside the frontend directory",
        )

    PRIVATE_DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        PRIVATE_DOCUMENT_STORAGE_DIR.chmod(0o700)
    return PRIVATE_DOCUMENT_STORAGE_DIR


def path_for_storage_key(storage_key: str) -> Path:
    if not STORAGE_KEY_PATTERN.fullmatch(storage_key):
        raise HTTPException(status_code=404, detail="Verification document not found")
    return private_storage_root() / storage_key


def remove_uncommitted_files(storage_keys: list[str]) -> None:
    for storage_key in storage_keys:
        try:
            path_for_storage_key(storage_key).unlink(missing_ok=True)
        except OSError:
            logger.error("Could not remove an uncommitted property verification upload")


def require_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    persisted_user = db.query(User).filter(User.id == current_user["id"]).first()
    if persisted_user is None or persisted_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"id": persisted_user.id, "role": persisted_user.role}


def property_address_key(address: str) -> str:
    return " ".join(address.casefold().split())


def verification_matches_property(
    verification: OwnerVerification,
    property_address: str,
    latitude: float | None,
    longitude: float | None,
) -> bool:
    if property_address_key(verification.property_address) != property_address_key(property_address):
        return False
    if (
        verification.latitude is None
        or verification.longitude is None
        or latitude is None
        or longitude is None
    ):
        return False
    return math.isclose(verification.latitude, latitude, abs_tol=0.000001) and math.isclose(
        verification.longitude,
        longitude,
        abs_tol=0.000001,
    )


def require_verified_owner(
    db: Session,
    owner_id: int,
    property_address: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> OwnerVerification:
    verification = (
        db.query(OwnerVerification)
        .filter(OwnerVerification.owner_id == owner_id)
        .first()
    )
    if verification is None or verification.status != "VERIFIED":
        raise HTTPException(
            status_code=403,
            detail="Property verification must be approved before publishing or booking this parking lot",
        )
    if property_address is not None:
        if not verification_matches_property(
            verification,
            property_address,
            latitude,
            longitude,
        ):
            raise HTTPException(
                status_code=403,
                detail="This parking lot's address and map location must match the approved property",
            )
    return verification


def document_metadata(document: OwnerVerificationDocument) -> dict:
    return {
        "id": document.id,
        "filename": document.original_filename,
        "mime_type": document.mime_type,
        "size_bytes": document.size_bytes,
        "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None,
    }


def has_valid_document_structure(extension: str, content: bytes) -> bool:
    if extension == ".pdf":
        return content.startswith(b"%PDF-") and b"%%EOF" in content[-1024:]
    if extension in {".jpg", ".jpeg"}:
        has_frame = any(
            marker in content
            for marker in (
                b"\xff\xc0",
                b"\xff\xc1",
                b"\xff\xc2",
                b"\xff\xc3",
                b"\xff\xc5",
                b"\xff\xc6",
                b"\xff\xc7",
                b"\xff\xc9",
                b"\xff\xca",
                b"\xff\xcb",
                b"\xff\xcd",
                b"\xff\xce",
                b"\xff\xcf",
            )
        )
        return (
            len(content) >= 5
            and content.startswith(b"\xff\xd8\xff")
            and content.endswith(b"\xff\xd9")
            and has_frame
            and b"\xff\xda" in content
        )
    if extension != ".png" or not content.startswith(b"\x89PNG\r\n\x1a\n"):
        return False

    position = 8
    found_header = False
    found_image_data = False
    while position + 12 <= len(content):
        chunk_length = struct.unpack(">I", content[position : position + 4])[0]
        chunk_end = position + 12 + chunk_length
        if chunk_end > len(content):
            return False
        chunk_type = content[position + 4 : position + 8]
        chunk_data = content[position + 8 : position + 8 + chunk_length]
        expected_crc = struct.unpack(">I", content[position + 8 + chunk_length : chunk_end])[0]
        actual_crc = zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            return False

        if not found_header:
            if chunk_type != b"IHDR" or chunk_length != 13:
                return False
            width, height = struct.unpack(">II", chunk_data[:8])
            if width == 0 or height == 0:
                return False
            found_header = True
        elif chunk_type == b"IHDR":
            return False

        if chunk_type == b"IDAT":
            found_image_data = True
        position = chunk_end
        if chunk_type == b"IEND":
            return chunk_length == 0 and found_header and found_image_data and position == len(content)

    return False


def owner_status_payload(
    verification: OwnerVerification | None,
    documents: list[OwnerVerificationDocument],
) -> dict:
    if verification is None:
        return {
            "status": "NOT_SUBMITTED",
            "property_name": None,
            "property_address": None,
            "latitude": None,
            "longitude": None,
            "property_relationship": None,
            "property_identifier": None,
            "submitted_at": None,
            "reviewed_at": None,
            "review_notes": None,
            "documents": [],
        }

    visible_notes = (
        verification.review_notes
        if verification.status in {"NEEDS_MORE_INFORMATION", "REJECTED"}
        else None
    )
    return {
        "status": verification.status,
        "property_name": verification.property_name,
        "property_address": verification.property_address,
        "latitude": verification.latitude,
        "longitude": verification.longitude,
        "property_relationship": verification.property_relationship,
        "property_identifier": verification.property_identifier,
        "submitted_at": verification.submitted_at.isoformat() if verification.submitted_at else None,
        "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None,
        "review_notes": visible_notes,
        "documents": [document_metadata(document) for document in documents],
    }


@router.get("/owner/verification")
def get_owner_verification(
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    verification = (
        db.query(OwnerVerification)
        .filter(OwnerVerification.owner_id == current_user["id"])
        .first()
    )
    documents = []
    if verification is not None:
        documents = (
            db.query(OwnerVerificationDocument)
            .filter(OwnerVerificationDocument.verification_id == verification.id)
            .order_by(OwnerVerificationDocument.uploaded_at.asc())
            .all()
        )
    return owner_status_payload(verification, documents)


@router.post("/owner/verification", status_code=201)
async def submit_owner_verification(
    property_name: Annotated[str, Form(min_length=2, max_length=150)],
    property_address: Annotated[str, Form(min_length=5, max_length=255)],
    property_relationship: Annotated[
        Literal["OWNER", "TENANT", "AUTHORIZED_OPERATOR"],
        Form(),
    ],
    latitude: Annotated[float, Form()],
    longitude: Annotated[float, Form()],
    files: Annotated[list[UploadFile], File()],
    property_identifier: Annotated[str | None, Form(max_length=150)] = None,
    current_user: dict = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    if len(property_name.strip()) < 2 or len(property_address.strip()) < 5:
        raise HTTPException(status_code=422, detail="Property name and address are too short")
    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise HTTPException(status_code=422, detail="Latitude must be between -90 and 90")
    if not math.isfinite(longitude) or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Longitude must be between -180 and 180")
    if not files:
        raise HTTPException(status_code=422, detail="At least one property evidence document is required")
    if len(files) > MAX_OWNER_DOCUMENT_COUNT:
        raise HTTPException(
            status_code=413,
            detail=f"No more than {MAX_OWNER_DOCUMENT_COUNT} documents may be submitted at once",
        )

    verification = (
        db.query(OwnerVerification)
        .filter(OwnerVerification.owner_id == current_user["id"])
        .first()
    )
    if verification is not None and verification.status not in {
        "NEEDS_MORE_INFORMATION",
        "REJECTED",
    }:
        raise HTTPException(
            status_code=409,
            detail="A submitted application cannot be changed while it is pending, under review, or verified",
        )

    saved_storage_keys: list[str] = []
    uploaded_metadata: list[dict] = []
    total_size = 0
    committed = False

    try:
        root = private_storage_root()
        for upload in files:
            extension = Path(upload.filename or "").suffix.lower()
            expected_type = ALLOWED_FILE_TYPES.get(extension)
            if expected_type is None or upload.content_type != expected_type[0]:
                raise HTTPException(
                    status_code=415,
                    detail="Only PDF, JPG, and PNG property evidence files are accepted",
                )

            content = await upload.read(MAX_OWNER_DOCUMENT_SIZE_BYTES + 1)
            if not content:
                raise HTTPException(status_code=422, detail="Empty documents cannot be submitted")
            if len(content) > MAX_OWNER_DOCUMENT_SIZE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Each property evidence document must be 10 MB or smaller",
                )
            total_size += len(content)
            if total_size > MAX_OWNER_DOCUMENT_TOTAL_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Combined property evidence documents must be 25 MB or smaller",
                )
            if not content.startswith(expected_type[1]) or not has_valid_document_structure(
                extension, content
            ):
                raise HTTPException(
                    status_code=415,
                    detail="A document's content does not match its permitted file type",
                )

            original_filename = re.split(r"[\\/]", upload.filename or "")[-1]
            original_filename = "".join(
                character for character in original_filename if character.isprintable()
            )[:255]
            storage_key = f"{secrets.token_hex(16)}{extension}"
            storage_path = root / storage_key
            saved_storage_keys.append(storage_key)
            file_descriptor = os.open(
                storage_path,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o600,
            )
            with os.fdopen(file_descriptor, "wb") as private_file:
                private_file.write(content)
            uploaded_metadata.append(
                {
                    "original_filename": original_filename,
                    "mime_type": expected_type[0],
                    "size_bytes": len(content),
                    "storage_key": storage_key,
                }
            )

        now = datetime.now(timezone.utc)
        if verification is None:
            verification = OwnerVerification(
                owner_id=current_user["id"],
                property_name=property_name.strip(),
                property_address=property_address.strip(),
                latitude=latitude,
                longitude=longitude,
                property_relationship=property_relationship,
                property_identifier=property_identifier.strip() if property_identifier else None,
                status="PENDING",
                submitted_at=now,
            )
            db.add(verification)
            db.flush()
        else:
            verification.property_name = property_name.strip()
            verification.property_address = property_address.strip()
            verification.latitude = latitude
            verification.longitude = longitude
            verification.property_relationship = property_relationship
            verification.property_identifier = (
                property_identifier.strip() if property_identifier else None
            )
            verification.status = "PENDING"
            verification.submitted_at = now
            verification.reviewed_at = None
            verification.reviewer_id = None
            verification.review_notes = None

        for metadata in uploaded_metadata:
            db.add(
                OwnerVerificationDocument(
                    verification_id=verification.id,
                    **metadata,
                )
            )
        db.commit()
        committed = True
        db.refresh(verification)
        documents = (
            db.query(OwnerVerificationDocument)
            .filter(OwnerVerificationDocument.verification_id == verification.id)
            .order_by(OwnerVerificationDocument.uploaded_at.asc())
            .all()
        )
        return owner_status_payload(verification, documents)
    except HTTPException:
        db.rollback()
        if not committed:
            remove_uncommitted_files(saved_storage_keys)
        raise
    except OSError:
        db.rollback()
        if not committed:
            remove_uncommitted_files(saved_storage_keys)
        raise HTTPException(
            status_code=503,
            detail="Private document storage is unavailable; please try again later",
        )
    except SQLAlchemyError:
        db.rollback()
        if not committed:
            remove_uncommitted_files(saved_storage_keys)
        raise HTTPException(
            status_code=500,
            detail="Property verification submission could not be saved",
        )


@router.get("/admin/owner-verifications")
def list_owner_verifications(
    status: Literal[
        "ALL",
        "PENDING",
        "UNDER_REVIEW",
        "NEEDS_MORE_INFORMATION",
        "VERIFIED",
        "REJECTED",
    ] = Query(default="ALL"),
    current_admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(OwnerVerification)
    if status != "ALL":
        query = query.filter(OwnerVerification.status == status)
    applications = query.order_by(OwnerVerification.submitted_at.desc()).all()
    result = []
    for verification in applications:
        owner = db.query(User).filter(User.id == verification.owner_id).first()
        documents = (
            db.query(OwnerVerificationDocument)
            .filter(OwnerVerificationDocument.verification_id == verification.id)
            .order_by(OwnerVerificationDocument.uploaded_at.asc())
            .all()
        )
        result.append(
            {
                "id": verification.id,
                "owner_id": verification.owner_id,
                "owner_name": owner.name if owner else None,
                "owner_email": owner.email if owner else None,
                "property_name": verification.property_name,
                "property_address": verification.property_address,
                "latitude": verification.latitude,
                "longitude": verification.longitude,
                "property_relationship": verification.property_relationship,
                "property_identifier": verification.property_identifier,
                "status": verification.status,
                "submitted_at": verification.submitted_at.isoformat() if verification.submitted_at else None,
                "documents": [document_metadata(document) for document in documents],
            }
        )
    return result


@router.get("/admin/owner-verifications/{verification_id}")
def get_owner_verification_for_review(
    verification_id: int,
    current_admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    verification = db.query(OwnerVerification).filter(
        OwnerVerification.id == verification_id
    ).first()
    if verification is None:
        raise HTTPException(status_code=404, detail="Verification application not found")
    owner = db.query(User).filter(User.id == verification.owner_id).first()
    documents = (
        db.query(OwnerVerificationDocument)
        .filter(OwnerVerificationDocument.verification_id == verification.id)
        .order_by(OwnerVerificationDocument.uploaded_at.asc())
        .all()
    )
    payload = owner_status_payload(verification, documents)
    payload.update(
        {
            "id": verification.id,
            "owner_id": verification.owner_id,
            "owner_name": owner.name if owner else None,
            "owner_email": owner.email if owner else None,
        }
    )
    return payload


@router.get("/admin/owner-verification-documents/{document_id}")
def get_owner_verification_document(
    document_id: int,
    current_admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = (
        db.query(OwnerVerificationDocument)
        .filter(OwnerVerificationDocument.id == document_id)
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Verification document not found")
    document_path = path_for_storage_key(document.storage_key)
    if not document_path.is_file():
        raise HTTPException(status_code=404, detail="Verification document not found")
    return FileResponse(
        document_path,
        media_type=document.mime_type,
        filename=document.original_filename,
        content_disposition_type="attachment",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/admin/owner-verifications/{verification_id}/review")
def review_owner_verification(
    verification_id: int,
    review: OwnerVerificationReview,
    current_admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    verification = db.query(OwnerVerification).filter(
        OwnerVerification.id == verification_id
    ).first()
    if verification is None:
        raise HTTPException(status_code=404, detail="Verification application not found")

    if review.status == "UNDER_REVIEW":
        if verification.status not in {"PENDING", "VERIFIED"}:
            raise HTTPException(
                status_code=409,
                detail="Only pending or approved applications can be moved under review",
            )
    elif verification.status != "UNDER_REVIEW":
        raise HTTPException(
            status_code=409,
            detail="Move the application under review before approving or changing its decision",
        )

    if review.status in {"NEEDS_MORE_INFORMATION", "REJECTED"} and not review.review_notes:
        raise HTTPException(
            status_code=422,
            detail="A clear review note is required for this decision",
        )

    verification.status = review.status
    verification.review_notes = review.review_notes
    verification.reviewer_id = current_admin["id"]
    verification.reviewed_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Property verification review could not be saved",
        )
    db.refresh(verification)
    documents = (
        db.query(OwnerVerificationDocument)
        .filter(OwnerVerificationDocument.verification_id == verification.id)
        .order_by(OwnerVerificationDocument.uploaded_at.asc())
        .all()
    )
    return owner_status_payload(verification, documents)
