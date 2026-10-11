import { Injectable } from '@nestjs/common';
import { PromptVariableException } from './mlflow.exceptions';

@Injectable()
export class PromptSandboxService {
  formatTemplate(
    template: string,
    variables: Record<string, unknown>,
    allowedVariables: string[],
  ): string {
    const allowed = new Set(allowedVariables);
    for (const key of Object.keys(variables)) {
      if (!allowed.has(key)) {
        throw new PromptVariableException(
          `Variable "${key}" is not allowed for this flow`,
        );
      }
    }

    const unknownInTemplate = [...template.matchAll(/\{\{(\w+)\}\}/g)].map(
      (m) => m[1],
    );
    for (const key of unknownInTemplate) {
      if (!allowed.has(key)) {
        throw new PromptVariableException(
          `Template references undeclared variable "${key}"`,
        );
      }
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      if (!(key in variables)) {
        throw new PromptVariableException(
          `Missing required variable "${key}" for prompt formatting`,
        );
      }
      return this.serializeVariable(variables[key]);
    });
  }

  escapeUserInput(value: string): string {
    return JSON.stringify(value).slice(1, -1);
  }

  private serializeVariable(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }
}
