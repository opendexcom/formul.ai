# FormulAI SaaS Implementation Plan

## Executive Summary

This document outlines the strategy to transform FormulAI from an open-source platform into a commercial SaaS offering using a **plugin/extension architecture**. The SaaS features will be built as independent plugins that load dynamically into the OSS core, maintaining clean separation while enabling flexible deployment.

---

## Business Model

### Pricing Tiers

| Tier | Monthly Price | Token Limit | Max Responses/Analysis | Max Forms | Support |
|------|--------------|-------------|----------------------|-----------|---------|
| **Basic** | **$15** | 15,000 | 25 responses | 2 forms | Email (48h) |
| **Advanced** | **$25** | 50,000 | 100 responses | 5 forms | Email (24h) |
| **Pro** | **$35** | 150,000 | 500 responses | 25 forms | Priority Email (12h) |
| **Enterprise** | **Custom** | Unlimited | Unlimited | Unlimited | Dedicated Support |

### Key Features

- **14-day free trial** for all tiers
- **Monthly billing** (no annual option initially)
- **Dodo Payments** as Merchant of Record (4% + $0.40 per transaction)
- **Hosted on your infrastructure** with your OpenAI API key
- **Progressive limits** to encourage tier upgrades

### Competitive Positioning

- **Undercuts competitors**: Typeform starts at $29, SurveyMonkey at $39
- **AI analysis as differentiator**: Progressively generous limits per tier
- **Clear value ladder**: $10 increments between tiers
- **Lower barrier to entry**: $15 starting price vs $29+ competitors

---

## Architecture Strategy

### Plugin/Extension Approach

The SaaS extension uses a **plugin architecture** where commercial features are built as independent npm packages that dynamically load into the OSS core.

```
┌─────────────────────────────────────────────────────────┐
│  OSS Repository: opendexcom/formul.ai                   │
│                                                          │
│  ├── server/src/plugins/     # [NEW] Plugin system     │
│  │   ├── plugin.interface.ts                           │
│  │   ├── plugin-loader.service.ts                      │
│  │   └── plugins.module.ts                             │
│  └── plugins/                # Local plugin directory  │
│      └── .gitignore          # Ignore all plugins      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SaaS Plugins (Private npm packages or local)           │
│                                                          │
│  @formulai/billing-plugin        # Dodo Payments        │
│  @formulai/usage-tracking-plugin # Token monitoring     │
│  @formulai/monitoring-plugin     # Sentry integration   │
│  @formulai/admin-plugin          # Admin dashboards     │
└─────────────────────────────────────────────────────────┘
```

### Benefits

✅ **Clean separation** - OSS core remains 100% open source  
✅ **Flexible deployment** - Load plugins conditionally via environment  
✅ **Easy maintenance** - Plugins update independently of core  
✅ **NestJS native** - Leverages dynamic modules  
✅ **No fork needed** - OSS repo stays pristine  
✅ **Testable** - Plugins tested in isolation  

---

## Implementation Phases

### Phase 1: OSS Core Plugin Infrastructure

**Goal**: Add plugin system to OSS repository

**Tasks**:
1. Create plugin interface (`plugin.interface.ts`)
2. Build plugin loader service (`plugin-loader.service.ts`)
3. Add dynamic module registration (`plugins.module.ts`)
4. Update `app.module.ts` to load plugins
5. Update `main.ts` to initialize plugins
6. Document plugin development guide

**Deliverables**:
- Plugin system integrated into OSS core
- Plugin development documentation
- Example plugin for testing

---

### Phase 2: Billing Plugin

**Package**: `@formulai/billing-plugin`

**Features**:
- Dodo Payments SDK integration
- Subscription CRUD operations
- Webhook event processing (subscription.created, payment.succeeded, etc.)
- Customer portal URL generation
- Plan-based access guards

**Database Schemas**:

```typescript
// Subscription Schema
{
  userId: ObjectId,
  dodoSubscriptionId: string,
  dodoCustomerId: string,
  plan: 'basic' | 'advanced' | 'pro' | 'enterprise',
  status: 'active' | 'past_due' | 'canceled' | 'trialing',
  trialEndsAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  metadata: object,
  createdAt: Date,
  updatedAt: Date
}

// Billing Event Schema
{
  eventId: string,
  eventType: string,
  subscriptionId: ObjectId,
  payload: object,
  processedAt: Date
}
```

**User Schema Extension**:
```typescript
{
  subscriptionId: ObjectId,
  subscriptionTier: 'basic' | 'advanced' | 'pro' | 'enterprise',
  subscriptionStatus: string
}
```

---

### Phase 3: Usage Tracking Plugin

**Package**: `@formulai/usage-tracking-plugin`

**Features**:
- Token counting from OpenAI responses
- Quota enforcement per subscription tier
- Cost calculation and tracking
- Usage analytics and reporting
- Monthly quota reset

**Database Schemas**:

```typescript
// Usage Event Schema
{
  userId: ObjectId,
  formId: ObjectId,
  eventType: 'form_generation' | 'analytics_run',
  tokensUsed: number,
  estimatedCost: number,
  model: string,
  timestamp: Date,
  metadata: {
    responseCount?: number,
    processingTime?: number
  }
}

// Usage Quota Schema
{
  userId: ObjectId,
  month: string, // 'YYYY-MM'
  tokensUsed: number,
  totalCost: number,
  quotaLimit: number,
  planTier: string,
  formsCreated: number,
  analyticsRuns: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Implementation**:
```typescript
// Wrap AI calls with usage tracking
@Post('generate')
async generate(@Body() dto: GenerateAIFormDto, @User() user) {
  return this.usageTracking.trackAICall(
    user.id,
    () => this.aiService.generate(dto)
  );
}
```

---

### Phase 4: Monitoring Plugin

**Package**: `@formulai/monitoring-plugin`

**Features**:
- Sentry error tracking (`@sentry/node`)
- Performance monitoring
- User context (email, subscription tier)
- Release tracking
- Global exception filter

**Implementation**:
```typescript
// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  integrations: [new Sentry.Integrations.Http({ tracing: true })],
});

// Add global filter
app.useGlobalFilters(new SentryExceptionFilter());
```

---

### Phase 5: Admin Dashboard Plugin

**Package**: `@formulai/admin-plugin`

**Features**:
- User usage analytics
- Subscription metrics (MRR, churn rate)
- Cost analytics
- System health monitoring
- Admin API endpoints

**Endpoints**:
- `GET /admin/analytics/usage` - User usage stats
- `GET /admin/analytics/revenue` - Revenue metrics
- `GET /admin/analytics/costs` - AI cost tracking
- `GET /admin/users` - User management
- `GET /admin/subscriptions` - Subscription overview

---

### Phase 6: External Landing Page

**Technology**: Next.js 14 (App Router)

**Structure**:
```
landing/
├── app/
│   ├── page.tsx              # Homepage
│   ├── pricing/              # Pricing page
│   ├── terms/                # Terms of Service
│   └── privacy/              # Privacy Policy
├── components/
│   └── PricingTable.tsx      # Tier comparison
└── .env
    NEXT_PUBLIC_APP_URL=https://app.formulai.com
    NEXT_PUBLIC_DODO_VENDOR_ID=...
```

**Features**:
- Product overview
- Pricing table with Dodo checkout integration
- Legal pages (Terms, Privacy)
- "Start Free Trial" CTA
- Responsive design

---

## Deployment Configuration

### OSS Deployment (Self-Hosted)

```bash
# .env
MONGODB_URI=mongodb://localhost:27017/formulai
REDIS_HOST=localhost
JWT_SECRET=your-secret
OPENAI_API_KEY=sk-user-provided-key

# No PLUGINS variable = pure OSS mode
```

### SaaS Deployment (Your Servers)

```bash
# .env
MONGODB_URI=mongodb://your-mongo-atlas-url
REDIS_HOST=your-redis-url
JWT_SECRET=your-secret
OPENAI_API_KEY=sk-your-master-key  # Your key, not user's

# Load SaaS plugins
PLUGINS=@formulai/billing-plugin,@formulai/usage-tracking-plugin,@formulai/monitoring-plugin,@formulai/admin-plugin

# Billing Plugin Config
DODO_API_KEY=your-dodo-key
DODO_WEBHOOK_SECRET=your-webhook-secret
DODO_ENVIRONMENT=production
DODO_VENDOR_ID=your-vendor-id

# Usage Tracking Config - Tier Limits
BASIC_TIER_TOKEN_LIMIT=15000
BASIC_TIER_MAX_RESPONSES_PER_ANALYSIS=25
BASIC_TIER_MAX_FORMS=2

ADVANCED_TIER_TOKEN_LIMIT=50000
ADVANCED_TIER_MAX_RESPONSES_PER_ANALYSIS=100
ADVANCED_TIER_MAX_FORMS=5

PRO_TIER_TOKEN_LIMIT=150000
PRO_TIER_MAX_RESPONSES_PER_ANALYSIS=500
PRO_TIER_MAX_FORMS=25

ENTERPRISE_TIER_TOKEN_LIMIT=999999999
ENTERPRISE_TIER_MAX_RESPONSES_PER_ANALYSIS=999999999
ENTERPRISE_TIER_MAX_FORMS=999999999

FREE_TRIAL_DAYS=14

# Monitoring Config
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

---

## Plugin Development Guide

### Creating a Plugin

1. **Create npm package** or local directory
2. **Implement `FormulAIPlugin` interface**
3. **Export as default**

### Plugin Interface

```typescript
import { DynamicModule, INestApplication } from '@nestjs/common';

export interface FormulAIPlugin {
  name: string;
  version: string;
  description?: string;
  
  register(): DynamicModule | Promise<DynamicModule>;
  onApplicationBootstrap?(app: INestApplication): Promise<void>;
  onApplicationShutdown?(): Promise<void>;
}
```

### Example Plugin

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { FormulAIPlugin } from '@formulai/core';

@Module({})
export class MyPluginModule {}

export default class MyPlugin implements FormulAIPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  
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
    // Optional: setup middleware, etc.
    console.log('✅ My plugin initialized');
  }
}
```

### Loading Plugins

**Via Environment Variable**:
```bash
PLUGINS=@formulai/billing-plugin,@formulai/usage-tracking-plugin
```

**Via Local Directory**:
```bash
# Place plugin in plugins/ directory
PLUGINS=my-local-plugin
```

---

## Database Collections

### New Collections

1. **subscriptions** - User subscription data
2. **usage_events** - Individual usage tracking events
3. **usage_quotas** - Monthly aggregated quotas
4. **billing_events** - Dodo webhook events log

### Modified Collections

**users** - Add subscription fields (backward compatible):
- `subscriptionId: ObjectId`
- `subscriptionTier: 'basic' | 'advanced' | 'pro' | 'enterprise'`
- `subscriptionStatus: string`

---

## Legal & Compliance

### Required Documents

1. **Terms of Service** - Service description, user responsibilities, subscription terms, refund policy
2. **Privacy Policy** - Data collection, storage, third-party services (Dodo, Sentry, OpenAI), GDPR compliance
3. **Cookie Policy** - Cookie usage and tracking

### Compliance Considerations

- **PCI Compliance**: Handled by Dodo Payments
- **GDPR**: User data collection (usage, billing) requires clear policies
- **Data Retention**: Define retention policies for usage events and billing data
- **Right to Delete**: Implement user data deletion on request

---

## Testing Strategy

### Unit Tests

```bash
# Billing plugin
pnpm test billing-plugin

# Usage tracking plugin
pnpm test usage-tracking-plugin
```

### Integration Tests

```bash
# Full subscription flow
pnpm test:e2e subscription-flow

# Usage tracking with AI calls
pnpm test:e2e usage-tracking

# Feature flag enforcement
pnpm test:e2e feature-flags
```

### Manual Verification

1. **Dodo Integration**
   - Create test subscription in Dodo sandbox
   - Verify webhook delivery
   - Test customer portal access
   - Verify subscription sync with database

2. **Usage Monitoring**
   - Generate analytics on test form
   - Verify token usage recorded
   - Check usage dashboard displays correctly
   - Test quota limit enforcement

3. **Landing Page**
   - Verify pricing page loads
   - Test Dodo checkout flow
   - Verify legal pages render
   - Test responsive design

4. **Error Monitoring**
   - Trigger test error
   - Verify Sentry captures error
   - Check user context attached
   - Verify error grouping

---

## Deployment Strategy

### Development Environment

```bash
# Start OSS services
docker-compose up -d

# Or run individually
pnpm run dev:server
pnpm run dev:client
```

### Production Deployment

**Architecture**:
```
CDN (Landing Page) → formulai.com
                  ↓
Load Balancer → app.formulai.com
                  ↓
         ┌─────────┴─────────┐
         ↓                   ↓
    SaaS Backend      OSS Frontend
    (NestJS)          (React/Nginx)
         ↓                   
    MongoDB Atlas
    Redis Cloud
```

**Steps**:
1. Deploy landing page to Vercel/Netlify
2. Deploy SaaS backend to DigitalOcean/AWS/GCP
3. Build and serve OSS frontend via Nginx
4. Configure Dodo webhooks
5. Set up Sentry projects
6. Configure DNS and SSL

---

## Success Metrics

### Technical Metrics

- **Plugin Load Time**: < 100ms per plugin
- **Zero Impact on OSS**: No performance degradation without plugins
- **Easy Development**: New plugin in < 1 day
- **Flexible Deployment**: Switch plugins without code changes

### Business Metrics

- **Conversion Rate**: % of free trial users upgrading to paid
- **MRR Growth**: Monthly Recurring Revenue
- **Churn Rate**: % of subscribers canceling
- **Usage Efficiency**: Average cost per user vs revenue
- **Error Rate**: Sentry error count (target: <1% of requests)
- **Uptime**: Target 99.9% availability

---

## Next Steps

1. ✅ **Approve plugin architecture approach**
2. Implement plugin infrastructure in OSS core
3. Develop billing plugin
4. Develop usage tracking plugin
5. Develop monitoring plugin
6. Create deployment documentation
7. Test plugin loading and functionality
8. Set up Dodo Payments account
9. Create Sentry projects
10. Build landing page
11. Launch beta with limited users
12. Iterate based on feedback

---

## Open Questions

### Still To Decide

1. **Trial Strategy** - Credit card required upfront? Grace period after trial?
2. **Feature Differentiation** - Any tier-exclusive features beyond limits?
3. **Domain Strategy** - formulai.com vs app.formulai.com?
4. **Annual Plans** - Offer annual discount later (e.g., 15% off)?
5. **Refund Policy** - 30-day money-back guarantee?

---

## Cost Estimates

### Development Time

- Plugin infrastructure: ~15 hours
- Billing plugin: ~20 hours
- Usage tracking: ~15 hours
- Monitoring setup: ~10 hours
- Admin dashboard: ~15 hours
- Landing page: ~25 hours
- Testing & documentation: ~15 hours
- **Total**: ~115 hours

### Operational Costs (Monthly)

**Fixed Costs** (~$150/month for 100-500 users):
- Server/App Hosting: $20-50
- MongoDB Atlas: $25-60
- Redis Cloud: $10-20
- Sentry: $0-26
- Domain/SSL: $2-5
- Email (SMTP): $5-10
- Bandwidth: $5-15

**Variable Costs** (per user):
- AI costs: $0.005-0.30/month (depending on usage)
- Dodo fees: 4% + $0.40 per transaction

**Break-Even**: ~10 users

---

## Appendix

### Useful Resources

- [Dodo Payments Documentation](https://docs.dodo.com)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/node/guides/nestjs/)
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- [OpenAI Pricing](https://openai.com/pricing)

### Contact

For questions about this implementation plan, contact the development team.

---

**Last Updated**: 2024-11-24  
**Version**: 1.0  
**Status**: Planning Phase
