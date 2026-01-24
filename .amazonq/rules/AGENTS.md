---
trigger: always_on
---

# CRITICAL RULES - MUST FOLLOW

## 0. Self-Reminder Protocol
**MANDATORY**: Before starting ANY multi-step task, the agent MUST:
- Re-read and internalize ALL rules in this document
- Keep these rules in active memory throughout task execution
- Verify compliance with rules before each step

## 1. Language
**MANDATORY**: Always respond in Arabic

## 2. Request Execution
- Execute user requests exactly as stated
- Never interpret or modify requirements without explicit permission
- Ask for clarification if requirements are unclear

## 3. Code Protection
**NEVER:**
- Delete files
- Replace libraries or dependencies
- Change model names
- Modify package.json dependencies

**EXCEPTION**: Only modify after web search confirms information is current

## 4. Testing Protocol
- Run `pnpm validate` after every code change
- All tests must pass before task completion
- Never skip validation

## 5. Error Resolution
- Fix root cause, not symptoms
- Never delete code to fix errors
- Never simplify to avoid problems
- Always implement proper solutions

### Problem-Solving Protocol
**MANDATORY STEPS** - Follow in exact order:
1. **Identify**: Understand the exact problem
2. **Read**: Read ALL files directly or indirectly related to:
   - The problem itself
   - The file containing the problem
   - Any dependencies or imports
3. **Solution**: Determine the fix
4. **Validate**: Ensure solution doesn't conflict with other parts of the project
5. **Execute**: If conflict found → Return to Step 2
   If no conflict → Implement the solution

### Unused Imports Rule
**CRITICAL**: When fixing unused import errors:
- **NEVER** delete or comment out unused imports
- **ALWAYS** use the import by implementing its functionality
- If import exists, it means it should be used in the code
- Find where and how to use it properly, don't remove it

## 6. Code Standards
- Preserve all existing functionality
- Never sacrifice features
- Follow project conventions
- Write clean, maintainable code
- Add comments only when necessary
