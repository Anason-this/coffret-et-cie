export const minimumQuantity = 50;
export const maximumQuantity = 1000000;
const currencies = new Set(['EUR', 'MAD']);

export function markedUpPrices(config, products) {
  const catalogSkus = new Set(products.map(product => product.sku));
  return new Map(Object.entries(config).map(([sku, entry]) => {
    const { supplierRef, currency, tiers } = entry;
    if (!catalogSkus.has(sku) || typeof supplierRef !== 'string' || !supplierRef.trim()
      || !currencies.has(currency) || !Array.isArray(tiers) || !tiers.length) {
      throw new Error('Invalid Makito price mapping for ' + sku);
    }
    let previousLimit = 0;
    const adjusted = tiers.map(({ through, unitMinor }, index) => {
      const validLimit = through === null ? index === tiers.length - 1
        : Number.isSafeInteger(through) && through > previousLimit;
      if (!validLimit || !Number.isSafeInteger(unitMinor) || unitMinor <= 0 || unitMinor > 100000000) {
        throw new Error('Invalid Makito price tier for ' + sku);
      }
      previousLimit = through;
      return { through, unitMinor: Math.floor((unitMinor * 6 + 2) / 5) };
    });
    return [sku, { currency, tiers: adjusted }];
  }));
}
