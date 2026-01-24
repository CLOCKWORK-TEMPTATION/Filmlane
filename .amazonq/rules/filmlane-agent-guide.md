# Filmlane AI Agent Guide

## Project Overview

**Filmlane** is an Arabic-first screenplay editor built with Next.js 15, React 19, and Firebase Genkit AI. It provides intelligent screenplay formatting with multi-page pagination, AI-powered scene generation, and context-aware text classification.

## Architecture

### Core Stack

- **Framework**: Next.js 15.5.9 (App Router, Turbopack dev mode on port 9002)
- **AI Engine**: Firebase Genkit 1.20.0 with Google Gemini 2.5 Flash
- **UI**: Radix UI primitives + Tailwind CSS (RTL-first)
- **State**: React 19 with local state (no external state management)
- **Package Manager**: pnpm 10.28.0

### Key Architectural Patterns

#### 1. Multi-Page Screenplay Editor (`EditorArea.tsx`)

- **Pagination Logic**: Content flows across multiple `.screenplay-sheet` divs
- **Constants**: `PAGE_HEIGHT_PX=1123`, `CONTENT_HEIGHT_PX` (defined in `@/constants/page.ts`)
- **Repagination**: Triggered via `requestAnimationFrame` on content changes
- **DOM Manipulation**: Direct DOM operations for performance (not pure React state)
- **Cursor Preservation**: Careful node movement to avoid losing selection

#### 2. AI-Powered Screenplay Classification (`paste-classifier.ts`)

- **Context Window**: Analyzes 3 lines before/after current line
- **Memory System**: `ContextMemoryManager` tracks character names, locations, dialogue patterns
- **Classification Pipeline**:
  1. Basmala detection (بسم الله الرحمن الرحيم)
  2. Scene headers (3 types: top-line, header-1, header-2, header-3)
  3. Transitions, parentheticals, actions
  4. Character names (with colon detection)
  5. Dialogue (with linguistic probability scoring)
- **Dialogue Heuristics**: Scores based on vocative particles (يا), question marks, colloquial markers
- **Spacing Rules**: Enforced via `getSpacingMarginTop()` (e.g., character→dialogue: 0pt, action→action: 12pt)

#### 3. Genkit AI Flows (`src/ai/flows/`)

- **Server Actions**: All AI flows use `'use server'` directive
- **Structured I/O**: Zod schemas for input/output validation
- **Flows**:
  - `autoFormatScreenplay`: Formats raw text into screenplay elements
  - `generateSceneIdeas`: Generates 3 scene ideas from theme

### Critical File Locations

```
src/
├── ai/
│   ├── genkit.ts              # AI instance config (Gemini 2.5 Flash)
│   └── flows/                 # Server-side AI flows
├── components/editor/
│   ├── ScreenplayEditor.tsx   # Main editor orchestrator
│   ├── EditorArea.tsx         # Multi-page contentEditable logic
│   ├── EditorToolbar.tsx      # Format controls
│   └── EditorSidebar.tsx      # AI actions panel
├── utils/
│   ├── paste-classifier.ts    # 2000+ line classification engine
│   ├── context-memory-manager.ts  # In-memory session context
│   └── editor-styles.ts       # Format-specific CSS-in-JS
└── constants/
    ├── formats.ts             # 10 screenplay formats with icons
    └── page.ts                # Page dimensions
```

## Development Workflows

### Running the App

```bash
pnpm dev              # Next.js dev server (port 9002, Turbopack)
pnpm genkit:dev       # Genkit UI for testing AI flows
pnpm genkit:watch     # Auto-reload Genkit on changes
pnpm build            # Production build (ignores TS/ESLint errors)
```

### Testing AI Flows

1. Run `pnpm genkit:dev`
2. Open Genkit UI (usually http://localhost:4000)
3. Test flows with sample Arabic text
4. Check `src/ai/dev.ts` for flow registration

### Debugging Classification

- Enable logger: Check `src/utils/logger.ts` for log levels
- Paste events: Look for `🚀 بدء عملية اللصق` in console
- Classification decisions: Each line logs its format type

## Project-Specific Conventions

### RTL-First Design

- **All layouts**: `dir="rtl"` on `<html>` tag
- **Text alignment**: Right-aligned by default
- **Margins/Padding**: Reversed (e.g., `mr-4` becomes left margin in RTL)
- **Icons**: Lucide React icons (auto-flip in RTL)

### Arabic Text Handling

- **Normalization**: Strip diacritics (`\u064B-\u065F`), zero-width chars
- **Fonts**: `AzarMehrMonospaced-San` (fixed-width Arabic) in `public/fonts/`
- **Character Detection**: Regex `/[\u0600-\u06FF]/` for Arabic range

### Format Class System

- **Pattern**: `format-{formatId}` (e.g., `format-action`, `format-character`)
- **Mapping**: `formatClassMap` in `constants/formats.ts`
- **Styles**: Applied via `getFormatStyles()` returning React.CSSProperties
- **Shortcuts**: Ctrl+1 (scene-header-1), Ctrl+2 (character), Ctrl+3 (dialogue), Ctrl+4 (action), Ctrl+6 (transition)

### State Management

- **No Redux/Zustand**: Pure React state with `useState`/`useRef`
- **Editor State**: Lives in `EditorArea` component
- **Imperative API**: `EditorHandle` ref exposes `insertContent()`, `getAllText()`
- **Memory**: Session-scoped via `ContextMemoryManager` (in-memory Map)

## Integration Points

### AI Integration

- **Entry Point**: `src/ai/genkit.ts` exports `ai` instance
- **Model**: `googleai/gemini-2.5-flash` (configurable)
- **API Key**: Loaded from environment (Firebase handles auth)
- **Flow Pattern**:
  ```typescript
  const prompt = ai.definePrompt({ name, input, output, prompt });
  const flow = ai.defineFlow({ name, inputSchema, outputSchema }, async (input) => {
    const { output } = await prompt(input);
    return output!;
  });
  ```

### External Dependencies

- **Radix UI**: Unstyled primitives (dialog, toast, dropdown, etc.)
- **Tailwind**: Utility-first CSS with custom Arabic font config
- **Next Themes**: Dark mode support (`useTheme()` hook)
- **Lucide React**: Icon library (470+ icons)

### Data Flow

1. **User Input** → `EditorArea` contentEditable
2. **Paste Event** → `paste-classifier.ts` analyzes lines
3. **Classification** → Applies format classes + spacing
4. **Repagination** → Distributes content across pages
5. **Stats Update** → Word/character/scene count to footer

## Critical Patterns to Follow

### When Adding New Screenplay Formats

1. Add to `screenplayFormats` array in `constants/formats.ts`
2. Update `getFormatStyles()` in `utils/editor-styles.ts`
3. Add classification logic in `paste-classifier.ts` (follow priority order)
4. Update spacing rules in `getSpacingMarginTop()`
5. Add keyboard shortcut in `EditorArea.handleKeyDown()`

### When Modifying Classification Logic

- **NEVER** change classification order without reviewing `docs/classification-rules.txt`
- **ALWAYS** test with Arabic text samples (dialogue, action, scene headers)
- **PRESERVE** context window logic (3 lines before/after)
- **MAINTAIN** dialogue probability scoring (threshold ≥ 3)

### When Working with Pagination

- **READ** `CONTENT_HEIGHT_PX` from constants (don't hardcode)
- **AVOID** removing nodes during repagination (causes cursor loss)
- **USE** `requestAnimationFrame` for repaginate calls (prevents jank)
- **HANDLE** overflow by adding pages via `setPages()` state update

### When Adding AI Features

- **CREATE** new flow in `src/ai/flows/` with Zod schemas
- **USE** `'use server'` directive for server actions
- **EXPORT** typed input/output interfaces
- **CALL** from client components (e.g., `ScreenplayEditor.tsx`)
- **HANDLE** errors with toast notifications

## Common Pitfalls

1. **Cursor Loss**: Modifying DOM during repagination breaks selection. Use `range.selectNodeContents()` to restore.
2. **Classification Loops**: Changing format priority can cause infinite reclassification. Test thoroughly.
3. **RTL Layout Bugs**: Tailwind classes like `ml-4` behave opposite in RTL. Use logical properties (`ms-4`).
4. **Arabic Regex**: Don't forget diacritics/zero-width chars. Always normalize before matching.
5. **Genkit Errors**: Server actions fail silently. Check browser console for stack traces.

## Performance Considerations

- **Repagination**: Runs on every keystroke via `requestAnimationFrame`. Keep logic fast.
- **Classification**: 2000+ line file. Avoid adding heavy regex in hot paths.
- **Memory Manager**: In-memory only. Will lose data on page refresh (consider localStorage).
- **AI Calls**: Debounce user-triggered AI actions to avoid rate limits.

## Security Notes

- **No Auth**: Currently no user authentication (Firebase setup incomplete)
- **API Keys**: Genkit uses server-side keys (safe from client exposure)
- **XSS Risk**: `contentEditable` + `innerHTML` usage. Sanitize if accepting external content.
- **CORS**: Next.js API routes handle CORS automatically

## Next Steps for AI Agents

When asked to implement features:

1. **Check** if similar logic exists in `paste-classifier.ts` or `editor-styles.ts`
2. **Follow** the format class pattern for UI changes
3. **Use** Genkit flows for AI features (don't call external APIs directly)
4. **Test** with Arabic text (not just English)
5. **Preserve** RTL layout and accessibility
