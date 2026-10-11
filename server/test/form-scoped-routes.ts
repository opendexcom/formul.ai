import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export type HttpRoute = { method: string; path: string };

/**
 * Current OSS form-scoped management routes. Enumeration from the live
 * OpenAPI document is unioned with this list so a new `/forms/:id/*` handler
 * is covered automatically, and a swagger miss still tests these.
 */
export const EXPLICIT_FORM_SCOPED_ROUTES: HttpRoute[] = [
  { method: 'GET', path: '/forms/{id}' },
  { method: 'PATCH', path: '/forms/{id}' },
  { method: 'DELETE', path: '/forms/{id}' },
  { method: 'GET', path: '/forms/{id}/stats' },
  { method: 'GET', path: '/forms/{id}/response-count' },
  { method: 'GET', path: '/forms/{id}/responses' },
  { method: 'GET', path: '/forms/{id}/analytics' },
  { method: 'GET', path: '/forms/{id}/analytics/stream' },
  { method: 'GET', path: '/forms/{id}/analytics/task/{taskId}' },
  { method: 'POST', path: '/forms/{id}/responses/{responseId}/reprocess' },
  { method: 'POST', path: '/forms/{id}/responses/reprocess-all' },
  { method: 'POST', path: '/forms/{id}/send-invitations' },
  { method: 'PATCH', path: '/forms/{id}/toggle-active' },
];

export const EXPLICIT_MIGRATION_ROUTES: HttpRoute[] = [
  { method: 'POST', path: '/migrations/fix-created-by' },
  { method: 'GET', path: '/migrations/validate-created-by' },
  { method: 'GET', path: '/migrations/show-problematic' },
  { method: 'POST', path: '/migrations/forms-to-projects' },
];

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export function normalizeRoutePath(path: string): string {
  return path
    .replace(/^\/api(?=\/|$)/, '')
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

export function isFormScopedManagementPath(path: string): boolean {
  const normalized = normalizeRoutePath(path);
  if (normalized.startsWith('/public/')) {
    return false;
  }
  if (/^\/forms\/\{id\}(\/|$)/.test(normalized)) {
    return true;
  }
  if (
    (/^\/analytics(\/|$)/.test(normalized) || /^\/responses(\/|$)/.test(normalized)) &&
    /(\{id\}|\{formId\})/.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function isMigrationPath(path: string): boolean {
  return normalizeRoutePath(path).startsWith('/migrations');
}

export function collectOpenApiRoutes(
  app: INestApplication,
  predicate: (path: string) => boolean,
): HttpRoute[] {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('e2e').build(),
  );
  const routes: HttpRoute[] = [];

  for (const [rawPath, operations] of Object.entries(document.paths ?? {})) {
    const path = normalizeRoutePath(rawPath);
    if (!predicate(path)) {
      continue;
    }
    for (const method of Object.keys(operations ?? {})) {
      if (HTTP_METHODS.has(method)) {
        routes.push({ method: method.toUpperCase(), path });
      }
    }
  }

  return routes;
}

export function uniqueRoutes(routes: HttpRoute[]): HttpRoute[] {
  const seen = new Set<string>();
  const unique: HttpRoute[] = [];
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(route);
  }
  return unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function collectFormScopedRoutes(app: INestApplication): HttpRoute[] {
  return uniqueRoutes([
    ...EXPLICIT_FORM_SCOPED_ROUTES,
    ...collectOpenApiRoutes(app, isFormScopedManagementPath),
  ]);
}

export function collectMigrationRoutes(app: INestApplication): HttpRoute[] {
  return uniqueRoutes([
    ...EXPLICIT_MIGRATION_ROUTES,
    ...collectOpenApiRoutes(app, isMigrationPath),
  ]);
}

export function instantiatePath(
  path: string,
  params: Record<string, string>,
): string {
  return `/api${path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (!value) {
      throw new Error(`Missing path param ${key} for ${path}`);
    }
    return value;
  })}`;
}

export function isStreamingRoute(route: HttpRoute): boolean {
  return route.path.includes('/stream');
}

export function isDeleteRoute(route: HttpRoute): boolean {
  return route.method === 'DELETE';
}
