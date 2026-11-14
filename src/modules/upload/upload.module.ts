import { Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [R2Service, UploadService],
  exports: [R2Service, UploadService],
})
export class UploadModule {}
