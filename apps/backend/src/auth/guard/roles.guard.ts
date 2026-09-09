import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { roleEfektif } from '../role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // kalau endpoint tidak punya @Roles()
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    // SUPER_ADMIN lolos semua @Roles() — supaya tidak perlu menambahkan
    // 'SUPER_ADMIN' satu per satu di puluhan dekorator controller.
    if (user?.role === 'SUPER_ADMIN') return true;

    // Role turunan (mis. OPERATOR_7691) lolos lewat baseRole-nya (SATKER),
    // lalu tetap disaring per kegiatan di PlanningsService.
    return (
      requiredRoles.includes(user?.role) ||
      requiredRoles.includes(roleEfektif(user) as string)
    );
  }
}
