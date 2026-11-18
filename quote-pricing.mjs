export const minimumQuantity = 50;
export const maximumQuantity = 1000000;

export function markedUpIdeloPrices(snapshot, products) {
  const { currency, basis, pricesBySku } = snapshot;
  if (currency !== 'MAD' || basis !== 'TTC sans marquage' || !pricesBySku
    || Object.keys(pricesBySku).length !== products.length) {
    throw new Error('Idelo price snapshot does not cover the full catalog');
  }
  return new Map(products.map(({ sku }) => {
    const price = Object.hasOwn(pricesBySku, sku) ? pricesBySku[sku] : null;
    if (!price || price.minimum !== minimumQuantity || (price.unitMinor !== null
      && (!Number.isSafeInteger(price.unitMinor) || price.unitMinor <= 0 || price.unitMinor > 100000000))) {
      throw new Error('Missing or invalid Idelo unit price for ' + sku);
    }
    return [sku, price.unitMinor === null ? null : Math.floor((price.unitMinor * 6 + 2) / 5)];
  }));
}
