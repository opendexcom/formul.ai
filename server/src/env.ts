import { config } from 'dotenv';
import { resolve } from 'path';

const projectRoot = process.env.PLUGIN_DIR || process.env.PROJECT_ROOT;
if (projectRoot) {
  config({ path: resolve(projectRoot, '.env'), override: false });
}
config();
