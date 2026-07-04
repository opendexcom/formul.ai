import { config } from 'dotenv';
import { resolve } from 'path';

const projectRoot = process.env.PLUGIN_DIR || process.env.PROJECT_ROOT;
if (projectRoot) {
  config({ path: resolve(projectRoot, '.env'), override: false });
}

// Server-local .env wins, but blank placeholders must not wipe values from repo root .env
const serverEnvPath = resolve(process.cwd(), '.env');
const serverEnv = config({ path: serverEnvPath, override: false });
if (serverEnv.parsed) {
  for (const [key, value] of Object.entries(serverEnv.parsed)) {
    if (value === '' && process.env[key]) {
      continue;
    }
    process.env[key] = value;
  }
}
