# Cấu trúc thư mục

```
backend/
├── src/
│   ├── main.ts                 # Bootstrap: pipe, filter, interceptor, CORS, Swagger
│   ├── app.module.ts           # Module gốc
│   ├── app.controller.ts       # Route ping kiểm tra service sống
│   ├── config/                 # Đọc & validate biến môi trường
│   │   ├── app.config.ts
│   │   ├── database.config.ts  # URL MongoDB (đọc bởi Mongoose)
│   │   ├── jwt.config.ts
│   │   ├── env.validation.ts   # Schema Joi
│   │   └── logger.config.ts    # Cấu hình Pino logger
│   ├── common/
│   │   ├── decorators/         # @Public, @Roles, @CurrentUser
│   │   ├── filters/            # http-exception.filter.ts
│   │   ├── guards/             # jwt-auth.guard.ts, roles.guard.ts
│   │   ├── interceptors/       # transform.interceptor.ts, logging.interceptor.ts
│   │   ├── middleware/         # correlation-id.middleware.ts
│   │   ├── dto/                # pagination.dto.ts, base-response.dto.ts
│   │   ├── constants/          # error-code.constant.ts
│   │   ├── exceptions/         # business.exception.ts
│   │   └── base/               # base.service.ts (CRUD generic trên Mongoose)
│   ├── database/               # Mọi thứ liên quan tới dữ liệu
│   │   ├── entities/
│   │   │   └── base.entity.ts  # BaseEntity (id, deletedAt, createdAt, updatedAt) + defaultSchemaOptions
│   │   ├── database.module.ts  # MongooseModule.forRootAsync (kết nối MongoDB)
│   │   └── seeds/              # Seed tài khoản admin mặc định
│   ├── health/                 # Health check (k8s probe): MongooseHealthIndicator
│   ├── modules/
│   │   ├── auth/               # Login, refresh token, JWT strategies, sessions, blacklist
│   │   │   └── entities/       # blacklisted-token, user-session, password-reset-token
│   │   ├── user/               # User management
│   │   │   └── entities/       # user.entity.ts
│   │   ├── health/             # Health module
│   │   └── meta/               # Version API
│   └── shared/                 # mail, etc.
├── test/                       # e2e test
├── docs/
├── .env.example / .env.dev
├── package.json
└── tsconfig.json
```
