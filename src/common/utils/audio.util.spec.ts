import {
  estimateMp3Duration,
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_MIME_TYPES,
} from './audio.util';

describe('AudioUtil', () => {
  describe('constants', () => {
    it('định nghĩa đúng phần mở rộng và mime types của audio', () => {
      expect(ALLOWED_AUDIO_EXTENSIONS).toContain('.mp3');
      expect(ALLOWED_AUDIO_MIME_TYPES).toContain('audio/mpeg');
      expect(ALLOWED_AUDIO_MIME_TYPES).toContain('audio/mp3');
    });
  });

  describe('estimateMp3Duration', () => {
    it('trả về null nếu buffer null hoặc độ dài < 4', () => {
      expect(estimateMp3Duration(null as any)).toBeNull();
      expect(estimateMp3Duration(Buffer.alloc(3))).toBeNull();
    });

    it('trả về null nếu buffer không có MP3 frame sync', () => {
      const randomBuf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(estimateMp3Duration(randomBuf)).toBeNull();
    });

    it('ước lượng thời lượng hợp lệ khi có MPEG-1 Layer 3 frame header', () => {
      // MPEG-1 Layer 3, 128 kbps (bitrate index 9 = 1001b = 0x90):
      // Byte 0: 0xFF, Byte 1: 0xFB (1111 1011: sync 11111111 111, version MPEG1 (11), layer III (01))
      // Byte 2: 0x90 (1001 0000: bitrate 128kbps (1001))
      // Byte 3: 0x00
      // 128 kbps = 16,000 bytes/second
      const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
      const padding = Buffer.alloc(32000 - 4); // tổng 32,000 bytes = 2 giây tại 128kbps
      const fullBuffer = Buffer.concat([frameHeader, padding]);

      const duration = estimateMp3Duration(fullBuffer);
      expect(duration).toBeCloseTo(2, 1);
    });

    it('bỏ qua ID3v2 tag và tính toán thời lượng', () => {
      // ID3v2 header: 'ID3', version 3.0, flags 0, syncsafe size (10 bytes id3 body)
      const id3Header = Buffer.from([
        0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a,
      ]);
      const id3Body = Buffer.alloc(10);
      const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
      const padding = Buffer.alloc(16000 - 4);
      const fullBuffer = Buffer.concat([id3Header, id3Body, frameHeader, padding]);

      const duration = estimateMp3Duration(fullBuffer);
      expect(duration).toBeCloseTo(1, 1);
    });
  });
});
