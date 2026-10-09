from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class OwnerVerification(Base):
    __tablename__ = "owner_verifications"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    property_name = Column(String(150), nullable=False)
    property_address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    property_relationship = Column(String(30), nullable=False)
    property_identifier = Column(String(150), nullable=True)
    status = Column(String(40), nullable=False, default="PENDING", index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)


class OwnerVerificationDocument(Base):
    __tablename__ = "owner_verification_documents"

    id = Column(Integer, primary_key=True, index=True)
    verification_id = Column(
        Integer,
        ForeignKey("owner_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    storage_key = Column(String(100), nullable=False, unique=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
