import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * DatabaseModule kết nối MongoDB thông qua Mongoose.
 * Được đánh dấu @Global() để cung cấp kết nối cho toàn bộ ứng dụng.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.url'),
        autoIndex: configService.get<string>('app.env') !== 'production',
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
