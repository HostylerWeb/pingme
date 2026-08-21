import { isPrismaUniqueConflict } from './prisma-error.util';

describe('isPrismaUniqueConflict', () => {
  it('detects Prisma P2002', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isPrismaUniqueConflict(new Error('fail'))).toBe(false);
    expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
    expect(isPrismaUniqueConflict(null)).toBe(false);
  });
});
