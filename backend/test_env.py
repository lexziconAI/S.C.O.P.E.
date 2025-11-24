from dotenv import load_dotenv
from pathlib import Path
import os

env_path = Path(__file__).parent / ".env"
print(f"Loading from: {env_path}")
print(f"File exists: {env_path.exists()}")

if env_path.exists():
    with open(env_path, 'rb') as f:
        raw = f.read()
        print(f"File size: {len(raw)} bytes")
        print(f"First 100 bytes (hex): {raw[:100].hex()}")
        print(f"As text: {raw.decode('utf-8', errors='replace')[:200]}")

load_dotenv(env_path, override=True)
key = os.getenv("OPENAI_API_KEY")
print(f"\nOPENAI_API_KEY loaded: {key[:30] if key else 'None'}...")
