import { NotFoundException } from '@nestjs/common';

export function assertTaskBelongsToForm<T extends { formId: string }>(
  task: T | null | undefined,
  formId: string,
): T | null {
  if (!task) {
    return null;
  }
  if (task.formId !== formId) {
    throw new NotFoundException('Task not found');
  }
  return task;
}
