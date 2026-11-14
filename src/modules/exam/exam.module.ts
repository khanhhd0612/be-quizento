import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './entities/exam.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { ExamRepository } from './exam.repository';
import { SystemConfigModule } from '../system-config/system-config.module';
import { UploadModule } from '../upload/upload.module';
import { DailyQuotaModule } from '../daily-quota/daily-quota.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
    SystemConfigModule,
    UploadModule,
    DailyQuotaModule,
  ],
  controllers: [ExamController],
  providers: [ExamService, ExamRepository],
  exports: [ExamService, ExamRepository, MongooseModule],
})
export class ExamModule {}
