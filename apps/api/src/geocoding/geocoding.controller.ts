import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Search places via Nominatim' })
  async search(@Query('q') q?: string) {
    if (!q?.trim()) {
      throw new BadRequestException('Query is required');
    }
    const data = await this.geocoding.search(q.trim());
    return { success: true, data };
  }

  @Get('reverse')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reverse geocode coordinates' })
  async reverse(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Valid lat and lng are required');
    }
    const data = await this.geocoding.reverse(latitude, longitude);
    return { success: true, data };
  }
}
