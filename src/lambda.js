import serverless from 'serverless-http';

import app from './api.js';

export const handler = serverless(app);
export default handler;
