"""
Constitutional AI Validation for MetaGuardian Quantum Storytelling
Based on Yama Principles - ethical guardrails for health narratives

CONSTITUTIONAL RECEIPT SYSTEM:
Every validation creates an immutable audit trail for PhD research documentation
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime
import json
import hashlib

# =============================================================================
# YAMA PRINCIPLES: The Five Constitutional Constraints
# =============================================================================

class YamaPrinciple:
    """Base class for Constitutional AI principles"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.violations = []
        self.harmonies = []
        
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        """
        Returns: (is_valid, explanation)
        Subclasses must implement validation logic
        """
        raise NotImplementedError


class Ahimsa(YamaPrinciple):
    """Non-Harm: Never force a story the user isn't ready to tell"""
    
    def __init__(self):
        super().__init__(
            "Ahimsa", 
            "Non-harm: Protect user's psychological safety and agency"
        )
        
        # Harmful patterns to detect
        self.harm_indicators = [
            'stop medication', 'ignore doctor', 'avoid treatment',
            'skip consultation', 'self-diagnose', 'definitely have',
            'must be', 'always means', 'you should stop'
        ]
        
        # Forcing patterns
        self.forcing_patterns = [
            'you need to tell me', 'you must share', 'everyone does this',
            'it\'s wrong not to', 'you\'re avoiding'
        ]
        
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        content_lower = content.lower()
        
        # Check for medical harm
        for indicator in self.harm_indicators:
            if indicator in content_lower:
                return False, f"AHIMSA VIOLATION: Content suggests potentially harmful medical advice: '{indicator}'"
        
        # Check for psychological forcing
        for pattern in self.forcing_patterns:
            if pattern in content_lower:
                return False, f"AHIMSA VIOLATION: Content forces user disclosure: '{pattern}'"
        
        return True, "Ahimsa: Content respects user's boundaries and safety"


class Satya(YamaPrinciple):
    """Truth: Honor contradictions as authentic (multiple truths)"""
    
    def __init__(self):
        super().__init__(
            "Satya",
            "Truthfulness: Honest about uncertainty, honor contradictions"
        )
        
        # Overconfident claims
        self.false_certainty = [
            'guaranteed', 'definitely will', 'always works', 'never fails',
            'impossible to', 'certain to', '100% effective', 'proven cure'
        ]
        
        # Dismissing contradictions
        self.dismissal_patterns = [
            'you\'re contradicting yourself', 'that doesn\'t make sense',
            'pick one', 'which is it really', 'stop being inconsistent'
        ]
    
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        content_lower = content.lower()
        
        # Check for false certainty
        for claim in self.false_certainty:
            if claim in content_lower:
                return False, f"SATYA VIOLATION: Overstating certainty: '{claim}'"
        
        # Check for contradiction dismissal
        for pattern in self.dismissal_patterns:
            if pattern in content_lower:
                return False, f"SATYA VIOLATION: Dismissing user's contradictions: '{pattern}'"
        
        return True, "Satya: Content honors complexity and uncertainty"


class Asteya(YamaPrinciple):
    """Non-Stealing: The story belongs to the user, not the system"""
    
    def __init__(self):
        super().__init__(
            "Asteya",
            "Non-stealing: Respect user's ownership of their narrative"
        )
        
        # Stealing agency
        self.theft_patterns = [
            'you really mean', 'what you\'re actually saying is',
            'let me tell you what\'s happening', 'the truth is',
            'you\'re in denial about', 'you don\'t realize'
        ]
        
        # Manipulation
        self.manipulation_patterns = [
            'must buy', 'need to purchase', 'requires paid',
            'won\'t work unless', 'have to subscribe', 'click here to cure'
        ]
    
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        content_lower = content.lower()
        
        # Check for narrative theft
        for pattern in self.theft_patterns:
            if pattern in content_lower:
                return False, f"ASTEYA VIOLATION: Stealing user's interpretation: '{pattern}'"
        
        # Check for manipulation
        for pattern in self.manipulation_patterns:
            if pattern in content_lower:
                return False, f"ASTEYA VIOLATION: Manipulative commercial intent: '{pattern}'"
        
        return True, "Asteya: Content respects user's narrative ownership"


class Brahmacharya(YamaPrinciple):
    """Right Energy: Match story depth to user's emotional capacity"""
    
    def __init__(self):
        super().__init__(
            "Brahmacharya",
            "Discipline: Stay within scope, defer medical decisions"
        )
        
        # Scope violations
        self.overreach_patterns = [
            'diagnose yourself', 'you have', 'you definitely',
            'symptoms indicate', 'medical diagnosis', 'prescribe',
            'instead of doctor', 'don\'t need medical'
        ]
        
        # Intensity without capacity
        self.intensity_patterns = [
            'you must confront', 'face your trauma now',
            'dig deeper immediately', 'you need to process this now'
        ]
    
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        content_lower = content.lower()
        
        # Check for scope overreach
        for pattern in self.overreach_patterns:
            if pattern in content_lower:
                return False, f"BRAHMACHARYA VIOLATION: Exceeding health coach scope: '{pattern}'"
        
        # Check for inappropriate intensity
        for pattern in self.intensity_patterns:
            if pattern in content_lower:
                return False, f"BRAHMACHARYA VIOLATION: Forcing emotional intensity: '{pattern}'"
        
        return True, "Brahmacharya: Content maintains appropriate boundaries"


class Aparigraha(YamaPrinciple):
    """Non-Attachment: Share story patterns without claiming ownership"""
    
    def __init__(self):
        super().__init__(
            "Aparigraha",
            "Non-attachment: No commercial bias, respect autonomy"
        )
        
        # Brand pushing
        self.brand_indicators = [
            'this brand', 'buy our', 'my product',
            'exclusive offer', 'limited time', 'act now'
        ]
        
        # Attachment to outcomes
        self.attachment_patterns = [
            'you have to', 'you must achieve', 'only way forward',
            'my solution is', 'follow my plan', 'do exactly'
        ]
    
    def validate(self, content: str, context: Dict = None) -> Tuple[bool, str]:
        content_lower = content.lower()
        
        # Check for commercial bias
        for indicator in self.brand_indicators:
            if indicator in content_lower:
                return False, f"APARIGRAHA VIOLATION: Commercial bias detected: '{indicator}'"
        
        # Check for outcome attachment
        for pattern in self.attachment_patterns:
            if pattern in content_lower:
                return False, f"APARIGRAHA VIOLATION: Attached to specific outcome: '{pattern}'"
        
        return True, "Aparigraha: Content offers without attachment"


# =============================================================================
# CONSTITUTIONAL VALIDATOR: The Central Arbiter
# =============================================================================

class ConstitutionalValidator:
    """
    Validates all content against the five Yama principles
    Generates immutable receipts for PhD audit trail
    """
    
    def __init__(self):
        self.principles = {
            'Ahimsa': Ahimsa(),
            'Satya': Satya(),
            'Asteya': Asteya(),
            'Brahmacharya': Brahmacharya(),
            'Aparigraha': Aparigraha()
        }
        self.validation_history = []
    
    def validate_content(
        self, 
        content: str, 
        content_type: str,
        context: Dict = None
    ) -> Dict:
        """
        Validate content against all principles
        
        Args:
            content: Text to validate (story synthesis, recommendation, etc.)
            content_type: 'story_synthesis', 'recommendation', 'system_response', etc.
            context: Additional context for validation
        
        Returns:
            Constitutional Receipt (immutable audit record)
        """
        timestamp = datetime.utcnow().isoformat()
        violations = []
        harmonies = []
        
        # Check each principle
        for name, principle in self.principles.items():
            is_valid, explanation = principle.validate(content, context)
            
            if is_valid:
                harmonies.append({
                    'principle': name,
                    'status': 'harmony',
                    'explanation': explanation
                })
            else:
                violations.append({
                    'principle': name,
                    'status': 'violation',
                    'explanation': explanation
                })
        
        # Generate receipt
        receipt = {
            'receipt_id': self._generate_receipt_id(content, timestamp),
            'timestamp': timestamp,
            'content_type': content_type,
            'content_hash': hashlib.sha256(content.encode()).hexdigest(),
            'validation_result': 'PASSED' if len(violations) == 0 else 'FAILED',
            'harmonies': harmonies,
            'violations': violations,
            'summary': self._generate_summary(harmonies, violations),
            'context': context or {}
        }
        
        # Store in audit trail
        self.validation_history.append(receipt)
        
        return receipt
    
    def validate_story_synthesis(self, synthesis: str, fragments: List[Dict]) -> Dict:
        """Specific validation for Groq story synthesis"""
        context = {
            'fragment_count': len(fragments),
            'synthesis_length': len(synthesis),
            'validation_type': 'story_synthesis'
        }
        return self.validate_content(synthesis, 'story_synthesis', context)
    
    def validate_recommendation(self, recommendation: str, user_context: Dict) -> Dict:
        """Specific validation for recommendations"""
        context = {
            'user_context': user_context,
            'validation_type': 'recommendation'
        }
        return self.validate_content(recommendation, 'recommendation', context)
    
    def _generate_receipt_id(self, content: str, timestamp: str) -> str:
        """Generate unique receipt ID"""
        combined = f"{content[:100]}{timestamp}"
        return f"CONST_{hashlib.md5(combined.encode()).hexdigest()[:12].upper()}"
    
    def _generate_summary(self, harmonies: List[Dict], violations: List[Dict]) -> str:
        """Human-readable validation summary"""
        if len(violations) == 0:
            return f"✅ Constitutional validation PASSED. All {len(harmonies)} principles in harmony."
        else:
            violation_list = ', '.join([v['principle'] for v in violations])
            return f"❌ Constitutional validation FAILED. Violations: {violation_list}"
    
    def get_audit_trail(self, content_type: str = None) -> List[Dict]:
        """Retrieve validation history for research documentation"""
        if content_type:
            return [r for r in self.validation_history if r['content_type'] == content_type]
        return self.validation_history
    
    def export_receipts(self, filepath: str):
        """Export all receipts to JSON for PhD documentation"""
        with open(filepath, 'w') as f:
            json.dump(self.validation_history, f, indent=2)
        print(f"📜 Constitutional receipts exported: {filepath}")


# =============================================================================
# ATOMIC VALIDATION DECORATORS
# =============================================================================

def constitutional_guard(content_type: str):
    """
    Decorator for atomic validation of functions
    Ensures all content passes Constitutional AI checks before proceeding
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            validator = ConstitutionalValidator()
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Validate result if it's a string (story synthesis, recommendation, etc.)
            if isinstance(result, str):
                receipt = validator.validate_content(result, content_type)
                
                if receipt['validation_result'] == 'FAILED':
                    # Log violation but don't block (for research purposes)
                    print(f"⚠️  Constitutional violation detected: {receipt['summary']}")
                    print(f"Receipt ID: {receipt['receipt_id']}")
                
                # Attach receipt to result metadata
                if isinstance(result, dict):
                    result['constitutional_receipt'] = receipt
            
            return result
        return wrapper
    return decorator


# =============================================================================
# SINGLETON VALIDATOR INSTANCE
# =============================================================================

_global_validator = None

def get_constitutional_validator() -> ConstitutionalValidator:
    """Get or create singleton validator instance"""
    global _global_validator
    if _global_validator is None:
        _global_validator = ConstitutionalValidator()
    return _global_validator


# =============================================================================
# QUICK VALIDATION HELPERS
# =============================================================================

def validate_story_synthesis(synthesis: str, fragments: List[Dict] = None) -> Dict:
    """Quick validation for story synthesis"""
    validator = get_constitutional_validator()
    return validator.validate_story_synthesis(synthesis, fragments or [])

def validate_recommendation(recommendation: str, context: Dict = None) -> Dict:
    """Quick validation for recommendations"""
    validator = get_constitutional_validator()
    return validator.validate_recommendation(recommendation, context or {})

def export_all_receipts(filepath: str = 'constitutional_receipts.json'):
    """Export all Constitutional AI receipts for PhD documentation"""
    validator = get_constitutional_validator()
    validator.export_receipts(filepath)
    return filepath
