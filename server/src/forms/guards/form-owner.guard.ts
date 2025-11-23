import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FormsService } from '../forms.service';

@Injectable()
export class FormOwnerGuard implements CanActivate {
    constructor(private readonly formsService: FormsService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const formId = request.params.id;

        if (!user || !formId) {
            return false;
        }

        const userId = user._id || user.id;

        // The findOne method in FormsService already performs the ownership check
        // and throws ForbiddenException if the user is not the owner.
        // However, for a pure guard, we might want to separate the retrieval from the check,
        // but reusing findOne is efficient if it already does what we want.
        // Let's rely on findOne's existing logic which throws if access is denied.

        try {
            await this.formsService.findOne(formId, userId);
            return true;
        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof NotFoundException) {
                throw error;
            }
            throw new ForbiddenException('Access denied');
        }
    }
}
