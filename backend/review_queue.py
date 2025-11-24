"""
Report Review Queue Management
Handles workflow for human review of AI-generated health reports
"""

from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum
import secrets
import json

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Session, relationship
from fastapi import HTTPException

from database import Base
from harm_detection import LLMHarmDetector, JourneyMode


class ReviewStatus(Enum):
    """Report review lifecycle states"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


class ReportReview(Base):
    """Database model for report review workflow"""
    __tablename__ = "report_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    
    # Report content
    report_html = Column(Text, nullable=False)
    groq_synthesis_metadata = Column(JSON)
    
    # Harm detection results
    llm_analysis = Column(JSON)  # Full LLMHarmDetector output
    risk_level = Column(String)  # SAFE, CAUTION, DANGEROUS
    flagged_sections_count = Column(Integer, default=0)
    
    # De-identified context for reviewer (NO PII)
    user_journey_summary = Column(Text)
    key_themes = Column(JSON)
    mode = Column(String)  # preventive, medical
    
    # Review workflow
    status = Column(String, default=ReviewStatus.PENDING.value)
    requires_human_review = Column(Boolean, default=True)
    auto_safe_delivery = Column(Boolean, default=False)
    
    # Admin override
    admin_bypass = Column(Boolean, default=False)
    
    # Human reviewer tracking
    reviewer_id = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    reviewer_decision = Column(String, nullable=True)  # approve, reject, revise
    
    # Delivery tracking
    delivered_at = Column(DateTime, nullable=True)
    delivery_method = Column(String, nullable=True)  # email, dashboard
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewQueueManager:
    """Manages report review workflow"""
    
    def __init__(self, db: Session):
        self.db = db
        self.harm_detector = LLMHarmDetector()
    
    async def submit_report_for_review(
        self,
        session_id: str,
        user_id: int,
        user_email: str,
        user_role: str,
        report_html: str,
        groq_metadata: Dict,
        mode: JourneyMode,
        fragments: List[Dict],
        session_data: Dict
    ) -> ReportReview:
        """
        Submit generated report to review queue.
        
        Workflow:
        1. Run LLM harm detection
        2. Check if user is admin (bypass review)
        3. Check if auto-safe (low risk + no flags)
        4. Otherwise → human review queue
        """
        
        # Run harm detection
        harm_analysis = await self.harm_detector.scan_report(
            report_html=report_html,
            mode=mode,
            user_fragments=fragments,
            session_metadata={
                'mode': mode.value,
                'turn_count': session_data.get('turn_count', 0),
                'phase': session_data.get('phase', 'unknown')
            }
        )
        
        # Create de-identified summary for reviewer
        user_journey_summary = self._generate_journey_summary(mode, session_data)
        key_themes = self._extract_key_themes(fragments)
        
        # Determine review requirements
        is_admin = user_role == 'admin'
        auto_safe = harm_analysis.get('auto_safe_delivery', False)
        
        # Generate unique report ID
        report_id = f"RPT_{secrets.token_hex(16)}"
        
        # Create review record
        review = ReportReview(
            report_id=report_id,
            session_id=session_id,
            user_id=user_id,
            report_html=report_html,
            groq_synthesis_metadata=groq_metadata,
            llm_analysis=harm_analysis,
            risk_level=harm_analysis.get('risk_level', 'CAUTION'),
            flagged_sections_count=len(harm_analysis.get('flagged_sections', [])),
            user_journey_summary=user_journey_summary,
            key_themes=key_themes,
            mode=mode.value,
            requires_human_review=harm_analysis.get('requires_human_review', True),
            auto_safe_delivery=auto_safe,
            admin_bypass=is_admin
        )
        
        # DECISION LOGIC
        if is_admin:
            # Admin users get direct delivery
            review.status = ReviewStatus.APPROVED.value
            review.reviewer_notes = "Admin user - auto-approved"
            print(f"✓ Admin bypass: Report {report_id} approved for {user_email}")
            
        elif auto_safe and not harm_analysis.get('requires_human_review', True):
            # Safe reports with no flags
            review.status = ReviewStatus.APPROVED.value
            review.reviewer_notes = "LLM harm detector: SAFE (no human review required)"
            print(f"✓ Auto-safe: Report {report_id} approved without human review")
            
        else:
            # Queue for human review
            review.status = ReviewStatus.PENDING.value
            print(f"⚠️  Queued for review: Report {report_id} - Risk: {review.risk_level}")
            # Notification handled by calling code
        
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        
        return review
    
    def _generate_journey_summary(self, mode: JourneyMode, session_data: Dict) -> str:
        """Generate de-identified summary for reviewer (no PII)"""
        mode_desc = {
            JourneyMode.PREVENTIVE: 'exploring metabolic health prevention',
            JourneyMode.MEDICAL: 'managing diabetes with medication'
        }
        
        turn_count = session_data.get('turn_count', 0)
        phase = session_data.get('phase', 'unknown')
        
        return f"User {mode_desc.get(mode, 'health journey')} over {turn_count} conversation turns (Phase: {phase})"
    
    def _extract_key_themes(self, fragments: List[Dict]) -> List[str]:
        """Extract main themes from conversation (no identifying details)"""
        themes = set()
        theme_keywords = {
            'medication adherence': ['insulin', 'metformin', 'medication', 'dose', 'prescription', 'pill'],
            'lifestyle change': ['exercise', 'diet', 'sleep', 'stress', 'habit', 'routine'],
            'clinical monitoring': ['blood sugar', 'glucose', 'A1C', 'test', 'doctor', 'lab'],
            'technology use': ['app', 'wearable', 'tracker', 'device', 'monitor', 'phone'],
            'emotional wellbeing': ['anxious', 'worried', 'frustrated', 'overwhelmed', 'hopeful', 'scared']
        }
        
        for fragment in fragments[:20]:  # Sample first 20 fragments
            text_lower = fragment.get('text', '').lower()
            for theme, keywords in theme_keywords.items():
                if any(keyword in text_lower for keyword in keywords):
                    themes.add(theme)
                    if len(themes) >= 5:
                        break
            if len(themes) >= 5:
                break
        
        return list(themes)
    
    def get_pending_reviews(self, limit: int = 50) -> List[ReportReview]:
        """Get all reports awaiting human review"""
        return self.db.query(ReportReview)\
            .filter(ReportReview.status == ReviewStatus.PENDING.value)\
            .order_by(ReportReview.created_at.desc())\
            .limit(limit)\
            .all()
    
    def get_review_by_id(self, report_id: str) -> Optional[ReportReview]:
        """Get specific review by report ID"""
        return self.db.query(ReportReview)\
            .filter(ReportReview.report_id == report_id)\
            .first()
    
    def submit_reviewer_decision(
        self,
        report_id: str,
        reviewer_id: int,
        decision: str,
        reviewer_notes: str
    ) -> ReportReview:
        """Human reviewer submits their decision"""
        review = self.get_review_by_id(report_id)
        
        if not review:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if review.status != ReviewStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Report already reviewed")
        
        # Update review record
        review.reviewer_id = reviewer_id
        review.reviewed_at = datetime.utcnow()
        review.reviewer_notes = reviewer_notes
        review.reviewer_decision = decision
        
        if decision == 'approve':
            review.status = ReviewStatus.APPROVED.value
        elif decision == 'reject':
            review.status = ReviewStatus.REJECTED.value
        elif decision == 'revise':
            review.status = ReviewStatus.REVISION_REQUESTED.value
        else:
            raise HTTPException(status_code=400, detail="Invalid decision")
        
        self.db.commit()
        self.db.refresh(review)
        
        return review
    
    def get_review_stats(self) -> Dict:
        """Get review queue statistics"""
        total_pending = self.db.query(ReportReview)\
            .filter(ReportReview.status == ReviewStatus.PENDING.value)\
            .count()
        
        total_approved = self.db.query(ReportReview)\
            .filter(ReportReview.status == ReviewStatus.APPROVED.value)\
            .count()
        
        total_rejected = self.db.query(ReportReview)\
            .filter(ReportReview.status == ReviewStatus.REJECTED.value)\
            .count()
        
        auto_approved = self.db.query(ReportReview)\
            .filter(
                ReportReview.status == ReviewStatus.APPROVED.value,
                ReportReview.reviewer_id == None
            )\
            .count()
        
        return {
            'pending': total_pending,
            'approved': total_approved,
            'rejected': total_rejected,
            'auto_approved': auto_approved,
            'total': total_pending + total_approved + total_rejected,
            'auto_approval_rate': auto_approved / max(total_approved, 1)
        }


# Helper function to initialize review tables
def init_review_tables():
    """Initialize report review tables in database"""
    from database import engine
    Base.metadata.create_all(bind=engine)
    print("✅ Report review tables initialized")


if __name__ == '__main__':
    init_review_tables()
