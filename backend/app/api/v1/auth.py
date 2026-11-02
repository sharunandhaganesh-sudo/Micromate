from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.models.models import User, NotificationPreference, AuditLog
from backend.app.schemas.schemas import UserLogin, UserCreate, UserResponse, TokenResponse
from backend.app.api.deps import require_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    token = create_access_token(subject=user.id, role=user.role)
    
    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="USER_LOGIN",
        entity_type="USER",
        entity_id=user.id,
        details="User logged in successfully"
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")

    # Enforce safe role on public registration: default to operator
    role = user_in.role if user_in.role in ["operator", "viewer"] else "viewer"

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # Create default notification preference
    pref = NotificationPreference(
        user_id=new_user.id,
        email_enabled=True,
        in_app_enabled=True,
        telegram_enabled=False,
        min_severity="advisory",
        notification_email=new_user.email
    )
    db.add(pref)
    db.commit()
    db.refresh(new_user)

    return UserResponse.model_validate(new_user)

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(require_current_user)):
    return UserResponse.model_validate(current_user)
