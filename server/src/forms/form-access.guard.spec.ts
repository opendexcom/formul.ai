import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FormAccessGuard } from './form-access.guard';
import { FormsService } from './forms.service';

describe('FormAccessGuard', () => {
  const formId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  let assertFormAccess: jest.Mock;
  let guard: FormAccessGuard;

  beforeEach(() => {
    assertFormAccess = jest.fn().mockResolvedValue({ _id: formId });
    guard = new FormAccessGuard({ assertFormAccess } as unknown as FormsService);
  });

  function context(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  it('skips routes without a form id', async () => {
    await expect(
      guard.canActivate(context({ user: { _id: userId }, params: {} })),
    ).resolves.toBe(true);
    expect(assertFormAccess).not.toHaveBeenCalled();
  });

  it('skips static segments that are not ObjectIds', async () => {
    await expect(
      guard.canActivate(
        context({ user: { _id: userId }, params: { id: 'debug' } }),
      ),
    ).resolves.toBe(true);
    expect(assertFormAccess).not.toHaveBeenCalled();
  });

  it('requires an authenticated user for form-scoped routes', async () => {
    await expect(
      guard.canActivate(context({ params: { id: formId } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('asserts owner access when params.id is a form id', async () => {
    await expect(
      guard.canActivate(
        context({ user: { _id: userId }, params: { id: formId } }),
      ),
    ).resolves.toBe(true);
    expect(assertFormAccess).toHaveBeenCalledWith(userId, formId);
  });
});
