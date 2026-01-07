# Task Dependency Analysis & Development Order

## Current Status
- **Open Issues:** 23
- **Open PRs:** 2
  - PR #182: Implements #155 (Gate SaaS UI) - **IN PROGRESS (NOT MERGED)**
- **Validation Status:** ✅ All tasks validated against codebase (see TASK_VALIDATION_REPORT.md)

## Validation Summary
**All 23 issues are still relevant**, but:
- ✅ **1 issue (#155) is partially done** - PR #182 exists but not merged
- ⚠️ **Architecture mismatch** - Codebase uses plugin system, issues assume direct integration
- ❌ **No Dodo integration** - Package installed but unused
- ❌ **No API limiting** - Documentation exists but code doesn't
- ❌ **No frontend SaaS components** - All need to be built

**Key Findings:**
- Plugin system exists (`server/src/plugins/plugin-loader.service.ts`) but issues don't reference it
- `dodopayments@2.6.0` installed but not used anywhere
- No `.env.saas` file exists
- No SaaS UI components exist (tier, quota, usage, upgrade prompts)
- Rate limiting documented but not implemented

**See TASK_VALIDATION_REPORT.md for detailed validation of each issue.**

## Dependency Tree

### Phase 1: Foundation & Configuration (Do First)
These are prerequisites that block other work:

1. **#139** - Create `.env.saas` with SaaS-specific variables
   - **Priority:** 🔴 CRITICAL
   - **Blocks:** #137, #140, #158
   - **Why:** All SaaS config depends on this file

2. **#137/#140** - Update config loading logic for SaaS/OSS modes
   - **Priority:** 🔴 CRITICAL  
   - **Status:** Duplicate issues (consolidate to one)
   - **Depends on:** #139
   - **Blocks:** #158, #160, #162
   - **Why:** Core infrastructure for mode switching

3. **#157** - Ensure Dodo API keys are only used server-side
   - **Priority:** 🔴 CRITICAL (Security)
   - **Blocks:** Nothing, but should be done early
   - **Why:** Security best practice before adding Dodo SDK

4. **#158** - Gate all SaaS logic by environment variables
   - **Priority:** 🟠 HIGH
   - **Depends on:** #137/#140, #139
   - **Blocks:** #160, #162
   - **Why:** Prevents accidental SaaS feature exposure in OSS

### Phase 2: Dodo Dashboard Setup (External)
5. **#143** - Define products (tiers) and manage subscriptions in Dodo dashboard
   - **Priority:** 🟠 HIGH
   - **Type:** External task (Dodo dashboard)
   - **Blocks:** #142, #144, #146
   - **Why:** Must exist before SDK integration

### Phase 3: Core SaaS Backend (After Foundation)
6. **#142** - Implement Dodo SDK integration service (`dodo.service.ts`)
   - **Priority:** 🟠 HIGH
   - **Depends on:** #143, #157
   - **Blocks:** #146, #147, #148, #161
   - **Why:** Core service for all Dodo interactions

7. **#145** - Define tier limits for form analysis and AI chat
   - **Priority:** 🟠 HIGH
   - **Can be done in parallel with:** #142
   - **Blocks:** #146
   - **Why:** Needed for product mapping

8. **#146** - Map Dodo products to internal tier logic
   - **Priority:** 🟠 HIGH
   - **Depends on:** #142, #143, #145
   - **Blocks:** #144, #147
   - **Why:** Connects Dodo products to app logic

9. **#144** - Sync product IDs and entitlements with backend logic
   - **Priority:** 🟡 MEDIUM
   - **Depends on:** #143, #146
   - **Blocks:** #147
   - **Why:** Ensures consistency

### Phase 4: API Limiting (After Core Services)
10. **#147** - Implement NestJS middleware/interceptor for API limiting
    - **Priority:** 🟠 HIGH
    - **Depends on:** #142, #146
    - **Blocks:** #148, #149, #150
    - **Why:** Enforces usage limits

11. **#148** - Query Dodo SDK for entitlements and usage on API calls
    - **Priority:** 🟠 HIGH
    - **Depends on:** #142, #147
    - **Blocks:** #149, #154
    - **Why:** Provides usage data

12. **#149** - Enforce limits and handle errors/warnings for exceeded usage
    - **Priority:** 🟠 HIGH
    - **Depends on:** #147, #148
    - **Blocks:** #153, #154
    - **Why:** User-facing limit enforcement

### Phase 5: Frontend Integration (After Backend API)
13. **#151** - Add usage state to React global context
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** Backend API (#148, #149)
    - **Blocks:** #152, #154
    - **Why:** Frontend state management

14. **#154** - Fetch usage/entitlement data from backend and update UI in real time
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #151, #148, #149
    - **Blocks:** #152, #153
    - **Why:** Real-time data updates

15. **#152** - Create UI components for tier, usage, quota, and upgrade prompts
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #151, #154
    - **Blocks:** #153, #156
    - **Why:** User-facing components

16. **#153** - Show warnings/errors in UI when limits are reached
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #152, #149
    - **Blocks:** #156
    - **Why:** User feedback

### Phase 6: Testing & Validation (Final Phase)
17. **#160** - Add tests for SaaS/OSS mode switching
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #137/#140, #158
    - **Why:** Validates mode switching

18. **#161** - Add tests for Dodo SDK integration
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #142
    - **Why:** Validates SDK integration

19. **#150** - Add tests for API limiting logic
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #147
    - **Why:** Validates limiting

20. **#156** - Add tests for UI states and limit handling
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #152, #153
    - **Why:** Validates UI behavior

21. **#162** - Validate OSS build works without Dodo SDK
    - **Priority:** 🟡 MEDIUM
    - **Depends on:** #158, #155 (PR #182)
    - **Why:** Final OSS validation

### Already In Progress / Partially Done
- **PR #182** - Implements #155 (Gate SaaS UI with environment variable)
  - **Status:** ⚠️ **NOT MERGED** - Changes exist in PR but not in codebase
  - **Current State:** `ShareFormModal.tsx` shows Response Limit without gating
  - **Action Required:** Merge PR or manually apply changes
  - **Note:** This is frontend-only and doesn't block backend work

### Architecture Mismatch
⚠️ **Important:** The codebase uses a **plugin architecture** (`server/src/plugins/plugin-loader.service.ts`), while issues #137, #140, #158 assume **direct integration** with `.env.saas`. 

**Current Plugin System:**
- OSS mode: No `PLUGINS` env var set
- SaaS mode: `PLUGINS=billing,usage-tracking,etc.`
- Loads plugins dynamically from npm or local directory

**Recommendation:** 
- Either adapt issues to plugin architecture, OR
- Implement both approaches (plugin system + direct env-based config)

## Recommended Development Order

### 🎯 Start Here (Week 1)
1. **#139** - Create `.env.saas` (1-2 hours)
2. **#137 or #140** - Update config loading (consolidate duplicates first) (4-6 hours)
3. **#157** - Security check for Dodo API keys (1-2 hours)
4. **#158** - Gate all SaaS logic by env vars (4-6 hours)

### 🎯 Next (Week 1-2)
5. **#143** - Set up Dodo dashboard products (external, 2-4 hours)
6. **#142** - Implement Dodo SDK service (6-8 hours)
7. **#145** - Define tier limits (2-3 hours, can parallel with #142)

### 🎯 Then (Week 2-3)
8. **#146** - Map Dodo products to tiers (4-6 hours)
9. **#144** - Sync product IDs (2-3 hours)
10. **#147** - Implement API limiting middleware (6-8 hours)
11. **#148** - Query Dodo SDK on API calls (4-6 hours)
12. **#149** - Enforce limits and errors (4-6 hours)

### 🎯 Frontend (Week 3-4)
13. **#151** - Add usage state to React context (4-6 hours)
14. **#154** - Fetch usage data from backend (4-6 hours)
15. **#152** - Create UI components (8-12 hours)
16. **#153** - Show warnings/errors (4-6 hours)

### 🎯 Testing (Week 4-5)
17. **#160** - Tests for mode switching (4-6 hours)
18. **#161** - Tests for Dodo SDK (4-6 hours)
19. **#150** - Tests for API limiting (4-6 hours)
20. **#156** - Tests for UI states (4-6 hours)
21. **#162** - Validate OSS build (2-4 hours)

## Notes
- **PR #182** (#155) is already in progress and can be merged independently
- Issues #137 and #140 are duplicates - consolidate before starting
- Issue #143 (Dodo dashboard) is external and can be done in parallel with code work
- Frontend work (#151-156) can start once backend API (#148, #149) is ready
- Testing can be done incrementally as features are built

## Quick Start Recommendation
**If you want to start coding immediately:**
1. Consolidate #137/#140 (pick one, close the other)
2. Start with #139 → #137/#140 → #158 (foundation)
3. While waiting on #143 (Dodo dashboard), work on #145 (tier limits)
4. Then proceed with #142 (Dodo SDK service)

