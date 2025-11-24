from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./metaguardian_quantum.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# =============================================================================
# QUANTUM STORYTELLING SCHEMA
# =============================================================================

class NarrativeStream(Base):
    __tablename__ = "narrative_streams"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("quantum_sessions.id"), nullable=False)
    stream_id = Column(String, nullable=False)  # BODY_KNOWLEDGE, BIOMARKER_MYTHOLOGY, etc.
    stream_name = Column(String, nullable=False)
    
    # Story qualities
    coherence = Column(Float, default=0.0)  # 0-1: Fragment connectivity
    fluidity = Column(Float, default=1.0)   # 0-1: Openness to becoming
    authenticity = Column(Float, default=0.0)  # 0-1: Lived truth alignment
    
    dominant_theme = Column(Text, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    fragments = relationship("AntenarativeFragment", back_populates="narrative_stream")
    quantum_states = relationship("QuantumState", back_populates="narrative_stream")


class AntenarativeFragment(Base):
    __tablename__ = "antenarrative_fragments"
    
    id = Column(Integer, primary_key=True, index=True)
    fragment_id = Column(String, unique=True, index=True)  # ante_123456789
    session_id = Column(String, ForeignKey("quantum_sessions.id"), nullable=False)
    stream_id = Column(Integer, ForeignKey("narrative_streams.id"), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    turn = Column(Integer)  # Which conversation turn
    
    # The fragment itself
    text = Column(Text, nullable=False)  # User's actual words
    interpreted_meaning = Column(Text)   # AI's reading
    
    # Fragment type
    fragment_type = Column(String)  # memory, speculation, contradiction, desire, fear, bet, turning_point
    
    # Story elements (JSON)
    characters = Column(JSON)  # ["self", "doctor", "my body"]
    tensions = Column(JSON)    # ["empowerment_vs_anxiety"]
    possible_endings = Column(JSON)  # ["Continue tracking", "Reduce dependence"]
    
    # Quantum properties (JSON)
    entangled_with = Column(JSON)  # ["fragment_id_2", "fragment_id_3"]
    superposition_states = Column(JSON)  # ["meaning_1", "meaning_2"]
    
    # Emotional qualities
    emotional_tone = Column(String)  # hopeful, anxious, curious, resistant, empowered, defeated, neutral
    energy_level = Column(String)    # high, medium, low
    
    # Relationships
    narrative_stream = relationship("NarrativeStream", back_populates="fragments")
    yama_resonances = relationship("YamaResonance", back_populates="fragment")


class QuantumState(Base):
    __tablename__ = "quantum_states"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("quantum_sessions.id"), nullable=False)
    stream_id = Column(Integer, ForeignKey("narrative_streams.id"), nullable=True)
    
    state = Column(String, nullable=False)  # "Empowered Tracker", "Anxious Monitor"
    probability = Column(Float, nullable=False)  # 0-1
    
    evidence_threads = Column(JSON)  # ["fragment_id_1", "fragment_id_2"]
    first_appeared = Column(DateTime, default=datetime.utcnow)
    evolution = Column(JSON)  # [{"turn": 4, "probability": 0.6}, {"turn": 7, "probability": 0.8}]
    
    conflicts_with = Column(JSON)  # ["state_id_2"]
    reinforces = Column(JSON)      # ["state_id_3"]
    
    # Relationships
    narrative_stream = relationship("NarrativeStream", back_populates="quantum_states")
    
    # Constraint: probabilities should sum to 1.0 per stream (checked in application logic)
    __table_args__ = (
        CheckConstraint('probability >= 0.0 AND probability <= 1.0', name='probability_range'),
    )


class TemporalLayer(Base):
    __tablename__ = "temporal_layers"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("quantum_sessions.id"), nullable=False)
    
    layer_type = Column(String, nullable=False)  # past_memory, present_moment, future_speculation, collapsed_now
    content = Column(Text, nullable=False)
    related_streams = Column(JSON)  # ["BODY_KNOWLEDGE", "BIOMARKER_MYTHOLOGY"]
    entanglement_strength = Column(Float, default=0.0)  # 0-1
    
    timestamp = Column(DateTime, default=datetime.utcnow)


class GrandNarrative(Base):
    __tablename__ = "grand_narratives"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("quantum_sessions.id"), nullable=False)
    
    discourse = Column(String, nullable=False)  # "Medical authority", "Quantified self"
    category = Column(String)  # medical_establishment, wellness_industry, family_legacy, etc.
    
    influence = Column(String)  # dominant, contested, emerging, fading
    user_stance = Column(String)  # accepting, resisting, negotiating, transforming
    
    manifests_in = Column(JSON)  # ["fragment_id_1", "fragment_id_5"]
    
    empowering = Column(Integer, default=0)  # Boolean stored as int
    constraining = Column(Integer, default=0)
    
    timestamp = Column(DateTime, default=datetime.utcnow)


class YamaResonance(Base):
    __tablename__ = "yama_resonances"
    
    id = Column(Integer, primary_key=True, index=True)
    fragment_id = Column(Integer, ForeignKey("antenarrative_fragments.id"), nullable=False)
    
    principle = Column(String, nullable=False)  # Ahimsa, Satya, Asteya, Brahmacharya, Aparigraha
    resonance = Column(String, nullable=False)  # harmony, tension, exploration
    insight = Column(Text)  # What this principle reveals
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    fragment = relationship("AntenarativeFragment", back_populates="yama_resonances")


class QuantumSession(Base):
    __tablename__ = "quantum_sessions"
    
    id = Column(String, primary_key=True, index=True)  # session_123456
    user_id = Column(Integer, nullable=False)
    user_email = Column(String)
    
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    
    phase = Column(String, default="INVOCATION")  # INVOCATION, EMERGENCE, ENTANGLEMENT, CRYSTALLIZATION, OPENING
    turn_count = Column(Integer, default=0)
    
    # Overall narrative qualities
    overall_coherence = Column(Float, default=0.0)
    narrative_complexity = Column(Float, default=0.0)
    story_vitality = Column(Float, default=1.0)
    
    # Constitutional health (JSON)
    yama_balance = Column(JSON)  # [{"principle": "Ahimsa", "harmony": 2, "tension": 1, "exploration": 0}, ...]
    
    # Story synthesis (generated at end)
    synthesis_summary = Column(Text, nullable=True)
    simultaneous_truths = Column(JSON, nullable=True)  # ["truth_1", "truth_2"]
    possible_futures = Column(JSON, nullable=True)  # [{"pathName": "...", "description": "..."}, ...]
    
    is_complete = Column(Integer, default=0)
    constitutional_receipt_id = Column(String, nullable=True)  # Links to validation receipt
    
    # Relationships
    narrative_streams = relationship("NarrativeStream", cascade="all, delete-orphan")
    fragments = relationship("AntenarativeFragment", cascade="all, delete-orphan")
    quantum_states = relationship("QuantumState", cascade="all, delete-orphan")
    temporal_layers = relationship("TemporalLayer", cascade="all, delete-orphan")
    grand_narratives = relationship("GrandNarrative", cascade="all, delete-orphan")


# Create all tables
def init_quantum_db():
    """Initialize quantum storytelling database schema"""
    Base.metadata.create_all(bind=engine)
    print("✅ Quantum storytelling database initialized")


# Migration helper
def migrate_legacy_sessions():
    """
    Migrate old assessment-based sessions to quantum storytelling format
    Note: This is lossy - old dimension scores won't map perfectly to narrative streams
    """
    # TODO: Implement if needed for production migration
    pass
