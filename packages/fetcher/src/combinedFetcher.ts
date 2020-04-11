import bn from 'big.js';
import { FetcherInterface, Pair } from '../interfaces';
import moduleLogger from './logger';

const logger = moduleLogger.createLogger('CombinedFetcher');

const median = (pricesUnsorted: string[]): string => {
  const prices = pricesUnsorted.sort();
  const mid = Math.ceil(prices.length / 2);
  return prices.length % 2 === 0
    ? bn(prices[mid])
        .add(bn(prices[mid - 1]))
        .div(2)
        .toString()
    : prices[mid - 1];
};

export class CombinedFetcherError extends Error {
  public errors: Error[];
  constructor(message: string, errors: Error[]) {
    super(message);
    this.name = 'CombinedFetcherError';
    this.errors = errors;
  }
}

export default class CombinedFetcher implements FetcherInterface {
  private readonly minCount: number;
  private readonly fetchers: FetcherInterface[];

  constructor(fetchers: FetcherInterface[], minCount = 3) {
    this.minCount = minCount;
    this.fetchers = fetchers;
  }

  async getPrice(pair: Pair): Promise<string> {
    // fetch from all sources
    const results = await Promise.all(
      this.fetchers.map((fetcher) =>
        fetcher.getPrice(pair).catch((error) => {
          logger.warn('getPrice', { pair, error });
          return error;
        })
      )
    );

    // get prices
    const prices = results.filter((i) => typeof i === 'string') as string[];

    // ensure enough prices
    if (prices.length < this.minCount) {
      const errors = results.filter((i) => i instanceof Error);
      throw new CombinedFetcherError('not enough prices', errors);
    }

    // return median
    return median(prices);
  }
}
