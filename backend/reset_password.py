import sys
import os

# Add the current directory to sys.path so we can import app modules
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.user import User
from app.security.security import hash_password

def reset_password(email, new_password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Resetting password for {email}...")
            user.hashed_password = hash_password(new_password)
            db.commit()
            print(f"Password reset successfully to '{new_password}'.")
        else:
            print(f"User not found: {email}")
            # Create the user if it doesn't exist? 
            # No, let's just stick to reset for now.
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_password("info@geenet.co.zw", "admin123")
