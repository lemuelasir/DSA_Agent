export type AssistantMode = 'hint' | 'debug' | 'testcase' | 'learn'

export type AssistanceLevel = 1 | 2 | 3 | 4

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  mode?: AssistantMode
  level?: AssistanceLevel
  timestamp: string
  isMock?: boolean
  source?: 'python-backend' | 'mock-engine'
  model?: string
  code?: string
  language?: string
  error?: string
  isError?: boolean
}

export interface ModeConfig {
  id: AssistantMode
  label: string
  icon: string
  description: string
  placeholder: string
}

export const ASSISTANT_MODES: Record<AssistantMode, ModeConfig> = {
  hint: {
    id: 'hint',
    label: 'Hint Mode',
    icon: '💡',
    description: 'Nudges and algorithmic hints without giving away the full solution',
    placeholder: 'Describe where you are stuck in your problem...',
  },
  debug: {
    id: 'debug',
    label: 'Debug Mode',
    icon: '🐞',
    description: 'Explains compilation errors, index faults, and logical bugs',
    placeholder: 'Paste your error message or buggy code snippet...',
  },
  testcase: {
    id: 'testcase',
    label: 'Test Case',
    icon: '🧪',
    description: 'Finds sneaky edge cases and traces variable states',
    placeholder: 'What problem are you testing? Ask for edge cases...',
  },
  learn: {
    id: 'learn',
    label: 'Learn Mode',
    icon: '📚',
    description: 'Explains data structures, patterns, and Big-O complexity',
    placeholder: 'Ask about algorithms, intuition, or complexity analysis...',
  },
}

export const ASSISTANCE_LEVEL_DESCRIPTIONS: Record<AssistanceLevel, { title: string; subtitle: string }> = {
  1: { title: 'Level 1: Hint Only', subtitle: 'A gentle socratic question or conceptual hint' },
  2: { title: 'Level 2: Explain Mistake', subtitle: 'Pinpoints what went wrong without writing the fix' },
  3: { title: 'Level 3: Guide Through Fix', subtitle: 'Step-by-step guidance on how to fix the bug' },
  4: { title: 'Level 4: Full Solution', subtitle: 'Complete explanation with code and complexity' },
}
