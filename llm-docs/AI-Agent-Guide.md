# AI Agent Navigation Guide

## Quick Start for AI Agents

This project uses a split documentation structure to help AI agents efficiently navigate complex requirements. Each document serves a specific purpose:

### 📋 **When to Use Each Document**

#### **PRD-Core.md** - Start Here
**Use for:**
- Project overview and objectives
- Development workflow (6-step process)
- Feature checklist with progress tracking
- Cross-references to detailed specifications

**Questions it answers:**
- "What is this project about?"
- "What features need to be implemented?"
- "What's the development workflow?"
- "Where do I track progress?"

#### **PRD-Architecture.md** - Constraints & Patterns
**Use for:**
- Onion architecture layer definitions
- Reactive programming constraints (100% signal-based)
- File organization and structure rules
- Anti-patterns to avoid

**Questions it answers:**
- "How should I structure the code?"
- "What architectural patterns must I follow?"
- "What Angular patterns are forbidden?"
- "Where should files be placed?"

#### **PRD-Technical-Specs.md** - Implementation Details
**Use for:**
- Modal dialog system implementation
- Audio playback management patterns
- UI flow and state management
- Testing patterns and examples

**Questions it answers:**
- "How do I implement the modal system?"
- "How does audio playback work across components?"
- "What's the speech generation UI flow?"
- "How should I write tests?"

### 🎯 **Agent Decision Tree**

```
Start Here: What type of question do you have?
│
├── "What is this project?" → PRD-Core.md
├── "How do I track progress?" → PRD-Core.md (Development Checklist)
├── "What features are needed?" → PRD-Core.md (Features section)
│
├── "How should I structure code?" → PRD-Architecture.md
├── "What patterns can/can't I use?" → PRD-Architecture.md
├── "Where do files go?" → PRD-Architecture.md
│
├── "How do I implement modals?" → PRD-Technical-Specs.md (Modal System)
├── "How does audio work?" → PRD-Technical-Specs.md (Audio Management)
├── "What's the UI flow?" → PRD-Technical-Specs.md (Speech Generation)
└── "How do I test this?" → PRD-Technical-Specs.md (Testing Patterns)
```

### ⚡ **Emergency Quick Reference**

#### **Critical Constraints (Always Check First)**
```typescript
// ❌ FORBIDDEN - Never use these
const data$ = this.http.get(url);           // No Observables
await this.service.getData();               // No Promises  
useEffect(() => {}, []);                    // No Effects
setTimeout(() => {}, 1000);                 // No setTimeout

// ✅ REQUIRED - Always use these
private _state = signal(initialValue);      // Signals only
computed(() => this.state().value);        // Computed signals
this._state.update(state => ({...state})); // Signal updates
```

#### **File Placement Quick Reference**
- **Domain**: Business logic, entities, interfaces
- **Integration**: Service implementations, Angular integration
- **Infrastructure**: External integrations, storage, providers
- **Presentation**: Components, templates, UI logic

#### **Progress Tracking**
Always update checkboxes in PRD-Core.md Development Checklist:
- [ ] → ✅ when task completed
- Add notes for complex implementations
- Reference specific commits or files

### 🔄 **Cross-Reference System**

Each document includes cross-references:
- **PRD-Core.md**: Links to architecture rules and technical specs
- **PRD-Architecture.md**: References back to core requirements
- **PRD-Technical-Specs.md**: Links to architecture constraints

### 📝 **Documentation Update Protocol**

When making changes:
1. **Update PRD-Core.md** for new features or workflow changes
2. **Update PRD-Architecture.md** for new patterns or constraints
3. **Update PRD-Technical-Specs.md** for implementation details
4. **Keep cross-references synchronized** between documents

### 🚨 **Common Agent Mistakes to Avoid**

1. **Don't skip architecture review** - Always check PRD-Architecture.md before coding
2. **Don't use forbidden patterns** - Review reactive constraints first
3. **Don't ignore file organization** - Follow onion architecture strictly
4. **Don't forget progress tracking** - Update checkboxes in PRD-Core.md
5. **Don't implement without specs** - Check PRD-Technical-Specs.md for patterns

### 🎯 **AI Agent Workflow**

For each development task:

1. **Plan** (PRD-Core.md): Understand requirements and update checklist
2. **Analyze** (PRD-Architecture.md): Review constraints and file organization  
3. **Approve** (PRD-Technical-Specs.md): Check implementation patterns
4. **Implement**: Code following all constraints
5. **Validate**: Test against specifications
6. **Complete**: Update progress tracking

This navigation system ensures AI agents efficiently find the right information and maintain consistency across the large codebase while following strict architectural constraints.
