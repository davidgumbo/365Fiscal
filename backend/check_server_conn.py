import requests
import sys

try:
    print("Attempting to connect to http://127.0.0.1:8000/api/auth/password-login...")
    response = requests.post("http://127.0.0.1:8000/api/auth/password-login", json={"email": "info@geenet.co.zw", "password": "admin123"})
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {response.headers}")
    print(f"Content: {response.text[:200]}") # Print first 200 chars
except Exception as e:
    print(f"Failed to connect: {e}")
