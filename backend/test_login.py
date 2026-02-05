import sys
import os

# Add the current directory to sys.path so we can import app modules
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.user import User
from app.security.security import verify_password

def test_login(email, password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User not found: {email}")
            return

        print(f"User found: {user.email}")
        print(f"Stored hash: {user.hashed_password}")
        
        is_valid = verify_password(password, user.hashed_password)
        print(f"Password '{password}' valid? {is_valid}")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_login("info@geenet.co.zw", "admin123")
