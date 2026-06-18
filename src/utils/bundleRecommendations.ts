import { Product } from '../types';

type ProductLike = Omit<Product, 'isBundle' | 'reviewCount'> & {
  isBundle?: boolean | number | string;
  isbundle?: boolean | number | string;
  is_bundle?: boolean | number | string;
  reviewCount?: number;
  bundle_items?: string[];
  review_count?: number;
  bonus_points?: number;
};

const CATEGORY_COMPATIBILITY: Record<string, string[]> = {
  tableware: ['kitchen', 'textile', 'decor', 'organization'],
  kitchen: ['tableware', 'organization', 'textile'],
  textile: ['tableware', 'decor', 'kitchen'],
  organization: ['kitchen', 'tableware', 'textile'],
  bottles: ['kitchen', 'tableware', 'textile'],
  decor: ['tableware', 'textile', 'organization'],
};

const KEYWORD_COMPATIBILITY = [
  { base: ['кухоль', 'чаш', 'лате', 'кава'], pair: ['лож', 'сервет', 'килимок', 'цукорниц', 'таріл'] },
  { base: ['таріл', 'блюдо', 'салатник'], pair: ['видел', 'лож', 'склян', 'келих', 'сервет'] },
  { base: ['склян', 'келих', 'глечик'], pair: ['таріл', 'сервет', 'піднос', 'блюдо'] },
  { base: ['контейнер', 'ємн', 'банка'], pair: ['кошик', 'органайзер', 'лож', 'сито'] },
  { base: ['форма', 'деко', 'випіч'], pair: ['лопатк', 'пензлик', 'миска', 'сито'] },
  { base: ['кавовар'], pair: ['кухоль', 'чаш', 'лож', 'цукорниц'] },
  { base: ['кошик'], pair: ['контейнер', 'ємн', 'сервет', 'текстиль'] },
  { base: ['термос', 'пляш'], pair: ['контейнер', 'сервет', 'ланч', 'кухоль'] },
];

const normalize = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isBundle = (product: ProductLike) => {
  const rawValue = product.isBundle ?? product.isbundle ?? product.is_bundle;
  return rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true';
};

const hasAny = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const productText = (product: ProductLike) =>
  normalize([product.name, product.category, product.material, product.brand, product.description].filter(Boolean).join(' '));

const categoryScore = (baseCategory: string, candidateCategory: string) => {
  const compatible = CATEGORY_COMPATIBILITY[baseCategory] || [];
  const index = compatible.indexOf(candidateCategory);
  if (index >= 0) return 48 - index * 6;
  if (baseCategory === candidateCategory) return 18;
  return 0;
};

const keywordScore = (baseText: string, candidateText: string) => {
  let score = 0;
  for (const rule of KEYWORD_COMPATIBILITY) {
    if (hasAny(baseText, rule.base) && hasAny(candidateText, rule.pair)) score += 35;
    if (hasAny(candidateText, rule.base) && hasAny(baseText, rule.pair)) score += 18;
  }
  return score;
};

const priceScore = (basePrice: number, candidatePrice: number) => {
  if (!basePrice || !candidatePrice) return 0;
  const ratio = candidatePrice / basePrice;
  if (ratio >= 0.25 && ratio <= 1.4) return 16;
  if (ratio >= 0.12 && ratio <= 2.2) return 8;
  return 0;
};

export const suggestBundleItemsLocally = (
  baseProduct: ProductLike,
  allProducts: ProductLike[],
  options: { limit?: number; minStock?: number } = {}
) => {
  const limit = options.limit || 4;
  const minStock = options.minStock ?? 1;
  const baseText = productText(baseProduct);
  const baseCategory = normalize(baseProduct.category);
  const basePrice = Number(baseProduct.price || 0);
  const baseBrand = normalize(baseProduct.brand);

  return allProducts
    .filter((candidate) => {
      if (!candidate || candidate.id === baseProduct.id) return false;
      if (isBundle(candidate)) return false;
      if (Number(candidate.stock || 0) < minStock) return false;
      return true;
    })
    .map((candidate) => {
      const candidateText = productText(candidate);
      const candidateCategory = normalize(candidate.category);
      const candidateBrand = normalize(candidate.brand);
      let score = 0;

      score += categoryScore(baseCategory, candidateCategory);
      score += keywordScore(baseText, candidateText);
      score += priceScore(basePrice, Number(candidate.price || 0));
      if (baseBrand && candidateBrand && baseBrand === candidateBrand) score += 8;
      if (Number(candidate.stock || 0) > 2) score += 5;
      if (Number(candidate.rating || 0) >= 4.8) score += 4;

      return { product: candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.product.price || 0) - Number(b.product.price || 0))
    .slice(0, limit)
    .map(({ product }) => product);
};

export const suggestBundleItemIdsLocally = (
  baseProduct: ProductLike,
  allProducts: ProductLike[],
  options?: { limit?: number; minStock?: number }
) => suggestBundleItemsLocally(baseProduct, allProducts, options).map((product) => product.id);

export const calculateBundlePrice = (products: ProductLike[], discountRate = 0.15) => {
  const total = products.reduce((sum, product) => sum + Number(product.price || 0), 0);
  return Math.max(0, Math.round(total * (1 - discountRate)));
};
