from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Full name (2-100 characters)"
    )
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,  # bcrypt hard limit
        description="Password (8-72 characters)"
    )
    role: str = Field(default="user")

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be blank")
        return v.strip()

    @field_validator("role")
    @classmethod
    def role_lowercase(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in ("user", "owner"):
            raise ValueError("Role must be 'user' or 'owner'")
        return v

    @field_validator("password")
    @classmethod
    def password_bcrypt_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return v


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
