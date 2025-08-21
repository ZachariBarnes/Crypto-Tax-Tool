import { apiKeyMap } from './ApiKeys.js';
import EtherscanConfig from './explorerConfigs/EtherscanExplorerConfig.js';
import InsightExplorerConfig from './explorerConfigs/InsightExplorerConfig.js';
import BlockbookExplorerConfig from './explorerConfigs/BlockbookExplorerConfig.js';
import CosmosExplorerConfig from './explorerConfigs/CosmosBlockExplorerConfig.js';
// import AlgorandExplorerConfig from './explorerConfigs/AlgorandExplorerConfig.js';

export const configMap = new Map([
  // Insight Coins
  ['BTCZ', new InsightExplorerConfig('https://explorer.btcz.rocks/api')], // BTCZ
  // ['BZE(Legacy)', new InsightExplorerConfig('https://explorer.getbze.com/insight-api-bzedge-v2')], // BZedge - Deprecated
  ['CMM', new InsightExplorerConfig('https://explorer.commercium.net/api')], // Commercium
  ['DASH', new InsightExplorerConfig('https://explorer.dash.org/insight-api')], // Dash
  ['ILC', new InsightExplorerConfig('https://ilcoinexplorer.com/api')], // ILCoin
  ['KMD', new InsightExplorerConfig('https://kmdexplorer.io/insight-api-komodo')], // Komodo
  ['LTZ', new InsightExplorerConfig('https://insight.litecoinz.org/api')], // LitecoinZ
  ['TENT', new InsightExplorerConfig('https://explorer.gemlink.org/api')], // Tent/Snowgem/Gemlink
  ['GLINK', new InsightExplorerConfig('https://explorer.gemlink.org/api')], // Tent/Snowgem/Gemlink
  // ['VDL(Legacy)', new InsightExplorerConfig('https://explorer.vidulum.app/api')], // Legacy Vidulum  - Deprecated
  ['VRSC', new InsightExplorerConfig('https://insight.verus.io/api')], // Veruscoin
  ['FLUX', new InsightExplorerConfig('https://explorer.runonflux.io/api')], // Zelcash/Flux Proxy:https://magic.vidulum.app/explorer.runonflux.io/api
  ['ZEN', new InsightExplorerConfig('https://explorer.zensystem.io/api')], // Zencash
  ['ZER', new InsightExplorerConfig('https://insight.zeromachine.io/insight-api-zero')], // Zero
  // Etherscan Coins/Tokens
  ['ETH', new EtherscanConfig('https://api.etherscan.io', apiKeyMap.get('ETH'))], // Etherscan
  ['BNB', new EtherscanConfig('https://api.bscscan.com', apiKeyMap.get('BNB'))], // Bscscan
  // Blockbook Coins/Tokens
  ['BTC', new BlockbookExplorerConfig('https://btc.vidulum.app/api/v2')], // Bitcoin
  ['DGB', new BlockbookExplorerConfig('https://digibyteblockexplorer.com/api/v2')], // DigiByte
  ['DOGE', new BlockbookExplorerConfig('https://dogeblocks.com/api/v2')], // Dogecoin
  ['FIRO', new BlockbookExplorerConfig('https://blockbook.zcoin.io/api/v2')], // Firo / Zcoin
  ['GRS', new BlockbookExplorerConfig('https://blockbook.groestlcoin.org/api/v2')], // Groestlcoin
  ['LTC', new BlockbookExplorerConfig('https://ltcbook.guarda.co/api/v2')], // Litecoin
  ['RITO', new BlockbookExplorerConfig('https://blockbook.ritocoin.org/api/v2')], // RitoCoin
  ['RVN', new BlockbookExplorerConfig('https://blockbook.ravencoin.org/api/v2')], // Ravencoin
  ['SCRIV', new BlockbookExplorerConfig('https://scriv.zcore.host/api/v2')], // SCRIV
  ['SSS', new BlockbookExplorerConfig('https://sss.flitswallet.app/api/v2')], // SSS / Simple Software Solutions
  ['VGC', new BlockbookExplorerConfig('https://blockbook.fiveg.cash/api/v2')], // VGC / 5G-Cash
  ['ZEC', new BlockbookExplorerConfig('https://zecblockexplorer.com/api/v2')], // Zcash
  // Cosmos/Ping Explorer Coins/Tokens
  ['BZE', new CosmosExplorerConfig('https://rest.getbze.com/cosmos')], // BeeZee
  // ['VDL', new CosmosExplorerConfig('https://mainnet-lcd.vidulum.app/cosmos')], // Vidulum Mainnet VDL (Snapshot)
  ['VDL', new CosmosExplorerConfig('63.210.148.24:1317/cosmos')], // Vidulum Full Node VDL (SAS)
  // ['ALGO', new AlgorandExplorerConfig('https://algoexplorer.algoexplorerapi.io/v2')], // Algorand ALGO
]);

export default configMap;
