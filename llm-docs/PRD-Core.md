# Product Requirements Document - Core

*Last Updated: June 7, 2025*

## 📖 How to Use This Document

### For AI Agents
This is the **core PRD** - your primary reference for project overview, objectives, and development workflow. For detailed technical specifications, refer to the appropriate supporting documents using the **Document Navigation Guide** below.

**Checkbox Management:**
- `[ ]` = Task not started
- `[x]` = Task completed  
- Update checkboxes as you progress through tasks
- Never mark a checkbox complete without actually implementing the feature
- Use checkboxes to track your progress across multiple sessions

**Workflow Adherence:**
1. Always follow the 6-step workflow (Plan → Analyze → Approve → Implement → Validate → Complete)
2. Never skip the "Analyze" step - constraint violations are project failures
3. Reference the appropriate technical documents during analysis
4. Check the architecture guide before implementing any patterns

**Document References:**
- When tasks mention "architectural constraints" → See `PRD-Architecture.md`
- When tasks mention "technical patterns" → See `PRD-Technical-Specs.md`
- When unsure which document to check → See `AI-Agent-Guide.md`

---

## 🗂️ Document Navigation Guide

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **PRD-Core.md** (this file) | Project overview, objectives, development checklist | Always start here, project planning |
| **AI-Agent-Guide.md** | Which document to use for specific questions | When unsure where to find information |
| **PRD-Architecture.md** | Onion architecture, reactive constraints, file organization | During "ANALYZE" step of workflow, architecture questions |
| **PRD-Technical-Specs.md** | Modal system, audio management, UI flows, detailed patterns | During implementation, specific technical questions |

**Quick Reference:**
- 🏗️ **Architecture questions** → `PRD-Architecture.md`
- 🔧 **Implementation patterns** → `PRD-Technical-Specs.md`
- 🧭 **Navigation help** → `AI-Agent-Guide.md`
- 📋 **Project overview** → `PRD-Core.md` (this file)

---

## 🤖 AI Agent Instructions

### Critical Constraint Reminder
**BEFORE IMPLEMENTING ANY FEATURE:**

1. **Review constraints** in `PRD-Architecture.md`
2. **Check implementation patterns** in `PRD-Technical-Specs.md`
3. **Follow 6-step workflow** below
4. **Verify compliance** before marking tasks complete

### Implementation Workflow
For each task, follow this exact sequence:

1. **[ ] PLAN**: Create implementation plan
2. **[ ] ANALYZE**: Verify architectural constraint compliance *(see PRD-Architecture.md)*
3. **[ ] APPROVE**: Confirm readiness to proceed
4. **[ ] IMPLEMENT**: Execute the implementation
5. **[ ] VALIDATE**: Test constraints are maintained
6. **[ ] COMPLETE**: Mark as done

### When Analyzing Tasks:
- **Architecture questions** → Check `PRD-Architecture.md`
- **Reactive constraints** → Check `PRD-Architecture.md` Section 2
- **File organization** → Check `PRD-Architecture.md` Section 4
- **Implementation patterns** → Check `PRD-Technical-Specs.md`

---

## Project Overview

### Product Vision
A completely open-source, serverless web application that provides a unified interface for text-to-speech generation across multiple voice providers. The application serves as a centralized hub for content creators and artists to manually generate, manage, and organize speech synthesis from various TTS APIs without vendor lock-in or usage limitations.

### Target Audience
**Primary**: Content creators and artists who need manual control over TTS generation
**Secondary**: Any users requiring TTS services who value open-source solutions and unified provider access

### Core Value Proposition
- **Unified Multi-Provider Access**: Single interface for multiple TTS providers (AWS, Azure, ElevenLabs, Google, OpenAI)
- **100% Free & Open Source**: No running costs, no rate limiting, no monetization barriers
- **Complete User Control**: Manual generation with full history management (save, remove, organize)
- **Future-Proof**: Open source ensures longevity beyond corporate interests
- **Cutting-Edge Technology**: Showcase of modern reactive web development patterns

### Business Objectives
- Provide a free, perpetual tool that gives back to the developer community
- Demonstrate advanced reactive programming patterns using Angular 20
- Build a sustainable open-source project supported by community patronage
- Eliminate vendor dependencies and usage restrictions for TTS access

---

## Technical Architecture Overview

### Technology Stack
- **Frontend Framework**: Angular 20 (latest features)
- **Reactive Programming**: 100% Zoneless with Signals
- **State Management**: Pure signal-based state management
- **Programming Paradigm**: Strict reactive-only (zero promises, zero effects, zero setTimeout)
- **Deployment**: Serverless architecture (zero running costs)

### Key Architectural Constraints
> **For detailed constraints and patterns, see `PRD-Architecture.md`**

- **100% Reactive**: No promises, effects, setTimeout, or observables allowed
- **Onion Architecture**: Strict layer separation with inward-flowing dependencies
- **Signal-First**: All state management via Angular signals
- **Resource API**: Angular experimental resource for all async operations

---

## User Experience Overview

### Core User Workflow
1. **Configuration**: Select provider → Choose model → Select voice → Enter API key
2. **Content Creation**: Enter text in main editor → Add optional title
3. **Generation**: Click generate → View loading state → Audio appears in player
4. **Playback**: Play generated audio in integrated player
5. **History Management**: Save to history → Browse/search saved items → Download/remove as needed

### UI Layout Structure
- **Left Sidebar**: Provider/model/voice settings, API key input
- **Main Content**: Text editor, generate button, audio player, status feedback
- **Right Sidebar**: Storage info, search, history list with controls

### Key Features
- Multi-provider TTS integration (starting with OpenAI)
- Centralized audio playback with position persistence
- Local storage + file system access modes
- Manual history management with search
- Real-time storage monitoring

---

## Success Metrics

### Technical Excellence Checklist
**Reactive Programming Compliance**:
- [ ] Zero promises detected in codebase
- [ ] Zero effects used anywhere
- [ ] Zero async/await patterns found
- [ ] Zero setTimeout/setInterval calls
- [ ] 100% signal-based state management verified
- [ ] Angular experimental resource API successfully integrated
- [ ] All async operations handled via resource pattern

**Architectural Integrity Checklist**:
- [ ] Strict Onion Architecture adherence validated *(verify using PRD-Architecture.md)*
- [ ] All dependencies flow inward toward domain
- [ ] Domain layer has zero framework dependencies  
- [ ] Presentation layer only imports from Integration
- [ ] All files properly organized in layer directories
- [ ] Bootstrap files in integration/bootstrap/
- [ ] UI assets in presentation/
- [ ] Domain-Driven Design principles followed
- [ ] Inversion of Control properly implemented

**Modern Framework Utilization**:
- [ ] Angular 20 latest features utilized
- [ ] Zoneless architecture implemented
- [ ] Performance benchmarks met

### Functional Success Checklist
**Core Workflow Completion**:
- [ ] Text-to-speech generation working across providers
- [ ] History management fully functional
- [ ] Audio playback seamless
- [ ] Storage systems operational (both modes)
- [ ] User interface responsive and intuitive

**Provider Integration**:
- [ ] OpenAI TTS working (Phase 1)
- [ ] Extensible architecture for additional providers
- [ ] Error handling robust across provider failures
- [ ] API key management secure and user-friendly

### Project Philosophy Validation
**Open Source Sustainability**:
- [ ] Codebase maintainable and extensible
- [ ] Zero running costs maintained
- [ ] Documentation comprehensive for contributors

**User Empowerment**:
- [ ] No vendor lock-in achieved
- [ ] Customization possible through open source
- [ ] Free access permanently maintained

---

## 📋 Development Checklist

### Phase 1: MVP Foundation

#### Core Architecture Setup
- [ ] **PLAN**: Design signal-based state management architecture
- [ ] **ANALYZE**: Verify no promises/effects in state design *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: Architecture review complete
- [ ] **IMPLEMENT**: Set up core signal state
- [ ] **VALIDATE**: Test pure signal implementation
- [ ] **COMPLETE**: Core architecture ready

#### OpenAI TTS Integration  
- [ ] **PLAN**: Design resource-based OpenAI integration
- [ ] **ANALYZE**: Verify resource API usage, no direct promises *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: Integration pattern approved
- [ ] **IMPLEMENT**: OpenAI provider via resource
- [ ] **VALIDATE**: Test reactive TTS generation
- [ ] **COMPLETE**: OpenAI integration working

#### Basic UI Implementation
- [ ] **PLAN**: Design signal-driven UI components
- [ ] **ANALYZE**: Verify Presentation → Integration only imports *(check PRD-Architecture.md Section 1)*
- [ ] **APPROVE**: Component architecture approved
- [ ] **IMPLEMENT**: Core UI components
- [ ] **VALIDATE**: Test reactive UI updates
- [ ] **COMPLETE**: Basic UI functional

#### Audio Playback System
- [ ] **PLAN**: Design reactive audio wrapper
- [ ] **ANALYZE**: Verify no direct Web Audio API promises *(check PRD-Technical-Specs.md Audio Section)*
- [ ] **APPROVE**: Audio architecture approved
- [ ] **IMPLEMENT**: Reactive audio player
- [ ] **VALIDATE**: Test signal-based playback
- [ ] **COMPLETE**: Audio system working

#### Local Storage System
- [ ] **PLAN**: Design signal-based storage
- [ ] **ANALYZE**: Verify reactive storage pattern *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: Storage architecture approved
- [ ] **IMPLEMENT**: Signal-driven storage service
- [ ] **VALIDATE**: Test reactive persistence
- [ ] **COMPLETE**: Storage system ready

### Phase 2: Enhanced Features

#### File System Storage Mode
- [ ] **PLAN**: Design file system access pattern
- [ ] **ANALYZE**: Verify resource-based file operations *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: File system pattern approved
- [ ] **IMPLEMENT**: Enhanced storage mode
- [ ] **VALIDATE**: Test permission handling
- [ ] **COMPLETE**: File system mode working

#### History Search & Management
- [ ] **PLAN**: Design signal-based search
- [ ] **ANALYZE**: Verify pure signal filtering *(check PRD-Technical-Specs.md UI Flow Section)*
- [ ] **APPROVE**: Search architecture approved
- [ ] **IMPLEMENT**: Reactive search functionality
- [ ] **VALIDATE**: Test search performance
- [ ] **COMPLETE**: Search system ready

#### Modal Dialog System
- [ ] **PLAN**: Design reactive modal system
- [ ] **ANALYZE**: Verify signal-only modal state *(check PRD-Technical-Specs.md Modal Section)*
- [ ] **APPROVE**: Modal architecture approved
- [ ] **IMPLEMENT**: Signal-based modal dialogs
- [ ] **VALIDATE**: Test modal accessibility and reactivity
- [ ] **COMPLETE**: Modal system ready

#### Speech Generation UI Flow
- [ ] **PLAN**: Design generation workflow signals
- [ ] **ANALYZE**: Verify reactive generation flow *(check PRD-Technical-Specs.md UI Flow Section)*
- [ ] **APPROVE**: Generation flow approved
- [ ] **IMPLEMENT**: Complete generation workflow
- [ ] **VALIDATE**: Test generation state management
- [ ] **COMPLETE**: Generation flow ready

### Phase 3: Provider Expansion

#### Additional TTS Providers
- [ ] **PLAN**: Design provider abstraction
- [ ] **ANALYZE**: Verify consistent resource usage *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: Provider pattern approved
- [ ] **IMPLEMENT**: AWS/Azure/ElevenLabs/Google providers
- [ ] **VALIDATE**: Test multi-provider reliability
- [ ] **COMPLETE**: Provider ecosystem ready

#### Advanced Voice Configuration
- [ ] **PLAN**: Design signal-based voice controls
- [ ] **ANALYZE**: Verify reactive configuration pattern *(check PRD-Architecture.md Section 2)*
- [ ] **APPROVE**: Configuration architecture approved
- [ ] **IMPLEMENT**: Pitch/speed/context controls
- [ ] **VALIDATE**: Test configuration reactivity
- [ ] **COMPLETE**: Advanced controls ready

---

## Timeline & Milestones

### Phase 1: MVP Foundation
**Duration**: 4-6 weeks
**Key Deliverables**: Core reactive architecture, OpenAI TTS, basic UI, audio playback, local storage

### Phase 2: Enhanced Features  
**Duration**: 2-3 weeks
**Key Deliverables**: File system storage, history search, modal system, complete UI flow

### Phase 3: Provider Expansion
**Duration**: Ongoing
**Key Deliverables**: Multi-provider support, advanced configuration options

---

## Risks & Mitigation

### Technical Risks
**Risk**: Reactive-only architecture too restrictive for real-world TTS APIs
**Mitigation**: Angular experimental resource API designed for this exact use case

**Risk**: Audio playback requires promise-based APIs
**Mitigation**: Custom reactive wrapper around angular-audio-context *(see PRD-Technical-Specs.md)*

### Project Risks
**Risk**: Angular 20 experimental features unstable
**Mitigation**: Pin specific versions, contribute to Angular community feedback

**Risk**: Onion architecture over-engineering for project scope
**Mitigation**: Architecture validates modern patterns for future learning/reference *(see PRD-Architecture.md)*

---

## 🎯 AI Agent Task Workflow Template

When implementing any feature, use this exact workflow:

### Step 1: PLAN
```
Task: [Describe the specific task]
Approach: [High-level implementation strategy]
Files to create/modify: [List all files]
Key signals needed: [List signal dependencies]
Resource patterns: [Any async operations needed]
```

### Step 2: ANALYZE  
```
Reactive Compliance Check:
- [ ] No promises/async in implementation?
- [ ] All state via signals?
- [ ] Resource API for external data?
- [ ] No effects planned?

Architecture Compliance Check:
- [ ] Dependencies flow inward?
- [ ] Files in correct layers?
- [ ] Presentation imports only integration?
- [ ] Domain stays pure?

Reference Documents Used:
- [ ] PRD-Architecture.md sections: ___
- [ ] PRD-Technical-Specs.md sections: ___
```

### Step 3: APPROVE
```
Architectural Review: [PASS/FAIL]
Reactive Review: [PASS/FAIL] 
Ready to Implement: [YES/NO]
```

### Step 4: IMPLEMENT
[Execute the implementation following the approved plan]

### Step 5: VALIDATE
```
Post-Implementation Check:
- [ ] No architectural violations introduced?
- [ ] All reactive constraints maintained?
- [ ] Tests passing?
- [ ] Code follows layer organization?
```

### Step 6: COMPLETE
```
✅ Task completed successfully
✅ All constraints maintained
✅ Ready for next task
```

---

*For detailed architectural constraints, see `PRD-Architecture.md`*
*For implementation patterns and technical specifications, see `PRD-Technical-Specs.md`*
*For navigation guidance, see `AI-Agent-Guide.md`*
