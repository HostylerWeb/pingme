import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GeocodingResult = {
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private lastRequestAt = 0;

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<GeocodingResult[]> {
    await this.throttle();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': this.getUserAgent() },
    });

    if (!response.ok) {
      this.logger.warn(`Nominatim search failed: ${response.status}`);
      throw new ServiceUnavailableException('Geocoding service unavailable');
    }

    const results = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      name?: string;
    }>;

    return results.map((item) => ({
      placeName: item.name ?? item.display_name.split(',')[0] ?? query,
      address: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }));
  }

  async reverse(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    await this.throttle();
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': this.getUserAgent() },
    });

    if (!response.ok) {
      this.logger.warn(`Nominatim reverse failed: ${response.status}`);
      throw new ServiceUnavailableException('Geocoding service unavailable');
    }

    const result = (await response.json()) as {
      display_name?: string;
      name?: string;
      lat?: string;
      lon?: string;
    };

    if (!result.display_name) {
      return null;
    }

    return {
      placeName: result.name ?? result.display_name.split(',')[0] ?? 'Selected location',
      address: result.display_name,
      latitude: Number(result.lat ?? latitude),
      longitude: Number(result.lon ?? longitude),
    };
  }

  private getUserAgent(): string {
    return this.config.get<string>('NOMINATIM_USER_AGENT', 'PingMe/1.0 (events geocoding)');
  }

  private async throttle() {
    const minIntervalMs = 1100;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
