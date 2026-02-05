import sys
import os

# Add the current directory to sys.path so we can import app modules
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.user import User

def check_user(email):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User found: ID={user.id}, Email={user.email}, Is Admin={user.is_admin}")
        else:
            print(f"User not found: {email}")
            # List all users
            users = db.query(User).all()
            print("Available users:")
            for u in users:
                print(f" - {u.email}")
    finally:
        db.close()

if __name__ == "__main__":
    check_user("info@geenet.co.zw")
