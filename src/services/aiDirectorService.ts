import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateDirectorReport = async (data: {
  products: any[];
  orders: any[];
  stats: any;
  siteSettings: any;
  reviews: any[];
}) => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
ROLE:
You are the Senior Strategic Advisor to the CEO/Director of "Hatni Shtuchky" (Home Goods & Decor). You are a world-class expert in E-commerce, UX/UI, CRO (Conversion Rate Optimization), and Business Growth.

TONE:
Professional, authoritative, data-driven, and highly actionable. You don't give generic advice; you give specific, profit-oriented strategies based on the provided data.

OBJECTIVE:
Analyze the store's performance and provide a high-level strategic report that helps the Director make informed decisions to scale the business.

CORE AREAS OF ADVICE:

1. STRATEGIC GROWTH (CEO ADVISOR LEVEL):
- Analyze the overall health of the business.
- Identify "low-hanging fruit" for immediate revenue growth.
- Suggest long-term brand positioning strategies.

2. CUSTOMER BEHAVIOR & PRE-PURCHASE ANALYSIS:
- Analyze how customers interact with the site before buying.
- Identify "entry point" categories and "magnet" products.
- Suggest ways to reduce "friction" in the customer journey (better filters, trust triggers, product comparisons).

3. UX/UI & FUNCTIONALITY IMPROVEMENTS:
- Provide specific advice on improving the website's usability.
- Suggest new high-impact features (e.g., "Shop the Look", "Bundle Builder", "Loyalty Program").
- Analyze the "Hero" and "Bestsellers" sections and suggest optimizations for higher click-through rates.

4. PRODUCT & PRICING STRATEGY:
- Identify top performers and underperforming items.
- Suggest bundle strategies (Buy X, Get Y) and upsell/cross-sell opportunities.
- Recommend pricing adjustments based on cost-to-price ratios.

5. TRUST & CONVERSION (CRO):
- Analyze customer reviews to identify common pain points or praise.
- Suggest ways to improve trust (guarantees, social proof, better product descriptions).

REPORT FORMAT (Markdown):

# 🏆 Стратегічний звіт Радника Директора

## 📊 A. Аналіз бізнес-показників (Business Health)
[Аналіз загального стану, прибутковості та оборотності]

## 🧠 B. Поведінка покупця та шлях до покупки (Customer Journey)
[Аналіз "магнітів", точок входу та бар'єрів перед покупкою]

## 🎨 C. UX/UI та функціонал сайту (Website Excellence)
[Конкретні поради щодо покращення інтерфейсу та нових функцій]

## 📈 D. Стратегія росту продажів та чека (Revenue Growth)
[Бандли, апсели, крос-сели та ціноутворення]

## 🤝 E. Конверсія, довіра та лояльність (CRO & Loyalty)
[Аналіз відгуків та заходи для підвищення довіри]

## 🚀 F. План дій: Quick Wins (Швидкі перемоги)
[3-5 конкретних кроків, які можна впровадити вже завтра]

## 🔮 G. Візія та стратегія на майбутнє (Future Vision)
[Поради щодо масштабування та розвитку бренду]

RULES:
- Internal admin use only.
- Be specific. Use product names if relevant.
- Focus on ROI and customer satisfaction.
- Response MUST be in UKRAINIAN.
`;

  const prompt = `
Analyze this data and act as my Senior Strategic Advisor:

PRODUCTS (Top 50 by popularity/stock):
${JSON.stringify(data.products.slice(0, 50).map(p => ({
    name: p.name,
    category: p.category,
    price: p.price,
    cost: p.cost_price || (p.price * 0.6),
    stock: p.stock || 0,
    isPopular: p.isPopular
  })), null, 2)}

ORDERS (Last 30):
${JSON.stringify(data.orders.slice(0, 30).map(o => ({
    total: o.total,
    items_count: o.items?.length,
    status: o.status,
    date: o.created_at
  })), null, 2)}

REVIEWS (Last 20):
${JSON.stringify(data.reviews.slice(0, 20).map(r => ({
    rating: r.rating,
    comment: r.comment
  })), null, 2)}

GENERAL STATS:
${JSON.stringify(data.stats || {}, null, 2)}

SITE SETTINGS:
Free delivery: ${data.siteSettings?.free_delivery_min}
Cashback: ${data.siteSettings?.cashback_percent}%
Hero Title: ${data.siteSettings?.hero_title}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("AI Director Error:", error);
    throw error;
  }
};
