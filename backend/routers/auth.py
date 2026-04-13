"""
routers/auth.py — Authentication endpoints

POST /api/auth/register  — Đăng ký tài khoản mới
POST /api/auth/login     — Đăng nhập, nhận JWT tokens
POST /api/auth/refresh   — Lấy access token mới từ refresh token
GET  /api/auth/me        — Lấy thông tin user hiện tại
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from core.config import get_settings
from core.deps import get_current_user
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


# ── Pydantic schemas ──

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username phải có ít nhất 3 ký tự.")
        if len(v) > 50:
            raise ValueError("Username không được quá 50 ký tự.")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username chỉ được chứa chữ, số, _ và -.")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if '@' not in v or '.' not in v:
            raise ValueError("Email không hợp lệ.")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def password_valid(cls, v):
        if len(v) < 6:
            raise ValueError("Mật khẩu phải có ít nhất 6 ký tự.")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        return v.strip().lower()


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str          # 'user' | 'admin'
    created_at: str

    class Config:
        from_attributes = True


# ── Endpoints ──

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Đăng ký tài khoản mới.
    Tự động đăng nhập sau khi đăng ký thành công (trả về tokens luôn).
    """
    # Kiểm tra email đã tồn tại chưa
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email đã được sử dụng.")

    # Kiểm tra username đã tồn tại chưa
    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=400, detail="Username đã được sử dụng.")

    # Tạo user mới
    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Tạo tokens
    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Đăng nhập với email + mật khẩu, nhận JWT tokens."""
    user = db.query(User).filter(User.email == request.email).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khoá.")

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest):
    """Lấy access token mới từ refresh token (không cần đăng nhập lại)."""
    payload = decode_token(request.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ hoặc đã hết hạn.")

    token_data = {"sub": payload["sub"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin user đang đăng nhập."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,        # thêm dòng này
        created_at=current_user.created_at.isoformat(),
    )
