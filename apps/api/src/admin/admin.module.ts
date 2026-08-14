import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminAdminsController } from './admins/admin-admins.controller';
import { AdminAdminsService } from './admins/admin-admins.service';
import { AdminAuditLogsController } from './audit-logs/admin-audit-logs.controller';
import { AdminAuditLogsService } from './audit-logs/admin-audit-logs.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminJwtStrategy } from './auth/strategies/admin-jwt.strategy';
import { AdminChatsController } from './chats/admin-chats.controller';
import { AdminChatsService } from './chats/admin-chats.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminMapController } from './map/admin-map.controller';
import { AdminMapService } from './map/admin-map.service';
import { AdminReportsController } from './reports/admin-reports.controller';
import { AdminReportsService } from './reports/admin-reports.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminWallController } from './wall/admin-wall.controller';
import { AdminWallService } from './wall/admin-wall.service';

@Module({
  imports: [
    AuthModule,
    VerificationModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ADMIN_SECRET', 'dev-admin-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ADMIN_EXPIRES', '8h'),
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminReportsController,
    AdminWallController,
    AdminAuditLogsController,
    AdminChatsController,
    AdminAdminsController,
    AdminMapController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminAuditService,
    AdminDashboardService,
    AdminUsersService,
    AdminReportsService,
    AdminWallService,
    AdminAuditLogsService,
    AdminChatsService,
    AdminAdminsService,
    AdminMapService,
  ],
})
export class AdminModule {}
