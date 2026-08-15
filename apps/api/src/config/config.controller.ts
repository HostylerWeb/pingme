import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from './app-config.service';

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public app configuration (distance limits, feature flags later)' })
  getConfig() {
    return {
      success: true,
      data: this.appConfig.getAppConfig(),
    };
  }
}
