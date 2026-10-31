import piexif from 'piexifjs';

import { logger } from './logger';

const readAsDataUrl = (input) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(input);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.onload = () => resolve(img);
    img.src = src;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error('Failed to convert image data');
  }
  return res.blob();
};

const pick = (source = {}, tags) =>
  Object.fromEntries(tags.filter(tag => tag in source).map(tag => [tag, source[tag]]));

// Camera and capture details worth keeping when the full EXIF can't be written.
const ESSENTIAL_IMAGE_TAGS = [
  piexif.ImageIFD.Make,
  piexif.ImageIFD.Model,
  piexif.ImageIFD.Software,
  piexif.ImageIFD.DateTime,
];
const ESSENTIAL_EXIF_TAGS = [
  piexif.ExifIFD.DateTimeOriginal,
  piexif.ExifIFD.DateTimeDigitized,
  piexif.ExifIFD.ExposureTime,
  piexif.ExifIFD.FNumber,
  piexif.ExifIFD.ISOSpeedRatings,
  piexif.ExifIFD.FocalLength,
  piexif.ExifIFD.LensModel,
];

/**
 * Adapt the original EXIF to the resized image:
 * - Orientation is reset to 1: browsers apply the EXIF orientation when they
 *   draw the photo onto the canvas, so the resized pixels are already upright.
 *   Keeping the original value made viewers rotate the photo a second time
 *   (portrait phone photos ended up upside down).
 * - The embedded thumbnail (still in the original orientation) is dropped.
 * - The pixel dimensions are updated to the resized size.
 */
export function exifForResizedImage(exifObj, width, height) {
  return {
    '0th': { ...exifObj['0th'], [piexif.ImageIFD.Orientation]: 1 },
    Exif: {
      ...exifObj.Exif,
      [piexif.ExifIFD.PixelXDimension]: width,
      [piexif.ExifIFD.PixelYDimension]: height,
    },
    GPS: { ...exifObj.GPS },
    Interop: { ...exifObj.Interop },
    thumbnail: null,
  };
}

/**
 * Serialize EXIF, falling back to fewer tags when piexif can't write some of
 * them (e.g. unusual maker-specific values), so GPS and camera details
 * survive instead of all EXIF being dropped. Returns '' when nothing can be written.
 */
export function dumpExifSafely(exifObj) {
  const attempts = [
    ['full', exifObj],
    ['essential', {
      '0th': { ...pick(exifObj['0th'], ESSENTIAL_IMAGE_TAGS), [piexif.ImageIFD.Orientation]: 1 },
      Exif: pick(exifObj.Exif, [...ESSENTIAL_EXIF_TAGS, piexif.ExifIFD.PixelXDimension, piexif.ExifIFD.PixelYDimension]),
      GPS: { ...exifObj.GPS },
    }],
    ['gps-only', { '0th': { [piexif.ImageIFD.Orientation]: 1 }, GPS: { ...exifObj.GPS } }],
  ];
  for (const [level, candidate] of attempts) {
    try {
      const dumped = piexif.dump(candidate);
      if (level !== 'full') logger.warn('IMAGE', `Kept only ${level} EXIF of the photo`);
      return dumped;
    } catch (err) {
      logger.warn('IMAGE', `Failed to write ${level} EXIF`, err?.message || err);
    }
  }
  return '';
}

// The backend accepts only jpg/jpeg/png/gif, and the extension must match the
// content after a WebP/GIF/... has been re-encoded as JPEG.
export function resizedFileName(name, mime) {
  if (mime !== 'image/jpeg') return name;
  if (/\.jpe?g$/i.test(name)) return name;
  const base = name.replace(/\.[^./\\]*$/, '') || 'photo';
  return `${base}.jpg`;
}

// Resize an image to a max dimension while preserving EXIF for JPEGs.
// Returns { resizedFile, previewDataUrl }.
export async function resizeImageWithExif(file, { maxSize = 1000, quality = 0.9 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file');
  }

  const originalDataUrl = await readAsDataUrl(file);
  let exifObj = null;

  if (file.type === 'image/jpeg') {
    try {
      exifObj = piexif.load(originalDataUrl);
    } catch (err) {
      logger.warn('IMAGE', 'Failed to read photo EXIF; uploading without it', err?.message || err);
    }
  }

  const img = await loadImage(originalDataUrl);
  let { width, height } = img;

  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height >= width && height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, height);
  }

  const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const resizedBlob = await canvasToBlob(
    canvas,
    targetMime,
    targetMime === 'image/jpeg' ? quality : undefined
  );
  const resizedDataUrl = await readAsDataUrl(resizedBlob);
  const exifStr = targetMime === 'image/jpeg' && exifObj
    ? dumpExifSafely(exifForResizedImage(exifObj, width, height))
    : '';
  const previewDataUrl = exifStr ? piexif.insert(exifStr, resizedDataUrl) : resizedDataUrl;

  const finalBlob = await dataUrlToBlob(previewDataUrl);
  const resizedFile = new File([finalBlob], resizedFileName(file.name, targetMime), {
    type: finalBlob.type || targetMime,
  });

  return { resizedFile, previewDataUrl };
}
