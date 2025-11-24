"""
MetaGuardian Setup: Three-Tier Validation Architecture
Install dependencies and initialize review queue database.
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run shell command with progress feedback"""
    print(f"\n{'='*60}")
    print(f"📦 {description}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✅ {description} - SUCCESS")
        if result.stdout:
            print(result.stdout)
    else:
        print(f"❌ {description} - FAILED")
        print(result.stderr)
        return False
    return True

def check_env_file():
    """Check if .env has required API keys"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        print(f"\n⚠️  WARNING: .env file not found at {env_path}")
        print("Creating template .env file...")
        with open(env_path, 'w') as f:
            f.write("""# MetaGuardian Environment Variables

# Required: Anthropic API for LLM Harm Detection
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Required: Groq API for Report Generation
GROQ_API_KEY=your-groq-key-here

# Email Configuration (SendGrid or similar)
SENDGRID_API_KEY=your-sendgrid-key-here
SENDGRID_FROM_EMAIL=reports@metaguardian.ai

# Reviewer Configuration
REVIEWER_EMAIL=regan@axiomintelligence.co.nz
ADMIN_REVIEW_ENABLED=true
AUTO_SAFE_DELIVERY_ENABLED=true

# Security
SECRET_KEY=your-secret-key-change-in-production-12345
""")
        print(f"✅ Template .env created. Please add your API keys.")
        return False
    
    # Check for ANTHROPIC_API_KEY
    with open(env_path, 'r') as f:
        content = f.read()
        if 'ANTHROPIC_API_KEY' not in content or 'sk-ant-your-key-here' in content:
            print(f"\n⚠️  WARNING: ANTHROPIC_API_KEY not configured in .env")
            print("LLM harm detection will NOT work without this key.")
            print("Get your key at: https://console.anthropic.com/")
            return False
    
    return True

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           MetaGuardian Setup Wizard                          ║
║           Three-Tier Validation Architecture                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

This script will:
1. Install Python dependencies (anthropic, beautifulsoup4)
2. Initialize review queue database tables
3. Verify environment configuration
4. Create sample admin user (optional)

""")

    # Step 1: Install dependencies
    if not run_command(
        "pip install anthropic beautifulsoup4 lxml",
        "Installing Python dependencies"
    ):
        sys.exit(1)
    
    # Step 2: Check .env file
    env_ok = check_env_file()
    if not env_ok:
        print("\n⚠️  Please configure .env before continuing.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Step 3: Initialize database tables
    print(f"\n{'='*60}")
    print("📊 Initializing Review Queue Database")
    print(f"{'='*60}")
    
    try:
        # Import after installing dependencies
        from review_queue import init_review_tables
        from database import engine
        
        # Create tables
        init_review_tables()
        print("✅ Review tables created successfully")
        
        # Also update User table for role column
        from sqlalchemy import text
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
                conn.commit()
                print("✅ Added 'role' column to users table")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e):
                    print("ℹ️  'role' column already exists in users table")
                else:
                    print(f"⚠️  Warning: {e}")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Step 4: Create admin user
    print(f"\n{'='*60}")
    print("👤 Admin User Setup")
    print(f"{'='*60}")
    
    response = input("Create admin user for review dashboard? (y/n): ")
    if response.lower() == 'y':
        email = input("Admin email: ").strip()
        password = input("Admin password: ").strip()
        
        try:
            from database import SessionLocal
            from models import User
            from passlib.context import CryptContext
            
            pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
            
            db = SessionLocal()
            existing = db.query(User).filter(User.email == email).first()
            
            if existing:
                # Update existing user to admin
                existing.role = 'admin'
                db.commit()
                print(f"✅ Updated {email} to admin role")
            else:
                # Create new admin user
                hashed_password = pwd_context.hash(password)
                admin_user = User(
                    email=email,
                    hashed_password=hashed_password,
                    role='admin'
                )
                db.add(admin_user)
                db.commit()
                print(f"✅ Created admin user: {email}")
            
            db.close()
        except Exception as e:
            print(f"❌ Failed to create admin user: {e}")
            import traceback
            traceback.print_exc()
    
    # Step 5: Test harm detector
    print(f"\n{'='*60}")
    print("🧪 Testing LLM Harm Detection")
    print(f"{'='*60}")
    
    if env_ok:
        try:
            from harm_detection import LLMHarmDetector
            import asyncio
            
            async def test_detector():
                detector = LLMHarmDetector()
                test_report = """
                <h1>Your Health Report</h1>
                <p>Based on your conversation, we recommend increasing exercise and improving diet.</p>
                """
                result = await detector.scan_report(test_report, 'preventive')
                print(f"✅ Harm detector working!")
                print(f"   Risk Level: {result.get('risk_level', 'unknown')}")
                print(f"   Requires Review: {result.get('requires_human_review', False)}")
            
            asyncio.run(test_detector())
        except Exception as e:
            print(f"⚠️  Harm detector test failed: {e}")
            print("This is expected if ANTHROPIC_API_KEY is not configured.")
    
    # Done
    print(f"\n{'='*60}")
    print("✅ Setup Complete!")
    print(f"{'='*60}")
    print("""
Next steps:
1. Add ANTHROPIC_API_KEY to backend/.env
2. Restart backend server: python -m uvicorn main:app --reload
3. Test finalize-session endpoint
4. Access admin review dashboard at /admin/review

Documentation:
- IMPLEMENTATION_ROADMAP.md - Full feature list
- RED_TEAM_ANALYSIS.md - Security audit findings
- harm_detection.py - LLM harm detector documentation
- review_queue.py - Review workflow documentation

Questions? Email: regan@axiomintelligence.co.nz
""")

if __name__ == "__main__":
    main()
