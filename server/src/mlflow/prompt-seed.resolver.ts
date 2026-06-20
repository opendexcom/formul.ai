import * as fs from 'fs';
import * as path from 'path';

const KNOWN_GROUPS = [
  'analytics',
  'form',
  'security',
  'document',
  'shared',
] as const;

function promptSeedBases(): string[] {
  const pluginDir = process.env.PLUGIN_DIR;
  return [
    path.join(process.cwd(), 'oss-core/mlflow/prompts'),
    path.join(__dirname, '../../../mlflow/prompts'),
    pluginDir ? path.join(pluginDir, 'oss-core/mlflow/prompts') : null,
    pluginDir ? path.join(pluginDir, 'ee-backend/mlflow/prompts') : null,
    path.join(process.cwd(), 'ee-backend/mlflow/prompts'),
  ].filter((base): base is string => Boolean(base));
}

export function resolvePromptSeedPath(promptName: string): string | null {
  if (!promptName.startsWith('formulai-')) {
    return null;
  }

  const remainder = promptName.slice('formulai-'.length);
  let group: string | null = null;
  let rest = remainder;

  for (const knownGroup of KNOWN_GROUPS) {
    if (remainder.startsWith(`${knownGroup}-`)) {
      group = knownGroup;
      rest = remainder.slice(knownGroup.length + 1);
      break;
    }
  }

  if (!group) {
    return null;
  }

  const fileName = `${rest}.md`;
  for (const base of promptSeedBases()) {
    const candidate = path.join(base, group, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function loadPromptSeedTemplate(promptName: string): string | null {
  const seedPath = resolvePromptSeedPath(promptName);
  if (!seedPath) {
    return null;
  }
  return fs.readFileSync(seedPath, 'utf-8');
}
