// src/common/decorators/company-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CompanyId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.companyId) {
      throw new Error('CompanyId no encontrado en el token JWT');
    }

    return user.companyId;
  },
);