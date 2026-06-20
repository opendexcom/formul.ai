import {
  buildFlowPromptTraceInputs,
  buildFlowRequestPreview,
  combinePromptForCache,
} from './mlflow-trace-context';

describe('flow prompt trace helpers', () => {
  it('combinePromptForCache joins system and user prompts', () => {
    expect(combinePromptForCache('task body', 'system rules')).toBe(
      'system rules\n---\ntask body',
    );
    expect(combinePromptForCache('task only')).toBe('task only');
  });

  it('buildFlowPromptTraceInputs separates system and user fields', () => {
    const inputs = buildFlowPromptTraceInputs('user task', 'system contract');
    expect(inputs.systemPrompt).toBe('system contract');
    expect(inputs.prompt).toBe('user task');
  });

  it('buildFlowRequestPreview notes when a system prompt is attached', () => {
    expect(buildFlowRequestPreview('analyze chunk', 'rules')).toMatch(
      /^\[system prompt attached\]/,
    );
  });
});
