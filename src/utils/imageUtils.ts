export const resizeImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const dataUrlByteSize = (value: string) => {
  const match = String(value || '').match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) return 0;
  return Math.floor((match[1].length * 3) / 4);
};

export const compressDataUrl = (
  dataUrl: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; targetBytes?: number } = {}
): Promise<string> => {
  if (!String(dataUrl || '').startsWith('data:image/')) return Promise.resolve(dataUrl);

  const {
    maxWidth = 1100,
    maxHeight = 1100,
    quality = 0.76,
    targetBytes = 650 * 1024,
  } = options;

  if (dataUrlByteSize(dataUrl) > 0 && dataUrlByteSize(dataUrl) <= targetBytes) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      const fitInto = (limitWidth: number, limitHeight: number) => {
        const ratio = Math.min(1, limitWidth / width, limitHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      };

      fitInto(maxWidth, maxHeight);

      let output = dataUrl;
      let currentQuality = quality;
      let shrink = 1;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * shrink));
        canvas.height = Math.max(1, Math.round(height * shrink));
        const ctx = canvas.getContext('2d');
        if (!ctx) break;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        output = canvas.toDataURL('image/jpeg', currentQuality);

        if (dataUrlByteSize(output) <= targetBytes) break;
        if (currentQuality > 0.52) {
          currentQuality -= 0.08;
        } else {
          shrink *= 0.82;
        }
      }

      resolve(output);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

export const fileToBase64 = async (file: File): Promise<string> => {
  // If file is larger than 500KB, resize it
  if (file.size > 500 * 1024) {
    try {
      return await compressDataUrl(await resizeImage(file), {
        maxWidth: 1100,
        maxHeight: 1100,
        quality: 0.74,
        targetBytes: 560 * 1024,
      });
    } catch (e) {
      console.error('Resize failed, falling back to original', e);
    }
  }
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
  return compressDataUrl(original, {
    maxWidth: 1100,
    maxHeight: 1100,
    quality: 0.74,
    targetBytes: 560 * 1024,
  });
};
