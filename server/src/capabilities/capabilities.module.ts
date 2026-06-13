import { Module } from '@nestjs/common';
import { CapabilitiesController } from './capabilities.controller';

@Module({
  controllers: [CapabilitiesController],
})
export class CapabilitiesModule {}
