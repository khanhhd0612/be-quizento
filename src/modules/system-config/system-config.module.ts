import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemConfig, SystemConfigSchema } from './entities/system-config.entity';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { SystemConfigRepository } from './system-config.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: SystemConfig.name, schema: SystemConfigSchema }])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService, SystemConfigRepository],
  exports: [SystemConfigService, SystemConfigRepository, MongooseModule],
})
export class SystemConfigModule {}
