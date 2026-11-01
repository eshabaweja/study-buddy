import './config/loadEnv.js';
import { validateEnv } from './config/env.js';

validateEnv();

const { default: app } = await import('./app.js');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
