const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_CHARS = 250000;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be opened.'));
    image.src = src;
  });
}

function renderSquare(image, size, type, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is not available in this browser.');
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL(type, quality);
}

export async function prepareProfileImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.');
  }
  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  let output = renderSquare(image, 320, 'image/webp', 0.82);
  if (!output.startsWith('data:image/webp')) output = renderSquare(image, 320, 'image/jpeg', 0.82);
  if (output.length > MAX_PROFILE_IMAGE_CHARS) output = renderSquare(image, 256, 'image/jpeg', 0.68);
  if (output.length > MAX_PROFILE_IMAGE_CHARS) throw new Error('That image is still too large after resizing. Choose a simpler image.');
  return output;
}

export function profileInitial(displayName, email) {
  return String(displayName || email || '?').trim().charAt(0).toUpperCase() || '?';
}
