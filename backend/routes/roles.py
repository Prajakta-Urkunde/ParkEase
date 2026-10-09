from fastapi import APIRouter, Depends

from utils.auth import require_role

router = APIRouter(
    prefix="/dashboard",
    tags=["Role Based Access"]
)


@router.get("/user")
def user_dashboard(
    current_user: dict = Depends(require_role("user"))
):
    return {
        "message": "Welcome to the User Dashboard",
        "user_id": current_user["id"],
        "role": current_user["role"]
    }


@router.get("/owner")
def owner_dashboard(
    current_user: dict = Depends(require_role("owner"))
):
    return {
        "message": "Welcome to the Owner Dashboard",
        "user_id": current_user["id"],
        "role": current_user["role"]
    }
