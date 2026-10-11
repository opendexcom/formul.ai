import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { extractFormIdFromRequest, isValidFormId } from './form-access.util';

/**
 * Owner-only access for authenticated form management routes.
 * Applied at FormsController class level so new `/forms/:id/*` handlers are
 * covered automatically. Routes without a form id (list/create) are skipped.
 *
 * Public respondent access must go through PublicFormsController / findPublicForm.
 */
@Injectable()
export class FormAccessGuard implements CanActivate {
  constructor(private readonly formsService: FormsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const formId = extractFormIdFromRequest(request);

    if (!formId || !isValidFormId(formId)) {
      return true;
    }

    const user = request.user as { _id?: unknown; id?: unknown } | undefined;
    const userId = user?._id ?? user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    await this.formsService.assertFormAccess(String(userId), formId);
    return true;
  }
}
