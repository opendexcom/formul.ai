# FormulAI Plugin Development Guide

## Overview

FormulAI supports a plugin architecture that allows you to extend the platform with custom functionality. Plugins are dynamically loaded based on environment configuration and can add new modules, services, controllers, and middleware to the application.

## Creating a Plugin

### 1. Plugin Structure

A plugin is a TypeScript module that implements the `FormulAIPlugin` interface:

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { FormulAIPlugin } from '../server/src/plugins/plugin.interface';

@Module({})
export class MyPluginModule {}

export default class MyPlugin implements FormulAIPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My custom plugin';
  
  constructor(private options?: any) {}
  
  register(): DynamicModule {
    return {
      module: MyPluginModule,
      providers: [/* your services */],
      controllers: [/* your controllers */],
      exports: [/* exported services */],
    };
  }
  
  async onApplicationBootstrap(app: INestApplication) {
    // Optional: setup middleware, global filters, etc.
    console.log('✅ My plugin initialized');
  }
  
  async onApplicationShutdown() {
    // Optional: cleanup resources
  }
}
```

### 2. Plugin Interface

```typescript
export interface FormulAIPlugin {
  name: string;                    // Plugin name
  version: string;                 // Semantic version
  description?: string;            // Optional description
  
  register(): DynamicModule | Promise<DynamicModule>;
  onApplicationBootstrap?(app: INestApplication): Promise<void>;
  onApplicationShutdown?(): Promise<void>;
}
```

### 3. Loading Plugins

#### Via Environment Variable

```bash
# Load plugins from npm packages
PLUGINS=@formulai/billing-plugin,@formulai/usage-tracking-plugin

# Load with options
PLUGINS=my-plugin:enabled=true:debug=false
```

#### Via Local Directory

Place your plugin in the `plugins/` directory:

```
plugins/
└── my-plugin/
    ├── index.ts
    ├── my-plugin.module.ts
    └── package.json
```

Then load it:

```bash
PLUGINS=my-plugin
```

## Example: Simple Plugin

```typescript
// plugins/hello-world/index.ts
import { DynamicModule, Module, Injectable } from '@nestjs/common';
import { FormulAIPlugin } from '../../server/src/plugins/plugin.interface';

@Injectable()
export class HelloService {
  sayHello() {
    return 'Hello from plugin!';
  }
}

@Module({
  providers: [HelloService],
  exports: [HelloService],
})
export class HelloWorldModule {}

export default class HelloWorldPlugin implements FormulAIPlugin {
  name = 'hello-world';
  version = '1.0.0';
  description = 'A simple hello world plugin';
  
  register(): DynamicModule {
    return {
      module: HelloWorldModule,
      providers: [HelloService],
      exports: [HelloService],
    };
  }
  
  async onApplicationBootstrap(app: any) {
    console.log('👋 Hello World Plugin loaded!');
  }
}
```

## Plugin Capabilities

### 1. Add Services

```typescript
register(): DynamicModule {
  return {
    module: MyPluginModule,
    providers: [
      MyService,
      MyOtherService,
    ],
    exports: [MyService],
  };
}
```

### 2. Add Controllers

```typescript
register(): DynamicModule {
  return {
    module: MyPluginModule,
    controllers: [MyController],
  };
}
```

### 3. Add Middleware

```typescript
async onApplicationBootstrap(app: INestApplication) {
  app.use(myMiddleware);
}
```

### 4. Add Global Filters

```typescript
async onApplicationBootstrap(app: INestApplication) {
  app.useGlobalFilters(new MyExceptionFilter());
}
```

### 5. Access Other Services

```typescript
@Injectable()
export class MyService {
  constructor(
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
  ) {}
}
```

## Best Practices

1. **Use Semantic Versioning** - Follow semver for plugin versions
2. **Handle Errors Gracefully** - Don't crash the app if plugin fails
3. **Document Configuration** - Clearly document required environment variables
4. **Export Interfaces** - Export types for other plugins to use
5. **Test Independently** - Write unit tests for your plugin
6. **Minimal Dependencies** - Keep plugin dependencies minimal
7. **Clean Shutdown** - Implement `onApplicationShutdown` for cleanup

## Plugin Configuration

Plugins can accept configuration via constructor:

```typescript
export default class MyPlugin implements FormulAIPlugin {
  constructor(private options: {
    apiKey: string;
    endpoint: string;
  }) {}
  
  register(): DynamicModule {
    return {
      module: MyPluginModule,
      providers: [
        {
          provide: 'MY_PLUGIN_CONFIG',
          useValue: this.options,
        },
      ],
    };
  }
}
```

Pass options via environment:

```bash
PLUGINS=my-plugin:apiKey=abc123:endpoint=https://api.example.com
```

## Debugging Plugins

Enable debug logging:

```bash
# Set log level
LOG_LEVEL=debug

# Plugin loader will log detailed information
```

Check plugin loading:

```bash
# Server will log on startup:
✓ Loaded plugin: my-plugin v1.0.0
✓ Initialized plugin: my-plugin
```

## Schema Registry

Core and plugins share Mongoose schemas by **name** via the schema registry (`@opendexcom/plugin-interface`). This avoids import-time binding and lets plugins consume core and other plugins’ models without direct imports.

**Registration order**

1. **Core schemas** are registered in `PluginsModule.forRoot()` before any plugin is loaded (see `core-schema-registry.ts`).
2. **Plugin load order** is chosen so schema **providers** (e.g. billing, usage-tracking) load before schema **consumers** (e.g. admin). Plugins whose name contains `admin` are loaded last. List providers first in `PLUGINS`, e.g. `PLUGINS=billing,usage-tracking,admin`.

**If your plugin defines models**

- Register them with the registry (e.g. `registerSchemaWithRegistry` from plugin-interface) so other plugins can use them by name.
- Use the same schema in your module’s `MongooseModule.forFeature` (or use `registerSchemaWithRegistry` to do both).

**If your plugin only uses existing models**

- Use `getSchemaOrThrow('ModelName')` from plugin-interface and pass the result to `MongooseModule.forFeature`. Do not import schema files from core or other plugins.

## Common Patterns

### Database Schema

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class MyPluginData {
  @Prop({ required: true })
  userId: string;
  
  @Prop()
  data: any;
}

export const MyPluginDataSchema = SchemaFactory.createForClass(MyPluginData);
```

### API Endpoints

```typescript
@Controller('my-plugin')
export class MyPluginController {
  @Get()
  getData() {
    return { message: 'Plugin data' };
  }
}
```

### Guards

```typescript
@Injectable()
export class MyPluginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Your logic
    return true;
  }
}
```

## Troubleshooting

### Plugin Not Loading

1. Check `PLUGINS` environment variable
2. Verify plugin exports default class
3. Check plugin implements `FormulAIPlugin` interface
4. Look for errors in server logs

### Plugin Conflicts

1. Ensure unique module names
2. Avoid circular dependencies
3. Use `forwardRef()` for cross-plugin dependencies

### Performance Issues

1. Minimize work in `onApplicationBootstrap`
2. Use lazy loading for heavy operations
3. Profile plugin initialization time

## Enterprise (SaaS) plugins

The SaaS implementation plan (billing, usage tracking, monitoring, admin) lives in the **Enterprise Edition (EE)** repository: see `docs/plans/saas-implementation-plan.md` in the formul.ai-ee repo.

## Support

For questions or issues with plugin development, please open an issue on GitHub.
