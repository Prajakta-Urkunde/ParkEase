from typing import Literal

from pydantic import BaseModel, Field, field_validator


VerificationReviewStatus = Literal[
    "UNDER_REVIEW",
    "VERIFIED",
    "NEEDS_MORE_INFORMATION",
    "REJECTED",
]


class OwnerVerificationReview(BaseModel):
    status: VerificationReviewStatus
    review_notes: str | None = Field(default=None, max_length=2000)

    @field_validator("review_notes")
    @classmethod
    def normalize_review_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None
