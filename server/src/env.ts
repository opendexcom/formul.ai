import { config } from 'dotenv';
import { resolve } from 'path';

const projectRoot = process.env.PLUGIN_DIR || process.env.PROJECT_ROOT;
if (projectRoot) {
  config({ path: resolve(projectRoot, '.env'), override: false });
}
// Server-local .env wins (e.g. OPENAI_API_KEY set here but blank in repo root .env)
config({ override: true });
