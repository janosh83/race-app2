import { resizeImageWithExif } from './image';
import piexif from 'piexifjs';

vi.mock('piexifjs', () => {
  const passthrough = vi.fn((_, dataUrl) => dataUrl);
  const dump = vi.fn(() => '');
  const load = vi.fn(() => ({}));
  return {
    __esModule: true,
    default: { insert: passthrough, dump, load },
    insert: passthrough,
    dump,
    load,
  };
});

const tinyPngDataUrl =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9pibYKgAAAAASUVORK5CYII=';

const tinyJpegDataUrl =
  'data:image/jpeg;base64,' +
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEBUQEhIVFRUVFRUVFRUVFRUVFRUXFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAoAMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABQYBAwQCB//EADkQAAEDAgQDBwIEBQUAAAAAAAEAAgMEEQUSITFBURNhcQYigZHB0SIyobHB8BQjQlLxFf/EABoBAQADAQEBAAAAAAAAAAAAAAABAgMEBQb/xAAoEQEAAgIBAwMEAwAAAAAAAAAAAQIDEQQSITEFE0FRFCIyYYH/2gAMAwEAAhEDEQA/ANZqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=';

function dataUrlToFile(dataUrl, name) {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)[1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new File([bytes], name, { type: mime });
}

const OriginalImage = global.Image;
const mockContext = { drawImage: vi.fn() };

const ensureToBlob = () => {
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    callback(new Blob([bytes], { type: type || 'image/png' }));
  };
};

beforeAll(() => {
  ensureToBlob();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => mockContext),
  });
  global.Image = class MockImage {
    constructor() {
      this.width = 20;
      this.height = 12;
      this.onload = null;
      this.onerror = null;
    }
    set src(_) {
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }
  };
});

afterAll(() => {
  global.Image = OriginalImage;
});

describe('resizeImageWithExif', () => {
  it('returns resized file and preview for JPEG, preserving mime', async () => {
    const file = dataUrlToFile(tinyJpegDataUrl, 'tiny.jpg');
    const { resizedFile, previewDataUrl } = await resizeImageWithExif(file, { maxSize: 10 });

    expect(resizedFile).toBeInstanceOf(File);
    expect(resizedFile.type).toBe('image/jpeg');
    expect(previewDataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(piexif.load).toHaveBeenCalled();
  });

  it('returns resized file and preview for PNG, preserving mime', async () => {
    const file = dataUrlToFile(tinyPngDataUrl, 'tiny.png');
    const { resizedFile, previewDataUrl } = await resizeImageWithExif(file, { maxSize: 10 });

    expect(resizedFile).toBeInstanceOf(File);
    expect(resizedFile.type).toBe('image/png');
    expect(previewDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects on invalid data URL', async () => {
    const badFile = new File([new Uint8Array([1, 2, 3])], 'bad.bin', { type: 'application/octet-stream' });
    await expect(resizeImageWithExif(badFile)).rejects.toThrow();
  });
});
