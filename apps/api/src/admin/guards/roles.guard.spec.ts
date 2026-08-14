import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@pingme/db';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function createContext(role?: AdminRole): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : {} }),
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      AdminRole.moderator,
      AdminRole.super_admin,
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows moderator for moderator-only routes', () => {
    expect(guard.canActivate(createContext(AdminRole.moderator))).toBe(true);
  });

  it('allows super_admin for moderator-only routes', () => {
    expect(guard.canActivate(createContext(AdminRole.super_admin))).toBe(true);
  });

  it('denies support for moderator-only routes', () => {
    expect(() => guard.canActivate(createContext(AdminRole.support))).toThrow(
      ForbiddenException,
    );
  });

  it('allows any authenticated admin when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(AdminRole.support))).toBe(true);
  });

  it('reads roles metadata key', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride');
    guard.canActivate(createContext(AdminRole.moderator));
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
