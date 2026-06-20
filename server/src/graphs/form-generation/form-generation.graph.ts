import { END, START, StateGraph } from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { AiService } from '../../ai/ai.service';
import type { GuardianService } from '../../ai/guardian.service';
import {
  FormGenerationState,
  type FormGenerationConfigurable,
  type FormGenerationStateType,
} from './form-generation.state';
import type { GraphStepEvent } from '../types/graph-events';
import { withGraphNodeSpan } from '../../mlflow/mlflow-trace-context';

const GRAPH_ID = 'form_generation';

export interface FormGenerationGraphDeps {
  aiService: AiService;
  guardianService: GuardianService;
}

function emitStep(
  config: RunnableConfig,
  step: GraphStepEvent,
): GraphStepEvent[] {
  const onStep = (config.configurable as FormGenerationConfigurable | undefined)
    ?.onStep;
  onStep?.(step);
  return [step];
}

function flowOptions(state: FormGenerationStateType) {
  return { skipValidation: true as const, userId: state.userId };
}

export function buildFormGenerationGraph(deps: FormGenerationGraphDeps) {
  const graph = new StateGraph(FormGenerationState)
    .addNode('guardianCheck', async (state, config) =>
      withGraphNodeSpan(GRAPH_ID, 'guardianCheck', { promptLength: state.prompt.length }, async () => {
        const validation = await deps.guardianService.validatePrompt(state.prompt);
        if (!validation.isSafe) {
          return {
            guardianFailed: true,
            guardianReason: validation.reason,
            steps: emitStep(config, {
              step: 'error',
              message: `Security check failed: ${validation.reason}`,
              status: 'error',
            }),
          };
        }
        return { guardianFailed: false };
      }),
    )
    .addNode('runStrategy', async (state, config) =>
      withGraphNodeSpan(GRAPH_ID, 'runStrategy', { promptLength: state.prompt.length }, async () => {
        emitStep(config, {
          step: 'analyze',
          message: 'Analyzing form requirements...',
          status: 'in-progress',
        });
        const { content, usage } = await deps.aiService.invokeFlow(
          'form_generation.strategy',
          {
            userInput: state.prompt,
            currentFormContext: state.hints.currentFormContext,
            modificationsHint: state.hints.modificationsHint,
            modificationsShape: state.hints.modificationsShape,
          },
          flowOptions(state),
        );
        const strategy = JSON.parse(content) as Record<string, unknown>;
        return {
          strategy,
          lastUsage: usage,
          steps: emitStep(config, {
            step: 'analyze',
            message: `Strategy created: ${String(strategy.purpose ?? 'form')}`,
            status: 'completed',
            data: strategy,
            usage,
          }),
        };
      }),
    )
    .addNode('runQuestions', async (state, config) =>
      withGraphNodeSpan(GRAPH_ID, 'runQuestions', { questionCount: state.questions?.length ?? 0 }, async () => {
        emitStep(config, {
          step: 'questions',
          message: 'Preparing questions based on strategy...',
          status: 'in-progress',
        });
        const { content, usage } = await deps.aiService.invokeFlow(
          'form_generation.questions',
          {
            userInput: state.prompt,
            currentFormContext: state.hints.currentFormContext,
            strategyJson: JSON.stringify(state.strategy, null, 2),
            refineHint: state.hints.refineHint,
          },
          flowOptions(state),
        );
        const questions = JSON.parse(content) as unknown[];
        return {
          questions,
          lastUsage: usage,
          steps: emitStep(config, {
            step: 'questions',
            message: `Generated ${questions.length} questions`,
            status: 'completed',
            data: questions,
            usage,
          }),
        };
      }),
    )
    .addNode('runOptimize', async (state, config) =>
      withGraphNodeSpan(GRAPH_ID, 'runOptimize', { questionCount: state.questions?.length ?? 0 }, async () => {
        emitStep(config, {
          step: 'optimize',
          message: 'Optimizing question types for better UX...',
          status: 'in-progress',
        });
        const { content, usage } = await deps.aiService.invokeFlow(
          'form_generation.optimize',
          {
            currentFormContext: state.hints.currentFormContext,
            questionsJson: JSON.stringify(state.questions, null, 2),
            strategyJson: JSON.stringify(state.strategy, null, 2),
            refineHint: state.hints.refineHint
              ? 'Changes from the original form are intentional and improve the form'
              : '',
          },
          flowOptions(state),
        );
        const optimizedQuestions = JSON.parse(content) as unknown[];
        return {
          optimizedQuestions,
          lastUsage: usage,
          steps: emitStep(config, {
            step: 'optimize',
            message: 'Questions optimized for better user experience',
            status: 'completed',
            data: optimizedQuestions,
            usage,
          }),
        };
      }),
    )
    .addNode('runFinal', async (state, config) =>
      withGraphNodeSpan(GRAPH_ID, 'runFinal', { questionCount: state.optimizedQuestions?.length ?? 0 }, async () => {
        emitStep(config, {
          step: 'generate',
          message: 'Generating final form structure...',
          status: 'in-progress',
        });
        const { content, usage } = await deps.aiService.invokeFlow(
          'form_generation.final',
          {
            currentFormContext: state.hints.currentFormContext,
            purpose: String(state.strategy?.purpose ?? ''),
            questionsJson: JSON.stringify(state.optimizedQuestions, null, 2),
            userInput: state.prompt,
            preserveHint: state.hints.preserveHint,
          },
          { ...flowOptions(state), structuredOutput: true },
        );
        const parsed = JSON.parse(content);
        const finalForm = deps.aiService.sanitizeAiFormOutput(parsed);
        return {
          finalForm,
          lastUsage: usage,
          steps: emitStep(config, {
            step: 'generate',
            message: 'Form generated successfully!',
            status: 'completed',
            data: finalForm,
            usage,
          }),
        };
      }),
    );

  graph
    .addEdge(START, 'guardianCheck')
    .addConditionalEdges('guardianCheck', (state) =>
      state.guardianFailed ? END : 'runStrategy',
    )
    .addEdge('runStrategy', 'runQuestions')
    .addEdge('runQuestions', 'runOptimize')
    .addEdge('runOptimize', 'runFinal')
    .addEdge('runFinal', END);

  return graph.compile();
}

export type CompiledFormGenerationGraph = ReturnType<
  typeof buildFormGenerationGraph
>;
