import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PracticeSession, PracticeSessionSchema } from './entities/practice-session.entity';
import { PracticeSessionController } from './practice-session.controller';
import { PracticeSessionService } from './practice-session.service';
import { PracticeSessionRepository } from './practice-session.repository';
import { ExamModule } from '@modules/exam/exam.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PracticeSession.name, schema: PracticeSessionSchema }]),
    ExamModule,
  ],
  controllers: [PracticeSessionController],
  providers: [PracticeSessionService, PracticeSessionRepository],
  exports: [PracticeSessionService, PracticeSessionRepository],
})
export class PracticeSessionModule {}
