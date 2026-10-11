import type { GenerateAIFormDto } from '../../ai/dto/generate-ai-form.dto';

export interface FormGenerationHints {
  currentFormContext: string;
  modificationsHint: string;
  modificationsShape: string;
  refineHint: string;
  preserveHint: string;
}

export function buildFormGenerationHints(
  dto: GenerateAIFormDto,
): FormGenerationHints {
  const currentFormContext = dto.currentForm
    ? `\n\nCurrent form structure:\n${JSON.stringify(dto.currentForm, null, 2)}\n\nThe user wants to refine or modify this existing form.`
    : '\n\nThis is a new form being created from scratch.';

  return {
    currentFormContext,
    modificationsHint: dto.currentForm
      ? '5. What should be kept, modified, or removed from the existing form'
      : '',
    modificationsShape: dto.currentForm
      ? ', modifications: { keep: string[], modify: string[], remove: string[], add: string[] }'
      : '',
    refineHint: dto.currentForm
      ? 'Keep questions from the current form that are still relevant, and modify or add new ones as needed.'
      : '',
    preserveHint: dto.currentForm
      ? '\n- Preserve the original form ID and metadata where applicable'
      : '',
  };
}
