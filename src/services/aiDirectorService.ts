export const generateDirectorReport = async (data: {
  products: any[];
  orders: any[];
  stats: any;
  siteSettings: any;
  reviews: any[];
}) => {
  const res = await fetch('/api/admin/ai/director-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || 'AI director report failed');
  }

  return payload?.report || '';
};
