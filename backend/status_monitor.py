"""
MetaGuardian Status Monitor
Provides real-time status updates every 30 seconds
"""
import time
import requests
import os
import sys
from datetime import datetime

def check_backend():
    """Check if backend is running"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=2)
        return response.status_code == 200
    except:
        return False

def check_database():
    """Check database tables"""
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from database import engine
        from sqlalchemy import inspect
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        has_users = 'users' in tables
        has_assessments = 'assessments' in tables
        has_reviews = 'report_reviews' in tables
        
        return {
            'connected': True,
            'users': has_users,
            'assessments': has_assessments,
            'report_reviews': has_reviews,
            'total_tables': len(tables)
        }
    except Exception as e:
        return {'connected': False, 'error': str(e)}

def check_dependencies():
    """Check if critical dependencies are installed"""
    deps = {}
    try:
        import anthropic
        deps['anthropic'] = '✅'
    except:
        deps['anthropic'] = '❌ MISSING'
    
    try:
        import bs4
        deps['beautifulsoup4'] = '✅'
    except:
        deps['beautifulsoup4'] = '❌ MISSING'
    
    try:
        from review_queue import ReviewQueueManager
        deps['review_queue'] = '✅'
    except Exception as e:
        deps['review_queue'] = f'❌ {str(e)[:40]}'
    
    try:
        from harm_detection import LLMHarmDetector
        deps['harm_detection'] = '✅'
    except Exception as e:
        deps['harm_detection'] = f'❌ {str(e)[:40]}'
    
    return deps

def print_status(iteration):
    """Print status update"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    
    print(f"\n{'='*70}")
    print(f"🕐 STATUS UPDATE #{iteration} - {timestamp}")
    print(f"{'='*70}")
    
    # Backend status
    backend_up = check_backend()
    status_icon = "🟢" if backend_up else "🔴"
    print(f"{status_icon} Backend (port 8000): {'RUNNING' if backend_up else 'DOWN'}")
    
    # Database status
    db_status = check_database()
    if db_status.get('connected'):
        print(f"🟢 Database: CONNECTED ({db_status.get('total_tables', 0)} tables)")
        print(f"   - Users table: {'✅' if db_status.get('users') else '❌'}")
        print(f"   - Assessments table: {'✅' if db_status.get('assessments') else '❌'}")
        print(f"   - Report reviews table: {'✅' if db_status.get('report_reviews') else '❌'}")
    else:
        print(f"🔴 Database: ERROR - {db_status.get('error', 'Unknown')[:50]}")
    
    # Dependencies
    print(f"\n📦 Critical Dependencies:")
    deps = check_dependencies()
    for name, status in deps.items():
        print(f"   {name}: {status}")
    
    # Environment
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    has_env = os.path.exists(env_path)
    print(f"\n🔧 Environment:")
    print(f"   .env file: {'✅' if has_env else '❌'}")
    
    if has_env:
        with open(env_path, 'r') as f:
            content = f.read()
            has_anthropic = 'ANTHROPIC_API_KEY' in content and 'sk-ant-' in content
            has_groq = 'GROQ_API_KEY' in content
            print(f"   ANTHROPIC_API_KEY: {'✅' if has_anthropic else '❌ NOT CONFIGURED'}")
            print(f"   GROQ_API_KEY: {'✅' if has_groq else '❌'}")
    
    # Next check
    print(f"\n⏱️  Next update in 30 seconds...")

def main():
    """Run monitoring loop"""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║          MetaGuardian Status Monitor                                 ║
║          Real-time updates every 30 seconds                          ║
║                                                                      ║
║          Press Ctrl+C to stop monitoring                             ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    iteration = 1
    try:
        while True:
            print_status(iteration)
            time.sleep(30)
            iteration += 1
    except KeyboardInterrupt:
        print(f"\n\n{'='*70}")
        print("🛑 Monitoring stopped by user")
        print(f"{'='*70}\n")

if __name__ == "__main__":
    main()
