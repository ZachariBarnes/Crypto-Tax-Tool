//Not actually used but it is here for reference.
export class ExplorerConfig {
    apiKey = '';
    baseUrl= '';
    walletAddress = '';
    verifyAddressUrl = '';
    transactionUrl = '';
    searchParams = {};
    transactionsPerPage = 10;
    getNextParams= (previousParams) => {};
    transformResponse = (response) => {};
    shouldContinue = (items, allItems, currentItems, cutoffdate) => { };
    cleaup = () => { };
}

export default ExplorerConfig;