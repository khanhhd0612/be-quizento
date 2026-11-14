import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyQuota, DailyQuotaSchema } from './entities/daily-quota.entity';
import { User, UserSchema } from '@modules/user/entities/user.entity';
import { SystemConfigModule } from '@modules/system-config/system-config.module';
import { DailyQuotaController } from './daily-quota.controller';
import { DailyQuotaService } from './daily-quota.service';
import { DailyQuotaRepository } from './daily-quota.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyQuota.name, schema: DailyQuotaSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SystemConfigModule,
  ],
  controllers: [DailyQuotaController],
  providers: [DailyQuotaService, DailyQuotaRepository],
  exports: [DailyQuotaService, DailyQuotaRepository],
})
export class DailyQuotaModule {}
