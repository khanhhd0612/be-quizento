import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User, UserSchema } from '../../modules/user/entities/user.entity';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'dev'}` });

/**
 * Seed dữ liệu khởi tạo: tài khoản admin mặc định.
 * Chạy: npm run seed
 */
async function runSeed() {
  const mongoUri = process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error('DATABASE_URL chưa được thiết lập trong biến môi trường');
  }

  await mongoose.connect(mongoUri);
  console.log('Đã kết nối MongoDB thành công');

  const UserModel = mongoose.models[User.name] || mongoose.model(User.name, UserSchema);

  const existing = await UserModel.findOne({ email: 'admin@example.com' });

  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await UserModel.create({
      email: 'admin@example.com',
      password: passwordHash,
      fullName: 'Administrator',
      role: 'admin',
      isActive: true,
      deletedAt: null,
    });
    console.log('Seed thành công: đã tạo tài khoản admin@example.com / Admin@123');
  } else {
    console.log('Tài khoản admin đã tồn tại, bỏ qua seed');
  }
}

runSeed()
  .catch((err) => {
    console.error('Seed thất bại:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
