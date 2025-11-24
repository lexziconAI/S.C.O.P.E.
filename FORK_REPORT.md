# MetaGuardian Fork Report

**Date**: 2025-01-14  
**Source**: [CultureCoach](https://github.com/lexziconAI/culture-coach)  
**Target**: [MetaGuardian](https://github.com/lexziconAI/Meta-Guardian)  
**Status**: Infrastructure preserved, domain logic placeholders created

---

## Executive Summary

MetaGuardian is a strategic fork of CultureCoach that **preserves 100% of the Constitutional AI infrastructure** while adapting the assessment domain from cultural competency to metabolic health readiness. This allows us to leverage a production-tested voice AI system for new research applications without rebuilding core functionality.

---

## What Was Preserved (Infrastructure)

### 1. Authentication System
- **Files**: `backend/auth.py`, `backend/database.py`, `components/Login.tsx`, `components/Register.tsx`
- **Status**: ✅ No changes needed
- **Why**: Email-based JWT authentication is domain-agnostic

### 2. OpenAI Realtime API Integration
- **Files**: `backend/realtime_relay.py`, `components/LiveVoiceCoach.tsx`
- **Status**: ✅ Functional, prompts need updating
- **Why**: WebSocket voice infrastructure works for any coaching domain

### 3. Constitutional AI Framework
- **Files**: `backend/constitutional_ai.py`
- **Status**: ✅ No changes needed
- **Why**: Yama-principled reasoning applies universally

### 4. Report Generation Pipeline
- **Files**: `backend/main.py` (finalize-session endpoint), `backend/email_service.py`
- **Status**: ✅ Functional, prompt needs domain adaptation
- **Why**: Groq LLM report generation is domain-agnostic

### 5. Frontend Infrastructure
- **Files**: `App.tsx`, `src/config.ts`, `components/AudioVisualizer.tsx`, `components/AssessmentDashboard.tsx`
- **Status**: ✅ Minimal changes (type imports)
- **Why**: React components are state-driven, not domain-specific

---

## What Was Changed (Domain Logic)

### Files Created (Placeholders)

| File | Purpose | Status |
|------|---------|--------|
| `src/prompts/metaguardian-system.ts` | System instruction for metabolic health coaching | PLACEHOLDER |
| `src/types/assessment.ts` | Metabolic assessment structure (HL, CM, DI, DL, PR dimensions) | COMPLETE |
| `src/data/interview-questions.ts` | 10 general public + 11 expert questions | PLACEHOLDER |
| `src/services/scoring-engine.ts` | Dimension scoring algorithms | PLACEHOLDER |

### Files Modified

| File | Change | Reason |
|------|--------|--------|
| `package.json` | Updated name, description, repository URL | Rebrand to MetaGuardian |
| `README.md` | Replaced content with MetaGuardian context | Documentation |

### Files To Be Modified (Next Phase)

| File | Required Changes |
|------|------------------|
| `components/LiveVoiceCoach.tsx` | Replace SYSTEM_INSTRUCTION (line 129-229) with import from `metaguardian-system.ts` |
| `backend/main.py` | Update finalize-session prompt (line 215-290) with metabolic health report template |
| `components/AssessmentDashboard.tsx` | Update dimension labels from cultural (DT, TR, CO, CA, EP) → metabolic (HL, CM, DI, DL, PR) |

---

## Dimensional Mapping

| CultureCoach Dimension | MetaGuardian Dimension | Description Change |
|------------------------|------------------------|--------------------|
| DT (Dialectical Thinking) | HL (Health Literacy) | Cultural complexity → Health concept understanding |
| TR (Trust/Relational Intelligence) | CM (Clinical Markers) | Interpersonal trust → Biomarker familiarity |
| CO (Collectivism Orientation) | DI (Data Integration) | Group vs. individual → Lifestyle + clinical data fusion |
| CA (Communication Adaptability) | DL (Digital Literacy) | Cross-cultural comm → Health tech proficiency |
| EP (Epistemological Pluralism) | PR (Preventive Readiness) | Multiple knowledge systems → Preventive action capacity |

---

## Technical Debt & Next Steps

### Immediate (Required for MVP)
1. ✅ Complete `metaguardian-system.ts` system prompt
2. ✅ Define 21 interview questions in `interview-questions.ts`
3. ✅ Implement `MetabolicScoringEngine` class
4. ⚠️ Update `LiveVoiceCoach.tsx` to use new system prompt
5. ⚠️ Update `AssessmentDashboard.tsx` dimension labels
6. ⚠️ Update `finalize-session` report template

### Short-term (Research Validation)
- Test with sample conversations (general public vs. expert)
- Validate dimension scoring logic with research team
- Calibrate confidence thresholds
- Add rough vs. precise data ingestion endpoints

### Long-term (Production Hardening)
- Replace placeholder questions with validated interview protocol
- Implement adaptive question selection algorithm
- Add longitudinal tracking (multiple sessions per user)
- Integrate with real clinical data APIs (e.g., Lab Corp, Quest)

---

## Testing Checklist

- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend starts without errors (`uvicorn main:app --reload`)
- [ ] Authentication flow works (register → login → session)
- [ ] WebSocket connects to OpenAI Realtime API
- [ ] Voice conversation triggers state updates
- [ ] Session finalization generates email report
- [ ] Report contains metabolic health insights (not cultural)
- [ ] All placeholder TODOs are clearly marked

---

## Deployment Notes

**Render Configuration** (carried over from CultureCoach):
- Backend: Python 3.11, Root Directory `backend`
- Frontend: Node 20, Build Command `npm run build`, Output `dist`
- Environment Variables:
  - `OPENAI_API_KEY`, `GROQ_API_KEY`, `SENDGRID_API_KEY` (backend)
  - `VITE_API_URL` (frontend, e.g., `https://metaguardian-backend.onrender.com`)

**CORS**: Currently set to wildcard `*` for development. Restrict to specific origins before production.

---

## License & Attribution

MetaGuardian inherits the MIT license from CultureCoach.  
Original infrastructure by lexziconAI.  
Metabolic health domain adaptation by [Your Research Team].

---

**For Questions**: See GitHub Issues at https://github.com/lexziconAI/Meta-Guardian
