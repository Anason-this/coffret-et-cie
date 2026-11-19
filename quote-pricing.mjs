export const minimumQuantity = 50;
export const maximumQuantity = 1000000;

const lowPriceThresholdMinor = 1000;
const adjustedLowPriceMinor = 1050;
const penType = /^(?:(?:mini )?stylo|roller)\b/i;

export function markedUpIdeloPrices(snapshot, products) {
  const { currency, basis, pricesBySku } = snapshot;
  if (currency !== 'MAD' || basis !== 'TTC sans marquage' || !pricesBySku
    || Object.keys(pricesBySku).length !== products.length) {
    throw new Error('Idelo price snapshot does not cover the full catalog');
  }
  return new Map(products.map(({ sku, type }) => {
    const price = Object.hasOwn(pricesBySku, sku) ? pricesBySku[sku] : null;
    if (!price || price.minimum !== minimumQuantity || (price.unitMinor !== null
      && (!Number.isSafeInteger(price.unitMinor) || price.unitMinor <= 0 || price.unitMinor > 100000000))) {
      throw new Error('Missing or invalid Idelo unit price for ' + sku);
    }
    if (price.unitMinor === null) return [sku, null];
    const markedUp = Math.floor((price.unitMinor * 6 + 2) / 5);
    const adjustLowPrice = markedUp < lowPriceThresholdMinor && !penType.test(type);
    return [sku, adjustLowPrice ? adjustedLowPriceMinor : markedUp];
  }));
}
