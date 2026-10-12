import { NotFoundException } from '@nestjs/common';
import { assertTaskBelongsToForm } from './analytics-task-access';

describe('assertTaskBelongsToForm', () => {
  const task = { taskId: 't1', formId: 'form-a', status: 'running' };

  it('returns the task when it belongs to the form', () => {
    expect(assertTaskBelongsToForm(task, 'form-a')).toBe(task);
  });

  it('returns null when the task is missing', () => {
    expect(assertTaskBelongsToForm(null, 'form-a')).toBeNull();
  });

  it('throws 404 when the task belongs to another form', () => {
    expect(() => assertTaskBelongsToForm(task, 'form-b')).toThrow(NotFoundException);
  });
});
