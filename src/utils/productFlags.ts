export const readBooleanFlag = (value: unknown) => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const isBundleProduct = (product?: Record<string, unknown> | null) => {
  if (!product) return false;
  return readBooleanFlag(product.isBundle ?? product.isbundle ?? product.is_bundle);
};

// Єдина перевірка наявності. Без неї товар із нульовим залишком можна було додати
// в кошик зі сторінки товару, QuickView і "товару дня" в Hero.
export const isOutOfStock = (product?: Record<string, unknown> | null) => {
  if (!product) return true;
  return Number(product.stock ?? 0) <= 0;
};
