import sys
sys.path.insert(0, "/app")

import os
from core.database import SessionLocal
from core.security import hash_password

# Import tất cả models để SQLAlchemy resolve relationships
import models.video   # noqa
import models.job     # noqa
from models.user import User


def create_admin():
    email    = os.getenv("ADMIN_EMAIL",    "admin@supchi4.com")
    password = os.getenv("ADMIN_PASSWORD", "Admin@123456")
    username = os.getenv("ADMIN_USERNAME", "admin")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
                print(f"✓ Upgraded {email} to admin")
            else:
                print(f"✓ Admin {email} already exists")
            return

        admin = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"✓ Created admin: {email} / {password}")
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()