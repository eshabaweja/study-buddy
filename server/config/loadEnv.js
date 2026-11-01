// Loads local env files before anything reads process.env. Imported first by server.js.
// In production the platform injects real environment variables, and tests set their own,
// so no file is read in either case.
import dotenv from 'dotenv';

if (!['production', 'test'].includes(process.env.NODE_ENV)) {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}
