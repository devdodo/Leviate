import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import { USER_TYPES_KEY } from '../decorators/user-types.decorator';

@Injectable()
export class UserTypesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedTypes = this.reflector.getAllAndOverride<UserType[]>(
      USER_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowedTypes?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.userType) {
      throw new ForbiddenException('Access denied');
    }

    if (!allowedTypes.includes(user.userType as UserType)) {
      throw new ForbiddenException(
        'This endpoint is only available to app users (creators and contributors).',
      );
    }

    return true;
  }
}
