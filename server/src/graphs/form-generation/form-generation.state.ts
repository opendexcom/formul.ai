import { Annotation } from '@langchain/langgraph';
import type { LlmUsage } from '../../ai/llm.types';
import type { GraphStepEvent } from '../types/graph-events';
import type { FormGenerationHints } from './form-generation.helpers';

export const FormGenerationState = Annotation.Root({
  prompt: Annotation<string>,
  userId: Annotation<string | undefined>,
  hints: Annotation<FormGenerationHints>,
  strategy: Annotation<Record<string, unknown> | undefined>,
  questions: Annotation<unknown[] | undefined>,
  optimizedQuestions: Annotation<unknown[] | undefined>,
  finalForm: Annotation<unknown | undefined>,
  guardianFailed: Annotation<boolean>,
  guardianReason: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
  steps: Annotation<GraphStepEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  lastUsage: Annotation<LlmUsage | undefined>,
});

export type FormGenerationStateType = typeof FormGenerationState.State;

export interface FormGenerationConfigurable {
  onStep?: (step: GraphStepEvent) => void;
}
