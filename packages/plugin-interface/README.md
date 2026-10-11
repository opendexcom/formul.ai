# @opendexcom/plugin-interface

Link-only workspace package inside `oss-core/packages/plugin-interface`. Defines the contract between the OSS host and EE plugins.

## Usage (workspace)

```json
"@opendexcom/plugin-interface": "workspace:*"
```

## Build

```bash
pnpm --filter @opendexcom/plugin-interface build
```

## Exports

- `FormulAIPlugin`, `PluginContext`, `PluginConfig`
- Schema registry: `registerSchema`, `extendSchema`, `getSchema`, `getSchemaOrThrow`, …
- Capability registry: `registerCapability`, `getCapabilities`
- Contribution registry: `PluginContributionRegistry`, `RegistrationExtension`

See source in `src/index.ts`.
