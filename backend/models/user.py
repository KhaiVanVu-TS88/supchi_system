"""
models/user.py — Updated: thêm cột role
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50),  unique=True, nullable=False, index=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active     = Column(Boolean, default=True, nullable=False)
    role          = Column(String(20), default="user", nullable=False, index=True)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    def __repr__(self):
        return f"<User id={self.id} username={self.username} role={self.role}>"