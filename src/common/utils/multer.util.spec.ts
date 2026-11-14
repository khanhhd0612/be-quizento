import { imageFileFilter, createMulterImageOptions } from './multer.util';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('Multer Util', () => {
  describe('imageFileFilter', () => {
    it('chấp nhận file ảnh hợp lệ (PNG)', (done) => {
      const mockFile = {
        originalname: 'test-image.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      imageFileFilter(null, mockFile, (error, accept) => {
        expect(error).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('chấp nhận file ảnh hợp lệ (JPG/JPEG)', (done) => {
      const mockFile = {
        originalname: 'photo.jpeg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      imageFileFilter(null, mockFile, (error, accept) => {
        expect(error).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('chấp nhận file ảnh hợp lệ (WEBP)', (done) => {
      const mockFile = {
        originalname: 'banner.webp',
        mimetype: 'image/webp',
      } as Express.Multer.File;

      imageFileFilter(null, mockFile, (error, accept) => {
        expect(error).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('từ chối file không phải ảnh (PDF)', (done) => {
      const mockFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      imageFileFilter(null, mockFile, (error, accept) => {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(ErrorCode.FILE_INVALID_TYPE);
        expect(accept).toBe(false);
        done();
      });
    });

    it('từ chối file có extension giả mạo (file.exe với mime image/png)', (done) => {
      const mockFile = {
        originalname: 'malicious.exe',
        mimetype: 'image/png',
      } as Express.Multer.File;

      imageFileFilter(null, mockFile, (error, accept) => {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(ErrorCode.FILE_INVALID_TYPE);
        expect(accept).toBe(false);
        done();
      });
    });

    it('từ chối nếu không truyền file', (done) => {
      imageFileFilter(null, null as any, (error, accept) => {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(accept).toBe(false);
        done();
      });
    });
  });

  describe('createMulterImageOptions', () => {
    it('tạo cấu hình multer với memoryStorage và limit hợp lệ', () => {
      const options = createMulterImageOptions(10 * 1024 * 1024);
      expect(options.storage).toBeDefined();
      expect(options.limits?.fileSize).toBe(10 * 1024 * 1024);
      expect(options.fileFilter).toBe(imageFileFilter);
    });
  });
});
