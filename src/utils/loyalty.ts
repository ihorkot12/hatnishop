export const BONUS_SPEND_LIMIT_RATE = 0.3;

export type LoyaltyTier = {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  minSpent: number;
  cashbackRate: number;
  tone: string;
};

export const loyaltyTiers: LoyaltyTier[] = [
  { id: 'bronze', name: 'Bronze', minSpent: 0, cashbackRate: 0.05, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
  { id: 'silver', name: 'Silver', minSpent: 5000, cashbackRate: 0.07, tone: 'text-slate-600 bg-slate-50 border-slate-200' },
  { id: 'gold', name: 'Gold', minSpent: 15000, cashbackRate: 0.1, tone: 'text-gold bg-gold/10 border-gold/20' },
];

export const getLoyaltyTier = (totalSpent = 0) => {
  const safeSpent = Math.max(0, Number(totalSpent) || 0);
  return [...loyaltyTiers].reverse().find((tier) => safeSpent >= tier.minSpent) || loyaltyTiers[0];
};

export const getNextLoyaltyTier = (totalSpent = 0) => {
  const safeSpent = Math.max(0, Number(totalSpent) || 0);
  return loyaltyTiers.find((tier) => safeSpent < tier.minSpent) || null;
};

export const getCashbackRate = (totalSpent = 0) => getLoyaltyTier(totalSpent).cashbackRate;

export const getLoyaltyProgress = (totalSpent = 0) => {
  const safeSpent = Math.max(0, Number(totalSpent) || 0);
  const current = getLoyaltyTier(safeSpent);
  const next = getNextLoyaltyTier(safeSpent);

  if (!next) {
    return {
      current,
      next,
      remaining: 0,
      progress: 100,
    };
  }

  const range = Math.max(1, next.minSpent - current.minSpent);
  const progress = Math.min(100, Math.max(0, ((safeSpent - current.minSpent) / range) * 100));

  return {
    current,
    next,
    remaining: Math.max(0, next.minSpent - safeSpent),
    progress,
  };
};

export const calculateBonusSpendLimit = (subtotalAfterPromo: number) =>
  Math.max(0, Math.floor((Number(subtotalAfterPromo) || 0) * BONUS_SPEND_LIMIT_RATE));

export const formatCashbackRate = (rate: number) => `${Math.round(rate * 100)}%`;
