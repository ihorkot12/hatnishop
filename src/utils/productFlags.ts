export const readBooleanFlag = (value: unknown) => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const isBundleProduct = (product?: Record<string, unknown> | null) => {
  if (!product) return false;
  return readBooleanFlag(product.isBundle ?? product.isbundle ?? product.is_bundle);
};
