import piexif from 'piexifjs';

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

// Resize an image to a max dimension while preserving EXIF for JPEGs.
// Returns { resizedFile, previewDataUrl }.
export async function resizeImageWithExif(file, { maxSize = 1000, quality = 0.9 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file');
  }

  const originalDataUrl = await readAsDataUrl(file);
  let exifStr = '';

  if (file.type === 'image/jpeg') {
    try {
      const exifObj = piexif.load(originalDataUrl);
      exifStr = piexif.dump(exifObj);
    } catch {
      exifStr = '';
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
  const previewDataUrl =
    targetMime === 'image/jpeg' && exifStr
      ? piexif.insert(exifStr, resizedDataUrl)
      : resizedDataUrl;

  const finalBlob = await dataUrlToBlob(previewDataUrl);
  const resizedFile = new File([finalBlob], file.name, {
    type: finalBlob.type || targetMime,
  });

  return { resizedFile, previewDataUrl };
}
