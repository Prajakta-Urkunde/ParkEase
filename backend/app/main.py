from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from app.core.config import CORS_ORIGINS
from routes.auth import router as auth_router
from routes.roles import router as roles_router
from routes.parking import router as parking_router
from routes.payments import router as payments_router

from models.user import User
from models.parking_lot import ParkingLot
from models.parking_slot import ParkingSlot
from models.reservation import Reservation
from models.payment import Payment

app = FastAPI(
    title="ParkEase API",
    description="Parking Management System API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(roles_router)
app.include_router(parking_router)
app.include_router(payments_router)


@app.get("/")
def root():
    return {
        "message": "ParkEase Backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }