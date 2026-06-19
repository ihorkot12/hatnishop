const postAI = async <T,>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || 'AI request failed'), {
      status: res.status,
      data,
    });
  }

  return data as T;
};

export const generateDescription = async (name: string, category: string) => {
  const data = await postAI<{ text: string }>('/api/admin/ai/description', { name, category });
  return data.text;
};

export const generateStylingTip = async (name: string, category: string) => {
  const data = await postAI<{ text: string }>('/api/admin/ai/styling-tip', { name, category });
  return data.text;
};

export const generateProductImage = async (name: string, category: string, base64Image?: string) => {
  const data = await postAI<{ image: string }>('/api/admin/ai/product-image', { name, category, base64Image });
  return data.image;
};

export const generateProductGallery = async (name: string, category: string, base64Image?: string, count = 3) => {
  const data = await postAI<{ images: string[] }>('/api/admin/ai/product-gallery', {
    name,
    category,
    base64Image,
    count,
  });
  return data.images || [];
};

export const searchProductWebImages = async (name: string, category: string, limit = 8) => {
  try {
    return await postAI<{
      configured: boolean;
      provider: string;
      query: string;
      openSearchUrl: string;
      candidates: Array<{ url: string; title: string; source: string }>;
    }>('/api/admin/images/search-web', { name, category, limit });
  } catch (error: any) {
    if (error?.status === 428 && error?.data) {
      return error.data as {
        configured: boolean;
        provider: string;
        query: string;
        openSearchUrl: string;
        candidates: Array<{ url: string; title: string; source: string }>;
      };
    }
    throw error;
  }
};

export const saveWebImageForProduct = async (productId: string) => {
  return postAI<{ product: any; candidate: { url: string; title: string; source: string }; openSearchUrl?: string }>(
    `/api/admin/products/${productId}/web-image`,
    {}
  );
};

export const generateAndSaveProductImage = async (productId: string) => {
  return postAI<{ product: any; image: string; provider: string; model: string }>(
    `/api/admin/products/${productId}/ai-main-image`,
    {}
  );
};

export const generateAndSaveProductGallery = async (productId: string, count = 3) => {
  return postAI<{ product: any; images: string[]; provider: string; model: string }>(
    `/api/admin/products/${productId}/ai-gallery`,
    { count }
  );
};

export const suggestBundleItems = async (productName: string, productCategory: string, allProducts: any[]) => {
  const data = await postAI<{ items: string[] }>('/api/admin/ai/bundle-items', {
    productName,
    productCategory,
    allProducts,
  });
  return data.items;
};

export const chatWithAI = async () => {
  throw new Error('Chat AI is not available in this build');
};
