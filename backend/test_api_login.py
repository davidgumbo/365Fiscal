from fastapi.testclient import TestClient
import sys
import os

# Add the current directory to sys.path to make imports work
sys.path.append(os.getcwd())

from app.main import app

client = TestClient(app)

print("Sending login request...")
response = client.post(
    "/api/auth/password-login",
    json={"email": "info@geenet.co.zw", "password": "admin123"},
)

print(f"Status Code: {response.status_code}")
print(f"Response JSON: {response.json()}")
