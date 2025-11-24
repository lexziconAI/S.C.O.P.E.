# MetaGuardian Canonical Memory

## Purpose
This document captures canonical working implementations, lessons learned, and anti-patterns discovered during MetaGuardian development. Use this as a reference when forking to create new Constitutional AI bots (e.g., S.C.O.P.E. Coach).

---

## Architecture Overview

### Core Components (Canonical)
```
Frontend (Vite + React + TypeScript)
    ↓ WebSocket
Backend (FastAPI + Python)
    ↓ OpenAI Realtime API (voice)
    ↓ Groq Sidecar (parallel inference analysis)
```

### Key Files
- `backend/openai_relay.py` - WebSocket relay + Groq sidecar inference
- `backend/main.py` - FastAPI app, CORS, routes
- `src/config.ts` - API URL configuration
- `.env.production` - Production environment variables
- `components/LiveVoiceCoach.tsx` - Main voice interface component

---

## Working Patterns (Canonical Implementations)

### 1. Frontend-Backend URL Configuration
**Pattern**: Use environment variables with `.env.production`

```typescript
// src/config.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

```bash
# .env.production
VITE_API_URL=https://your-backend.onrender.com
```

**Anti-pattern**: Hardcoding URLs or forgetting to update `.env.production` when forking.

**Lesson**: When forking, IMMEDIATELY update `.env.production` to point to the new backend URL. This was root cause of days of debugging.

---

### 2. Dimension Validation (Sidecar Inference)
**Pattern**: Always validate and map dimension codes, ensure all required dimensions exist.

```python
# Canonical implementation
VALID_DIMS = {'HL', 'CM', 'DI', 'DL', 'PR'}
INVALID_TO_VALID = {
    'CO': 'HL',  # Map legacy codes to new
    'EP': 'PR',
    'DT': 'CM',
    'TR': 'DI',
    'CA': 'DL'
}
DIM_ORDER = ['HL', 'CM', 'DI', 'DL', 'PR']
base_scores = [2.4, 2.5, 2.6, 2.5, 2.7]  # Varied defaults

# Fix dimensions object
if 'dimensions' in scores:
    fixed_dims = {}
    for dim, data in scores['dimensions'].items():
        if dim in VALID_DIMS:
            fixed_dims[dim] = data
        elif dim in INVALID_TO_VALID:
            mapped = INVALID_TO_VALID[dim]
            fixed_dims[mapped] = data

    # Ensure all dims exist
    for i, dim in enumerate(DIM_ORDER):
        if dim not in fixed_dims:
            fixed_dims[dim] = {'score': base_scores[i], 'confidence': 'LOW', 'evidenceCount': 0, 'trend': 'stable'}

    scores['dimensions'] = fixed_dims
```

**Anti-pattern**: Assuming LLM will always return correct dimension codes.

**Lesson**: LLMs hallucinate dimension codes. Always validate, map, and fill missing dimensions.

---

### 3. Score Differentiation for Trajectory Charts
**Pattern**: Ensure scores have minimum 0.2 range for chart visibility.

```python
# Check score range
all_scores = [fixed_dims[d].get('score', 2.5) for d in DIM_ORDER]
score_range = max(all_scores) - min(all_scores)

if score_range < 0.2:
    # Apply neutral offsets (sum to 0)
    offsets = {'HL': -0.12, 'CM': 0.08, 'DI': -0.04, 'DL': 0.12, 'PR': -0.04}
    for dim in DIM_ORDER:
        old_score = fixed_dims[dim].get('score', 2.5)
        new_score = max(0, min(5, old_score + offsets[dim]))
        fixed_dims[dim]['score'] = round(new_score, 2)
```

**Anti-pattern**: Biased offsets that systematically favor certain dimensions.

**Lesson**: Offsets must sum to 0 for neutrality. Only apply when LLM fails to differentiate.

---

### 4. Error Handling in Validation
**Pattern**: Nested try-except for granular error handling.

```python
try:
    # Outer validation block
    try:
        # Dimension validation
        pass
    except Exception as e:
        logging.error(f"[Sidecar] Dimension validation error: {e}")

    try:
        # Score differentiation
        pass
    except Exception as e:
        logging.error(f"[Sidecar] Score differentiation error: {e}")

except Exception as e:
    logging.error(f"[Sidecar] General validation error: {e}")
```

**Anti-pattern**: Only catching `json.JSONDecodeError` (other exceptions fail silently).

**Lesson**: Catch ALL exceptions with specific handlers. Never let validation silently fail.

---

### 5. Speech Recognition Context Awareness
**Pattern**: Use conversational context to interpret ambiguous terms.

```python
# In sidecar prompt
"""
TERMINOLOGY & SPEECH RECOGNITION:
- "carbs" = carbohydrates (FOOD), NEVER carbon (element)
- This is a METABOLIC HEALTH app - interpret based on context:
  * Food/diet/nutrition context: "calves"/"carbon"/"carves" → probably means CARBOHYDRATES
  * Exercise/workout/muscle context: "calves" → calf muscles (legitimate)
- Use conversational context to determine correct interpretation
"""
```

**Anti-pattern**: Hardcoding all misheard words to one interpretation.

**Lesson**: Context matters. Guide LLM to infer from conversation, don't force interpretations.

---

### 6. Render Deployment Configuration
**Pattern**: Ensure API keys match between local and Render.

```bash
# Local .env
OPENAI_API_KEY=sk-proj-...

# Must also be set in Render Dashboard → Environment
```

**Anti-pattern**: Different API keys in local vs production.

**Lesson**: When key shows `...bkFJ` but local is `...ipsA`, they're different. Use MCP tool to update:
```python
mcp__render__update_environment_variables(
    serviceId="srv-xxx",
    envVars=[{"key": "OPENAI_API_KEY", "value": "sk-proj-..."}]
)
```

---

### 7. Sidecar Prompt Structure
**Pattern**: Critical warnings at top, examples, explicit format requirements.

```python
SIDECAR_PROMPT = """
⚠️⚠️⚠️ CRITICAL WARNINGS AT TOP ⚠️⚠️⚠️
- Most important constraints first
- Use emoji for visibility

---

ROLE AND TASK DESCRIPTION

---

JSON STRUCTURE WITH EXAMPLES

---

DOMAIN-SPECIFIC TERMINOLOGY

---

SCORING RULES WITH CONCRETE EXAMPLES

---

BASELINE AND RANGE REQUIREMENTS
"""
```

**Lesson**: LLMs pay most attention to beginning and end. Put critical constraints at top.

---

## Anti-Patterns to Avoid

### 1. Silent Failures
- Never let exceptions pass without logging
- Always have fallback values

### 2. Assumed Correctness
- Never trust LLM output structure
- Always validate and transform

### 3. Hardcoded URLs
- Always use environment variables
- Check `.env.production` when forking

### 4. Single Exception Type
- Don't just catch `JSONDecodeError`
- Catch specific exceptions with granular handlers

### 5. Absolute Interpretations
- Don't hardcode "calves always means carbs"
- Use context-aware interpretation

---

## Forking Checklist for S.C.O.P.E. Coach

### Immediate Actions
1. [ ] Update `.env.production` with new backend URL
2. [ ] Update Render environment variables (OPENAI_API_KEY, etc.)
3. [ ] Replace dimension codes (HL, CM, DI, DL, PR → S, C, O, P, E)
4. [ ] Update INVALID_TO_VALID mapping for legacy codes
5. [ ] Update sidecar prompt with S.C.O.P.E. terminology
6. [ ] Replace metabolic health terms with coaching terms

### Dimension Mapping for S.C.O.P.E.
```python
VALID_DIMS = {'S', 'C', 'O', 'P', 'E'}
DIM_ORDER = ['S', 'C', 'O', 'P', 'E']
# S = Situation
# C = Choices
# O = Outcomes
# P = Purpose
# E = Engagement
```

### Constitutional Principles (Yamas)
- Ahimsa (non-violence) → No harmful/controlling language
- Satya (truth) → Evidence-based coaching principles
- Asteya (non-stealing) → Respect autonomy
- Brahmacharya (moderation) → Psychological safety
- Aparigraha (non-attachment) → Future-focused, not blame

---

## Cryptographic Receipts

Pattern for quality accountability:
```typescript
interface CryptographicReceipt {
  signature: string;        // Ed25519 signature
  publicKey: string;
  timestamp: string;
  dataHash: string;
  constitutionalPrinciples: string[];
}
```

---

## Files to Preserve When Forking

### Core Architecture (Keep)
- `backend/openai_relay.py` (modify prompts)
- `backend/main.py` (keep structure)
- `backend/email_service.py` (keep pattern)
- `src/config.ts` (update URLs)
- `components/LiveVoiceCoach.tsx` (modify for new domain)
- `src/types/assessment.ts` (modify dimensions)

### Configuration (Update)
- `.env.production` (new backend URL)
- `vite.config.ts` (new allowed hosts)
- `package.json` (new name)

---

## Version History

- 2025-11-24: Initial canonical memory created
- Root cause fixes: Frontend URL, API key, dimension validation, speech recognition
