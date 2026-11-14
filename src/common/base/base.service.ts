import { HttpStatus } from '@nestjs/common';
import { FilterQuery, Model, UpdateQuery, isValidObjectId } from 'mongoose';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { PaginatedResult, PaginationQueryDto } from '@common/dto/pagination.dto';
import { BaseEntity } from '@/database/entities/base.entity';

/**
 * BaseService<T> cung cấp sẵn các thao tác CRUD cơ bản dùng chung cho các module nghiệp vụ,
 * hoạt động trên nền MongoDB qua Mongoose (hỗ trợ phân trang và soft-delete bằng field `deletedAt`).
 */
export abstract class BaseService<T extends BaseEntity = any> {
  protected constructor(
    protected readonly model: Model<T>,
    protected readonly notFoundErrorCode: ErrorCode = ErrorCode.NOT_FOUND,
  ) {}

  async create(data: any): Promise<T> {
    const created = await this.model.create(data);
    return created.toObject ? (created.toObject() as T) : (created as unknown as T);
  }

  async findAll(
    query: PaginationQueryDto,
    filter: FilterQuery<T> = {},
  ): Promise<PaginatedResult<T>> {
    const finalFilter: FilterQuery<T> = { ...filter, deletedAt: null };

    const [items, totalItems] = await Promise.all([
      this.model
        .find(finalFilter)
        .skip(query.skip)
        .limit(query.limit)
        .sort({ [query.sortBy]: query.sortOrder.toLowerCase() === 'asc' ? 1 : -1 })
        .lean({ virtuals: true })
        .exec(),
      this.model.countDocuments(finalFilter).exec(),
    ]);

    return new PaginatedResult(items as unknown as T[], totalItems, query);
  }

  async findOneOrFail(id: string): Promise<T> {
    if (!isValidObjectId(id)) {
      throw new BusinessException(
        this.notFoundErrorCode,
        HttpStatus.NOT_FOUND,
        ErrorMessage[this.notFoundErrorCode],
      );
    }

    const entity = await this.model
      .findOne({ _id: id, deletedAt: null } as FilterQuery<T>)
      .lean({ virtuals: true })
      .exec();

    if (!entity) {
      throw new BusinessException(
        this.notFoundErrorCode,
        HttpStatus.NOT_FOUND,
        ErrorMessage[this.notFoundErrorCode],
      );
    }

    return entity as unknown as T;
  }

  async update(id: string, data: UpdateQuery<T>): Promise<T> {
    await this.findOneOrFail(id);

    const updated = await this.model
      .findByIdAndUpdate(id, data, { new: true })
      .lean({ virtuals: true })
      .exec();

    return updated as unknown as T;
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.model.findByIdAndUpdate(id, { deletedAt: new Date() } as UpdateQuery<T>).exec();
  }
}
