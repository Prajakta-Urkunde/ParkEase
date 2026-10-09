import os
from pathlib import Path
from dotenv import load_dotenv

# Locate backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_DIR = BASE_DIR.parent
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv(
    "DATABASE_URL"
)
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in backend/.env or the environment")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY must be set in backend/.env or the environment and be at least 32 characters"
    )

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero")

VALID_VEHICLE_TYPES = ("2_wheeler", "3_wheeler", "4_wheeler")
HOURLY_RATE = 50
CANCELLATION_FINE = 20

_private_storage_setting = Path(
    os.getenv("PRIVATE_DOCUMENT_STORAGE_DIR", str(BASE_DIR / "private_storage"))
)
PRIVATE_DOCUMENT_STORAGE_DIR = (
    _private_storage_setting
    if _private_storage_setting.is_absolute()
    else BASE_DIR / _private_storage_setting
).resolve()
MAX_OWNER_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
MAX_OWNER_DOCUMENT_TOTAL_BYTES = 25 * 1024 * 1024
MAX_OWNER_DOCUMENT_COUNT = 8

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
