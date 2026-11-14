# Database (MongoDB + Mongoose)

Dự án dùng **Mongoose** (`@nestjs/mongoose`) kết nối **MongoDB** với các Entity kế thừa từ `BaseEntity`.

## Cấu trúc
- `src/database/entities/base.entity.ts`:
  - `BaseEntity`: Khai báo các trường chung `id`, `deletedAt` (soft delete), `createdAt`, `updatedAt`.
  - `defaultSchemaOptions` / `createSchemaOptions`: Cấu hình schema chung (`timestamps: true`, serialize `_id` thành `id`, bỏ `__v`).
- `src/database/database.module.ts`: `@Global()` module, cấu hình `MongooseModule.forRootAsync` từ `database.url`.
- `src/modules/*/entities/*.entity.ts`: Khai báo Entity cho từng module (User, BlacklistedToken, UserSession, PasswordResetToken).
- `src/database/seeds/run-seed.ts`: Script seed dữ liệu khởi tạo (tài khoản admin mặc định).

## Lệnh thường dùng
```bash
# Seed dữ liệu mẫu (tạo admin mặc định)
npm run seed
```
