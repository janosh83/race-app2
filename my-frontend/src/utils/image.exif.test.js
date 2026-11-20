// Uses the real piexifjs (image.test.js mocks it) to check the EXIF written
// into resized photos.
import piexif from 'piexifjs';

import { dumpExifSafely, exifForResizedImage, resizedFileName, resizeImageWithExif } from './image';

// 1x1 JPEG without EXIF; stands in for both the original photo and the canvas output.
const tinyJpegBase64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////' +
  '2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAA' +
  'AAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AN//Z';
const tinyJpegDataUrl = `data:image/jpeg;base64,${tinyJpegBase64}`;
const tinyJpegBinary = atob(tinyJpegBase64);

const PADDING_TAG = 59932; // written by Windows tools, unknown to piexifjs

function phoneExif(extra0th = {}) {
  return {
    '0th': {
      [piexif.ImageIFD.Make]: 'Pixel',
      [piexif.ImageIFD.Model]: 'Pixel 9',
      [piexif.ImageIFD.Orientation]: 6,
      ...extra0th,
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: '2026:10:31 10:00:00',
      [piexif.ExifIFD.PixelXDimension]: 4000,
      [piexif.ExifIFD.PixelYDimension]: 3000,
    },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: 'N',
      [piexif.GPSIFD.GPSLatitude]: [[50, 1], [5, 1], [30, 1]],
      [piexif.GPSIFD.GPSLongitudeRef]: 'E',
      [piexif.GPSIFD.GPSLongitude]: [[14, 1], [25, 1], [0, 1]],
    },
    '1st': { [piexif.ImageIFD.Orientation]: 6 },
    thumbnail: tinyJpegBinary,
  };
}

function dataUrlToFile(dataUrl, name) {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)[1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new File([bytes], name, { type: mime });
}

const OriginalImage = global.Image;

beforeAll(() => {
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
    callback(dataUrlToFile(tinyJpegDataUrl, 'canvas.jpg'));
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({ drawImage: vi.fn() })),
  });
  // Browsers report the size after applying the EXIF orientation (portrait).
  global.Image = class MockImage {
    constructor() {
      this.width = 3000;
      this.height = 4000;
    }

    set src(_) {
      setTimeout(() => this.onload?.(), 0);
    }
  };
});

afterAll(() => {
  global.Image = OriginalImage;
});

describe('resizeImageWithExif EXIF handling', () => {
  it('keeps camera info and GPS but resets orientation, thumbnail and size', async () => {
    const photo = dataUrlToFile(piexif.insert(piexif.dump(phoneExif()), tinyJpegDataUrl), 'IMG_0001.jpg');

    const { resizedFile, previewDataUrl } = await resizeImageWithExif(photo, { maxSize: 1000 });
    const exif = piexif.load(previewDataUrl);

    expect(resizedFile.name).toBe('IMG_0001.jpg');
    expect(exif['0th'][piexif.ImageIFD.Orientation]).toBe(1);
    expect(exif['0th'][piexif.ImageIFD.Model]).toBe('Pixel 9');
    expect(exif.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe('2026:10:31 10:00:00');
    expect(exif.Exif[piexif.ExifIFD.PixelXDimension]).toBe(750);
    expect(exif.Exif[piexif.ExifIFD.PixelYDimension]).toBe(1000);
    expect(exif.GPS[piexif.GPSIFD.GPSLatitude]).toEqual([[50, 1], [5, 1], [30, 1]]);
    expect(exif.GPS[piexif.GPSIFD.GPSLongitudeRef]).toBe('E');
    expect(exif.thumbnail).toBeNull();
  });

  it('keeps GPS and camera info when the full EXIF cannot be written', () => {
    const exifObj = exifForResizedImage(phoneExif({ [PADDING_TAG]: 'x' }), 750, 1000);

    const exif = piexif.load(piexif.insert(dumpExifSafely(exifObj), tinyJpegDataUrl));

    expect(exif['0th'][PADDING_TAG]).toBeUndefined();
    expect(exif['0th'][piexif.ImageIFD.Make]).toBe('Pixel');
    expect(exif['0th'][piexif.ImageIFD.Orientation]).toBe(1);
    expect(exif.GPS[piexif.GPSIFD.GPSLatitudeRef]).toBe('N');
  });
});

describe('resizedFileName', () => {
  it('gives re-encoded JPEGs a .jpg extension', () => {
    expect(resizedFileName('photo.webp', 'image/jpeg')).toBe('photo.jpg');
    expect(resizedFileName('anim.GIF', 'image/jpeg')).toBe('anim.jpg');
    expect(resizedFileName('noext', 'image/jpeg')).toBe('noext.jpg');
    expect(resizedFileName('IMG.JPEG', 'image/jpeg')).toBe('IMG.JPEG');
    expect(resizedFileName('shot.png', 'image/png')).toBe('shot.png');
  });
});
