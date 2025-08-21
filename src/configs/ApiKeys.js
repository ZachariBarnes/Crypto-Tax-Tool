import dotenv from 'dotenv';

dotenv.config();
const apiKeys = process.env.API_KEYS;
const keyMap = JSON.parse(apiKeys);
export const apiKeyMap = new Map(keyMap.keys);

export default apiKeyMap;
