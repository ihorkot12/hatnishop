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
    throw new Error(data?.error || 'AI request failed');
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
