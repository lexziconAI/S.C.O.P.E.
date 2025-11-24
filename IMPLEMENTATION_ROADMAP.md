# MetaGuardian Implementation Roadmap: Three-Tier Validation Architecture

## ✅ COMPLETED (Just Now)

### Core Infrastructure
1. **`backend/harm_detection.py`** - LLM harm detection using Claude Sonnet 4
   - Multi-dimensional Constitutional AI analysis
   - 6 harm categories (Medical, Psychological, Truthfulness, Autonomy, Scope, Bias)
   - 4-tier severity scoring (CRITICAL, HIGH, MEDIUM, LOW)
   - Auto-safe delivery logic

2. **`backend/review_queue.py`** - Human review workflow management
   - `ReportReview` database model
   - `ReviewQueueManager` class with full lifecycle
   - De-identified context generation (no PII to reviewers)
   - Admin bypass logic
   - Review statistics tracking

## ✅ BACKEND COMPLETE (Just Finished)

### Backend Integration
3. **`backend/main.py`** - Review queue integrated into finalize-session
   - ✅ Review queue imports added
   - ✅ Harm detection integrated into `/api/finalize-session`
   - ✅ Admin endpoints added:
     - `GET /api/admin/pending-reports` - List reports needing review
     - `POST /api/admin/review-report/{report_id}` - Submit reviewer decision
     - `GET /api/admin/review-stats` - Queue metrics
     - `GET /api/admin/report-details/{report_id}` - Full report details
   - ✅ `require_admin` dependency for auth
   - ✅ Email delivery only after approval
   - ✅ Returns different responses based on review status

4. **`backend/models.py`** - User model updated
   - ✅ Added `role` field to User model ('user' | 'admin')
   - ✅ Migration script in `setup_review_queue.py`

5. **`backend/setup_review_queue.py`** - Installation wizard
   - ✅ Installs dependencies: `pip install anthropic beautifulsoup4 lxml`
   - ✅ Initializes database tables
   - ✅ Creates admin user
   - ✅ Verifies .env configuration
   - ✅ Tests harm detector

6. **`backend/test_review_system.py`** - Test suite
   - ✅ Tests LLM harm detection (3 scenarios: SAFE, CAUTION, DANGEROUS)
   - ✅ Tests review queue workflow
   - ✅ Tests database schema
   - ✅ Provides API endpoint test commands

## 🚧 NEXT: Frontend & Testing (3-4 hours)

### Frontend Components (3-4 hours)
6. **`components/ReviewDashboard.tsx`** - Human reviewer interface
   - [ ] Report queue list view
   - [ ] Risk summary panel
   - [ ] Flagged sections highlighting
   - [ ] Constitutional violations display
   - [ ] Decision buttons (Approve/Reject/Revise)
   - [ ] Reviewer notes textarea

7. **`components/ReviewerLogin.tsx`** - Separate admin login
   - [ ] Protected route `/admin/review`
   - [ ] Role-based access control

8. **Update `components/LiveVoiceCoach.tsx`**
   - [ ] Handle "pending_review" status from finalize endpoint
   - [ ] Show user message: "Report will be emailed within 24 hours"
   - [ ] Add estimated delivery time

### Email Notifications (1 hour)
9. **Reviewer Notifications**
   - [ ] Template: "New report requires review"
   - [ ] Include risk level, session summary, review link
   - [ ] Send to `REVIEWER_EMAIL` from .env

10. **User Status Updates**
    - [ ] "Report pending review" email
    - [ ] "Report approved" email (with full report attached)
    - [ ] "Report requires revision" email (generic message, no details)

### Configuration & Security (1 hour)
11. **Environment Variables**
    ```bash
    # Add to backend/.env
    ANTHROPIC_API_KEY=sk-ant-...
    REVIEWER_EMAIL=regan@axiomintelligence.co.nz
    ADMIN_REVIEW_ENABLED=true
    AUTO_SAFE_DELIVERY_ENABLED=true
    ```

12. **Database Migration**
    ```bash
    # Initialize review tables
    cd backend
    python -c "from review_queue import init_review_tables; init_review_tables()"
    ```

### Testing & Validation (2 hours)
13. **End-to-End Testing**
    - [ ] Generate report → triggers harm detection
    - [ ] Safe report → auto-delivered
    - [ ] Flagged report → queues for review
    - [ ] Admin review → approve → email sent
    - [ ] Admin review → reject → user notified

14. **Security Audit**
    - [ ] Verify no PII in reviewer view
    - [ ] Test admin auth bypass
    - [ ] Validate rate limiting
    - [ ] Check SQL injection prevention

## 📋 IMPLEMENTATION CHECKLIST

### Today (P0 - Critical Path)
- [x] Create `harm_detection.py`
- [x] Create `review_queue.py`
- [ ] Update `main.py` with review integration
- [ ] Add admin API endpoints
- [ ] Install Anthropic SDK
- [ ] Initialize review tables
- [ ] Test harm detector with sample report

### This Week (P1 - Production Ready)
- [ ] Build ReviewDashboard component
- [ ] Add email notification templates
- [ ] User role management
- [ ] End-to-end testing
- [ ] Deploy to staging environment

### Before External Pilot (P2)
- [ ] Reviewer onboarding documentation
- [ ] Inter-rater reliability testing
- [ ] Performance monitoring dashboard
- [ ] Automated metrics tracking

## 🎯 SUCCESS METRICS

| Metric | Target | How to Measure |
|--------|--------|----------------|
| % Auto-Approved | 60-70% | `auto_approved / total_approved` |
| Median Review Time | <15 min | `median(reviewed_at - created_at)` |
| % Rejected | <5% | `rejected / total` |
| False Negative Rate | <1% | Manual audit of approved reports |

## 🔧 QUICK START COMMANDS

```bash
# 1. Install dependencies
cd backend
pip install anthropic beautifulsoup4 lxml

# 2. Add API key to .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
echo "REVIEWER_EMAIL=regan@axiomintelligence.co.nz" >> .env

# 3. Initialize database tables
python -c "from review_queue import init_review_tables; init_review_tables()"

# 4. Test harm detector
python harm_detection.py

# 5. Restart backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 📚 DOCUMENTATION LINKS

- RED_TEAM_ANALYSIS.md - Security vulnerabilities identified
- TECHNICAL_ARCHITECTURE.md - System design overview
- QUANTUM_STORYTELLING.md - Narrative framework

## ⚠️ CRITICAL NOTES

1. **Anthropic API Costs**: Claude Sonnet 4 is ~$3 per 1M tokens
   - Each report analysis: ~4K tokens = $0.012
   - Budget: ~$1 per 100 reports reviewed

2. **Review Queue Scaling**: 
   - Current: Single reviewer (Regan)
   - Production: Need 3+ reviewers for 24/7 coverage
   - Consider timezone distribution

3. **False Positive Management**:
   - Start with conservative thresholds
   - Adjust based on reviewer feedback
   - Track disagreement rates

4. **HIPAA Compliance**:
   - Reviewer NEVER sees email/name
   - Session ID only (anonymous)
   - De-identified conversation content
   - Audit trail for all reviews

## 🚀 DEPLOYMENT STRATEGY

### Prototype Phase (Now)
- Regan reviews ALL reports manually
- Build baseline inter-rater data
- Tune harm detection thresholds
- Collect false positive/negative rates

### Alpha Testing (1 month)
- 5-10 trusted users
- 100% human review
- Measure review time vs. report quality
- Iterate on UI/UX for reviewers

### Beta Pilot (3 months)
- 50-100 users
- 50% auto-safe delivery (low-risk reports)
- 50% human review (flagged reports)
- Add 2nd reviewer for validation

### Production (6 months)
- Third-party review service
- 70% auto-safe delivery
- 30% human review
- SLA: 24hr delivery guarantee

---

**Status**: Core infrastructure complete ✅  
**Next Action**: Update main.py with review queue integration  
**Estimated Time to MVP**: 4-6 hours of focused work  
**Ready for Testing**: After admin endpoints added
