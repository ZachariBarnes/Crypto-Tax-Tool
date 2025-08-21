import logger from 'npmlog';
// import ExplorerConfig from '../types/config.js';
// TODO This Etherscan Explorer can only be used for up to 20,000 Transactions(2 pages).  Alternatives must be researched.
export class EtherscanConfig {
  constructor(baseUrl, apiKey) {
    // super();
    this.baseUrl = baseUrl;
    this.transactionUrl = `${baseUrl}/api`;
    this.verifyAddressUrl = `${baseUrl}/api/`;
    this.transactionsPerPage = 10000;
    this.pageNum = 1;
    this.apiKey = apiKey;
    this.actions = ['txlist', 'txlistinternal', 'tokentx', 'tokennfttx', null];
    this.actionIndex = 0;
    this.smallestDenom = 1000000000000000000; // 18 Zeros Eth/Wei
  }

  updateWallet(walletAddress, symbol) {
    this.walletAddress = walletAddress.toLowerCase();
    this.symbol = symbol;
    this.verifyAddressUrl = `${this.baseUrl}/api/`;
    this.searchParams = {
      module: 'account',
      action: 'txlist',
      address: this.walletAddress,
      apiKey: this.apiKey,
      page: this.pageNum,
      sort: 'desc',
    };
  }

  paginate(response, allItems, currentItems) {
    const previousSearchParams = response.request.options.searchParams;
    let requestLimit = 2;
    if (currentItems.length < this.transactionsPerPage) {
      logger.info('number of transactions so far for this address:', allItems.length);
      requestLimit = this.switchActions();
      if (requestLimit !== 2) {
        return false;
      }
      this.pageNum = 0; // will be incremented to 1 in getNextParams()
    }

    return {
      searchParams: this.getNextParams(previousSearchParams),
    };
  }

  getNextParams(previousParams) {
    const { action } = this.searchParams;
    const pageNum = this.pageNum++;
    return { ...previousParams, action, page: pageNum };
  }

  transformResponse(response) {
    const { body } = response;
    const { result } = JSON.parse(body);
    if (!result || !result.length) {
      logger.error(`Bad response from ${this.baseUrl}, Body:`, body);
    }
    const requestLimit = 2;
    const transactions = [];
    result.forEach((tx) => transactions.push(this.transformTransaction(tx)));
    return { transactions, requestLimit };
  }

  shouldContinue(item, allItems, currentItems, cutoffdate) {
    // console.log(`shouldContinue item: ${Object.keys(item)}, alltransactions: ${allItems.length}, currentItems: ${currentItems.length}`);
    let getNextPage = true;
    if (cutoffdate) {
      const date = new Date(item.Date);
      getNextPage = date > cutoffdate;
    }
    if (!getNextPage && this.searchParams.action != null) {
      const pageCount = this.switchActions();
      getNextPage = pageCount === 2;
    }
    return getNextPage;
  }

  transformTransaction(transaction) {
    let tx;
    const {
      tokenDecimal, tokenSymbol, value, timeStamp, gasPrice, gasUsed, hash,
    } = transaction;
    const amount = value / (tokenDecimal ? 10 ** tokenDecimal : this.smallestDenom);
    // eslint-disable-next-line no-unused-vars, max-len
    const columns = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash'];
    if (transaction.from === this.walletAddress) {
      tx = {
        Date: new Date(timeStamp * 1000).toISOString(),
        SentAmt: amount, // sent Amt
        SentSymbol: tokenSymbol || this.symbol, // sent Currency
        ReceivedAmt: 0, // received Amt
        ReceivedSymbol: '', // received Currency
        FeeAmt: (gasUsed * gasPrice) / this.smallestDenom, // transaction.fees
        FeeSymbol: this.symbol, // symbol, //fee Currency
        NetWorthAmt: '', // net Worth Amt (optional)
        NetWorthSymbol: '', // net Worth Currency (optional)
        Label: '', // label (optional)
        Description: amount === 0 ? 'Gas Fee' : '', // description (optional)
        TxHash: hash, // txHash
      };
    }
    else if (transaction.to === this.walletAddress) {
      tx = {
        Date: new Date(timeStamp * 1000).toISOString(),
        SentAmt: 0, // sent Amt
        SentSymbol: '', // sent Currency
        ReceivedAmt: value / (tokenDecimal ? 10 ** tokenDecimal : this.smallestDenom), // received Amt
        ReceivedSymbol: tokenSymbol || this.symbol, // received Currency
        FeeAmt: 0, // transaction.fees, (applicable for incoming tx???)
        FeeSymbol: '', // symbol, //fee Currency
        NetWorthAmt: '', // net Worth Amt (optional)
        NetWorthSymbol: '', // net Worth Currency (optional)
        Label: '', // label (optional) (Should we use a different tag here?)
        Description: '', // description (optional)
        TxHash: hash, // txHash
      };
    }
    else {
      logger.error(`Transaction ${hash} is neither incoming nor outgoing.`);
    }
    return tx;
  }

  switchActions() {
    logger.info(`Switching from action ${this.searchParams.action}`);
    this.searchParams.action = this.actions[++this.actionIndex];
    logger.info(`Switching to action ${this.searchParams.action}`);
    if (this.searchParams.action === null) {
      return this.pageNum;
    }
    return 2;
  }

  cleanUp() {
    this.walletAddress = null;
    this.pageNum = 1;
    this.actionIndex = 0;
    this.smallestDenom = 1000000000000000000; // 18 Zeros Eth/Wei
    this.searchParams = {
      module: 'account',
      action: 'txlist',
      address: null,
      apiKey: this.apiKey,
      page: 1,
      sort: 'desc',
    };
  }
}

export default EtherscanConfig;
