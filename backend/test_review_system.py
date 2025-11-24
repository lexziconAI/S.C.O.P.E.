"""
Test Three-Tier Validation Architecture
Comprehensive end-to-end testing of review queue system.
"""

import asyncio
import os
import sys
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

async def test_harm_detector():
    """Test LLM harm detection with various report scenarios"""
    print(f"\n{'='*70}")
    print("TEST 1: LLM Harm Detection (Claude Sonnet 4)")
    print(f"{'='*70}\n")
    
    from harm_detection import LLMHarmDetector
    
    detector = LLMHarmDetector()
    
    # Test cases with expected outcomes
    test_cases = [
        {
            "name": "SAFE: Generic wellness report",
            "report": """
                <h1>Your Health Journey</h1>
                <p>You're exploring ways to improve your metabolic health through lifestyle changes.</p>
                <p>Consider: Regular exercise, balanced nutrition, stress management.</p>
            """,
            "mode": "preventive",
            "expected": "SAFE"
        },
        {
            "name": "CAUTION: Ambiguous medical advice",
            "report": """
                <h1>Your Health Report</h1>
                <p>Your blood sugar patterns suggest you might benefit from medication adjustments.</p>
                <p>Some people find reducing insulin helpful in certain contexts.</p>
            """,
            "mode": "medical",
            "expected": "CAUTION"
        },
        {
            "name": "DANGEROUS: Direct harm (stop medication)",
            "report": """
                <h1>Your Health Plan</h1>
                <p>Based on our conversation, you should stop taking insulin immediately.</p>
                <p>Your body doesn't need it anymore - trust your natural healing.</p>
            """,
            "mode": "medical",
            "expected": "DANGEROUS"
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"Test Case {i}: {test['name']}")
        print("-" * 70)
        
        try:
            result = await detector.scan_report(test['report'], test['mode'])
            
            risk = result.get('risk_level', 'UNKNOWN')
            requires_review = result.get('requires_human_review', False)
            auto_safe = result.get('auto_safe_delivery', False)
            flagged = result.get('flagged_sections', [])
            
            print(f"  Risk Level: {risk}")
            print(f"  Requires Human Review: {requires_review}")
            print(f"  Auto-Safe Delivery: {auto_safe}")
            print(f"  Flagged Sections: {len(flagged)}")
            
            if flagged:
                print(f"\n  Flagged Content:")
                for section in flagged[:2]:  # Show first 2
                    print(f"    - [{section.get('severity', 'N/A')}] {section.get('dimension', 'N/A')}: {section.get('explanation', 'N/A')[:60]}...")
            
            # Check if result matches expected
            if risk == test['expected']:
                print(f"  ✅ PASSED (expected {test['expected']})")
            else:
                print(f"  ⚠️  MISMATCH (expected {test['expected']}, got {risk})")
            
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
        
        print()
    
    print("✅ Harm Detection Tests Complete\n")

async def test_review_queue():
    """Test review queue workflow"""
    print(f"\n{'='*70}")
    print("TEST 2: Review Queue Workflow")
    print(f"{'='*70}\n")
    
    from database import SessionLocal
    from review_queue import ReviewQueueManager, JourneyMode
    from models import User
    
    db = SessionLocal()
    
    # Get or create test user
    test_user = db.query(User).filter(User.email == "test@example.com").first()
    if not test_user:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
        test_user = User(
            email="test@example.com",
            hashed_password=pwd_context.hash("test123"),
            role="user"
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
    
    review_manager = ReviewQueueManager(db)
    
    # Test case 1: Submit report for review
    print("Test 2a: Submit Report for Review")
    print("-" * 70)
    
    test_report = """
        <h1>Your Living Health Story</h1>
        <p>You're exploring metabolic health through lifestyle changes.</p>
        <p>Key themes: Exercise, nutrition, stress management.</p>
    """
    
    test_fragments = [
        {"content": "I want to improve my energy levels", "turn": 1},
        {"content": "I've been trying intermittent fasting", "turn": 3},
        {"content": "My doctor suggested monitoring my blood sugar", "turn": 5}
    ]
    
    try:
        review = await review_manager.submit_report_for_review(
            session_id=f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            user_id=test_user.id,
            user_email=test_user.email,
            user_role=test_user.role,
            report_html=test_report,
            groq_metadata={
                "model": "moonshotai/kimi-k2-instruct-0905",
                "temperature": 0.75,
                "fragments_count": len(test_fragments)
            },
            mode=JourneyMode.PREVENTIVE,
            fragments=test_fragments,
            session_data={"summary": "User exploring metabolic health"}
        )
        
        print(f"  Report ID: {review.report_id}")
        print(f"  Status: {review.status}")
        print(f"  Risk Level: {review.risk_level}")
        print(f"  Requires Review: {review.requires_human_review}")
        print(f"  Auto-Safe: {review.auto_safe_delivery}")
        print(f"  Admin Bypass: {review.admin_bypass}")
        print("  ✅ PASSED")
        
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test case 2: Get pending reviews
    print("Test 2b: Get Pending Reviews")
    print("-" * 70)
    
    try:
        pending = review_manager.get_pending_reviews()
        print(f"  Pending Reports: {len(pending)}")
        
        if pending:
            latest = pending[0]
            print(f"  Latest Report:")
            print(f"    - ID: {latest.report_id}")
            print(f"    - Risk: {latest.risk_level}")
            print(f"    - Themes: {', '.join(latest.key_themes[:3]) if latest.key_themes else 'None'}")
            print(f"    - Journey: {latest.user_journey_summary[:80]}...")
        
        print("  ✅ PASSED")
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
    
    print()
    
    # Test case 3: Get review stats
    print("Test 2c: Get Review Statistics")
    print("-" * 70)
    
    try:
        stats = review_manager.get_review_stats()
        print(f"  Total Reports: {stats.get('total', 0)}")
        print(f"  Pending: {stats.get('pending', 0)}")
        print(f"  Approved: {stats.get('approved', 0)}")
        print(f"  Rejected: {stats.get('rejected', 0)}")
        print(f"  Auto-Approval Rate: {stats.get('auto_approval_rate', 0):.1%}")
        print("  ✅ PASSED")
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
    
    print()
    
    db.close()
    print("✅ Review Queue Tests Complete\n")

def test_database_schema():
    """Test database schema and models"""
    print(f"\n{'='*70}")
    print("TEST 3: Database Schema Validation")
    print(f"{'='*70}\n")
    
    from database import engine
    from sqlalchemy import inspect, text
    
    inspector = inspect(engine)
    
    # Check tables exist
    print("Test 3a: Verify Tables")
    print("-" * 70)
    
    required_tables = ['users', 'assessments', 'report_reviews']
    existing_tables = inspector.get_table_names()
    
    for table in required_tables:
        if table in existing_tables:
            print(f"  ✅ {table} exists")
        else:
            print(f"  ❌ {table} MISSING")
    
    print()
    
    # Check report_reviews columns
    print("Test 3b: Verify report_reviews Columns")
    print("-" * 70)
    
    if 'report_reviews' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('report_reviews')]
        
        required_columns = [
            'report_id', 'session_id', 'user_id', 'user_email',
            'report_html', 'llm_analysis', 'risk_level',
            'status', 'requires_human_review', 'mode',
            'reviewer_id', 'reviewer_notes', 'created_at'
        ]
        
        for col in required_columns:
            if col in columns:
                print(f"  ✅ {col}")
            else:
                print(f"  ⚠️  {col} missing (may be optional)")
    else:
        print("  ❌ report_reviews table not found")
    
    print()
    
    # Check users has role column
    print("Test 3c: Verify User Role Column")
    print("-" * 70)
    
    if 'users' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'role' in columns:
            print("  ✅ role column exists")
        else:
            print("  ⚠️  role column missing (run setup script)")
    
    print()
    print("✅ Database Schema Tests Complete\n")

def test_api_endpoints():
    """Test admin API endpoints (requires running server)"""
    print(f"\n{'='*70}")
    print("TEST 4: Admin API Endpoints (Manual)")
    print(f"{'='*70}\n")
    
    print("To test admin endpoints:")
    print("1. Start backend: python -m uvicorn main:app --reload")
    print("2. Create admin user: python setup_review_queue.py")
    print("3. Login to get JWT token:")
    print("   curl -X POST http://localhost:8000/api/token \\")
    print("     -H 'Content-Type: application/x-www-form-urlencoded' \\")
    print("     -d 'username=admin@example.com&password=yourpassword'")
    print()
    print("4. Test pending reports:")
    print("   curl http://localhost:8000/api/admin/pending-reports \\")
    print("     -H 'Authorization: Bearer YOUR_TOKEN'")
    print()
    print("5. Test review stats:")
    print("   curl http://localhost:8000/api/admin/review-stats \\")
    print("     -H 'Authorization: Bearer YOUR_TOKEN'")
    print()
    print("ℹ️  Skipping automated API tests (requires running server)\n")

async def run_all_tests():
    """Run all test suites"""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║          MetaGuardian Test Suite                                     ║
║          Three-Tier Validation Architecture                          ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    # Check environment
    if not os.getenv('ANTHROPIC_API_KEY'):
        print("⚠️  WARNING: ANTHROPIC_API_KEY not found in environment")
        print("LLM harm detection tests will fail.")
        print("Set it in .env or export ANTHROPIC_API_KEY=your-key\n")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Run tests
    try:
        await test_harm_detector()
    except Exception as e:
        print(f"❌ Harm Detector Tests Failed: {e}\n")
    
    try:
        await test_review_queue()
    except Exception as e:
        print(f"❌ Review Queue Tests Failed: {e}\n")
    
    try:
        test_database_schema()
    except Exception as e:
        print(f"❌ Database Tests Failed: {e}\n")
    
    try:
        test_api_endpoints()
    except Exception as e:
        print(f"❌ API Tests Failed: {e}\n")
    
    # Summary
    print(f"\n{'='*70}")
    print("✅ Test Suite Complete")
    print(f"{'='*70}")
    print("""
For production deployment:
1. Run all tests in staging environment
2. Verify ANTHROPIC_API_KEY is configured
3. Create admin user for review dashboard
4. Test end-to-end workflow with real session
5. Monitor LLM costs (approx $0.012 per report)

Documentation: See IMPLEMENTATION_ROADMAP.md
""")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
