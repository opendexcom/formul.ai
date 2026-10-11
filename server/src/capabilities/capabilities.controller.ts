import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getCapabilities } from '@opendexcom/plugin-interface';

@ApiTags('capabilities')
@Controller('capabilities')
export class CapabilitiesController {
  @Get()
  getCapabilities() {
    return { features: getCapabilities() };
  }
}
