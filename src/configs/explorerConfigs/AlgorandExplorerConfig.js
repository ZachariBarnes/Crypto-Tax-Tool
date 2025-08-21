/* eslint-disable prefer-destructuring */
import logger from 'npmlog';

export class AlgorandExplorerConfig {
  constructor(baseUrl) {
    // super();
    this.baseUrl = baseUrl;
    this.transactionUrl = `${baseUrl}/accounts/:ACCOUNT_ID/transactions`;
    this.transactionsPerPage = 10000;
    this.nextToken = '';
    this.denom = 1000000;
  }

  updateWallet(walletAddress, symbol) {
    logger.info(`updateWallet for ${symbol}`);
    this.walletAddress = walletAddress;
    this.symbol = symbol;
    this.verifyAddressUrl = `${this.baseUrl}/accounts/${this.walletAddress}/transactions`;
    this.searchParams = { // For Query Params, if required
      limit: this.transactionsPerPage,
      next: this.nextToken,
    };
  }

  paginate(response, allItems, currentItems) {
    this.nextToken = response['next-token'];
    if (currentItems.length < this.transactionsPerPage) {
      return false;
    }

    this.searchParams.next = this.nextToken;
    return {
      searchParams: this.searchParams,
    };
  }

  getNextParams(previousParams) {
    const pageNum = this.pageNum++; // Rplace pageNum with paginator propertey
    return { ...previousParams, pageNum };
  }

  transformResponse(response) {
    const { body } = response;
    const { 'next-token': nextToken, transactions: txs } = JSON.parse(body);
    this.nextToken = nextToken;
    const transactions = [];
    txs.forEach((tx) => transactions.push(...this.transformTransaction(tx)));
    logger.warn(`next Token:${nextToken}`);
    return { transactions, requestLimit: Infinity };
  }

  shouldContinue(item, allItems, currentItems, cutoffdate) {
    let getNextPage = true;
    if (cutoffdate) {
      const date = new Date(item.Date);
      getNextPage = date > cutoffdate;
    }
    console.log(`currentItems.length: ${currentItems.length}, TransactionsPerPage: ${this.transactionsPerPage}`);
    if (currentItems.length < this.transactionsPerPage) {
      return false; // Block chains that support tokens might need to swith to a different action or endpoint instead of returning false;
    }
    return getNextPage;
  }

  transformTransaction(transaction) {
    const {
      'tx-type': txType, fee, id, sender, group,
    } = transaction;
    let label = '';
    let amount;
    let assetId;
    let reciever;
    let timestamp;
    switch (txType) {
      case 'pay':
        label = 'Payment';
        amount = transaction['payment-transaction'].amount;
        reciever = transaction['payment-transaction'].receiver;
        break;
      case 'axfer':
        label = 'Asset Transfer';
        amount = transaction['asset-transfer-transaction'].amount;
        reciever = transaction['asset-transfer-transaction'].receiver;
        assetId = transaction['asset-transfer-transaction']['asset-id'];
        break;
      case 'keyreg':
        label = 'Key Registration (Governance)';
        amount = 0;
        break;
      case 'acfg':
        label = 'Asset configuration (create/update/destroy)';
        amount = 0;
        break;
      case 'afrz':
        label = 'Asset Freeze';
        amount = 0;
        break;
      case 'appl':
        label = 'Application Transaction (Smart Contract)';
        amount = 0;
        // assume first account is the receiver
        reciever = transaction['application-transaction'].accounts[0];
        break;
      default:
        break;
    }
    const recievedTx = reciever === this.walletAddress;
    // eslint-disable-next-line no-unused-vars, max-len
    const columns = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash'];
    const tx = {
      Date: new Date(transaction.time * 1000).toISOString(),
      SentAmt: txIn.value, // sent Amt
      SentSymbol: this.symbol, // sent Currency
      ReceivedAmt: 0, // received Amt
      ReceivedSymbol: '', // received Currency
      FeeAmt: transaction.fees, // transaction.fees, (applicable for incoming tx???)
      FeeSymbol: this.symbol, // symbol, //fee Currency
      NetWorthAmt: '', // net Worth Amt (optional)
      NetWorthSymbol: '', // net Worth Currency (optional)
      Label: label, // label (optional)
      Description: '', // description (optional)
      TxHash: transaction.txid, // txHash
    };

    return tx;
  }

  cleanUp() {
    this.walletAddress = null;
    this.pageNum = 0;
    this.verifyAddressUrl = `${this.baseUrl}/addr/${this.walletAddress}/?noTxList=1`;
    this.searchParams = {
      address: this.walletAddress,
      pageNum: 0,
    };
  }
}

export default AlgorandExplorerConfig;
