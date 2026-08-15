import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { ConfigController } from './config.controller';

@Global()
@Module({
  controllers: [ConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
