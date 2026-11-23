/**
 * Kompresi gambar sisi klien (maksimal ~500KB dan lebar maksimum 1280px)
 * sebelum diunggah ke server untuk menjaga performa loading saat ujian.
 */
export async function compressImageToDataUrl(
  file: File,
  maxBytes = 500 * 1024,
  maxDimension = 1280
): Promise<{ dataUrl: string; sizeBytes: number }> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(imageBitmap.width, imageBitmap.height)
  );
  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung Canvas 2D untuk kompresi gambar.');
  }
  // White backdrop for transparent PNGs converted to JPEG/WEBP
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  const mimeType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  let quality = 0.86;
  let dataUrl = canvas.toDataURL(mimeType, quality);

  const estimateBytes = (url: string) => {
    const base64Part = url.split(',')[1] || '';
    return Math.ceil((base64Part.length * 3) / 4);
  };

  while (estimateBytes(dataUrl) > maxBytes && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL(mimeType, quality);
  }

  return {
    dataUrl,
    sizeBytes: estimateBytes(dataUrl),
  };
}

export async function compressImageDataUrl(
  rawDataUrl: string,
  maxBytes = 500 * 1024,
  maxDimension = 1280
): Promise<{ dataUrl: string; sizeBytes: number }> {
  const response = await fetch(rawDataUrl);
  const blob = await response.blob();
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  const ext = mime.split('/')[1] || 'png';
  const file = new File([blob], `word_img.${ext}`, { type: mime });
  return compressImageToDataUrl(file, maxBytes, maxDimension);
}

