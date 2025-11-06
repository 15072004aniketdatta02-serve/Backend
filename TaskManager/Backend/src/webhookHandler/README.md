# Webhook Handler

A production-ready webhook handler system for the TaskManager application with support for multiple webhook sources, signature verification, and event processing.

## Features

- ✅ **OOP Design**: Clean class-based architecture with separation of concerns
- ✅ **Multiple Sources**: Support for GitHub, Stripe, and generic webhooks
- ✅ **Signature Verification**: HMAC-based signature verification for security
- ✅ **Event Processing**: Flexible event handler registration system
- ✅ **Error Handling**: Robust error handling with logging
- ✅ **Security**: Protection against replay attacks and invalid signatures

## Architecture

### Classes

1. **WebhookHandler**: Main class that manages webhook routes and processing
2. **WebhookVerifier**: Handles signature verification for different webhook sources
3. **WebhookProcessor**: Processes webhook payloads and executes handlers

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Webhook Configuration
WEBHOOK_REQUIRE_SIGNATURE=true
WEBHOOK_SECRET=your-generic-webhook-secret

# GitHub Webhooks
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

# Stripe Webhooks
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Or use source-specific secrets
WEBHOOK_SECRET_GITHUB=your-github-secret
WEBHOOK_SECRET_STRIPE=your-stripe-secret
```

## Usage

### Basic Setup

The webhook handler is already integrated in `src/app.js` and routes are configured in `src/routes/webhook.routes.js`.

### Webhook Endpoints

- **Generic**: `POST /api/v1/webhooks/:source`
- **Health Check**: `GET /api/v1/webhooks/health`

### Registering Handlers

Edit `src/routes/webhook.routes.js` to register your webhook handlers:

```javascript
import { WebhookHandler } from '../webhookHandler/index.js';
import { Logger } from '../logger/logger.js';

const webhookHandler = new WebhookHandler({
  logger: new Logger('webhook', 'webhook.log'),
  config: {
    requireSignature: true,
    secrets: {
      github: process.env.GITHUB_WEBHOOK_SECRET,
      stripe: process.env.STRIPE_WEBHOOK_SECRET,
    },
  },
});

// Register a handler for a specific event type
webhookHandler.registerHandler('github.push', async (payload, metadata) => {
  // Your business logic here
  console.log('GitHub push event:', payload);
  
  // Access metadata
  const { source, headers, ip, timestamp } = metadata;
  
  return { processed: true };
});

// Register multiple handlers
webhookHandler.registerHandlers({
  'github.push': async (payload, metadata) => {
    // Handle push events
  },
  'github.pull_request': async (payload, metadata) => {
    // Handle PR events
  },
  'payment_intent.succeeded': async (payload, metadata) => {
    // Handle successful payments
  },
});
```

### Using in Controllers

You can also access the webhook handler from controllers:

```javascript
// In your controller
export const triggerWebhook = async (req, res) => {
  const webhookHandler = req.app.locals.webhookHandler;
  
  // Process a webhook event programmatically
  const result = await webhookHandler.getProcessor().process(
    'task.created',
    { taskId: '123', title: 'New Task' },
    { source: 'internal', timestamp: new Date().toISOString() }
  );
  
  res.json(result);
};
```

## Supported Webhook Sources

### GitHub

**Endpoint**: `POST /api/v1/webhooks/github`

**Signature Header**: `X-Hub-Signature-256` or `X-Hub-Signature`

**Event Type**: Extracted from `X-GitHub-Event` header or `payload.action`

**Example**:
```javascript
webhookHandler.registerHandler('github.push', async (payload, metadata) => {
  const { ref, commits, repository } = payload;
  // Handle push event
});
```

### Stripe

**Endpoint**: `POST /api/v1/webhooks/stripe`

**Signature Header**: `Stripe-Signature`

**Event Type**: Extracted from `payload.type`

**Example**:
```javascript
webhookHandler.registerHandler('payment_intent.succeeded', async (payload, metadata) => {
  const { data } = payload;
  // Handle successful payment
});
```

### Generic

**Endpoint**: `POST /api/v1/webhooks/generic`

**Signature Header**: `X-Signature` or `Signature`

**Event Type**: Extracted from `X-Event-Type` header or `payload.event` or `payload.type`

**Example**:
```javascript
webhookHandler.registerHandler('task.created', async (payload, metadata) => {
  // Handle generic task creation webhook
});
```

## Testing Webhooks

### Using cURL

```bash
# GitHub webhook
curl -X POST http://localhost:9000/api/v1/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=your-signature" \
  -d '{"action":"push","repository":{"name":"repo"}}'

# Stripe webhook
curl -X POST http://localhost:9000/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=timestamp,v1=signature" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{}}}'

# Generic webhook
curl -X POST http://localhost:9000/api/v1/webhooks/generic \
  -H "Content-Type: application/json" \
  -H "X-Signature: your-signature" \
  -H "X-Event-Type: task.created" \
  -d '{"event":"task.created","data":{"taskId":"123"}}'
```

### Health Check

```bash
curl http://localhost:9000/api/v1/webhooks/health
```

Response:
```json
{
  "status": "ok",
  "registeredHandlers": [
    "github.push",
    "github.pull_request",
    "payment_intent.succeeded"
  ]
}
```

## Security Best Practices

1. **Always enable signature verification** in production:
   ```javascript
   config: {
     requireSignature: true,
   }
   ```

2. **Use strong, unique secrets** for each webhook source

3. **Store secrets in environment variables**, never in code

4. **Validate webhook payloads** before processing

5. **Implement rate limiting** for webhook endpoints

6. **Log all webhook events** for auditing

## Event Handler Function Signature

```typescript
async function handler(
  payload: any,           // Parsed webhook payload
  metadata: {             // Additional metadata
    source: string,       // Webhook source (github, stripe, generic)
    headers: object,      // Request headers
    signature: string,    // Signature from headers
    ip: string,          // Client IP address
    userAgent: string,   // User agent
    timestamp: string,   // ISO timestamp
  }
): Promise<any>          // Return value (optional)
```

## Error Handling

Errors are automatically caught and logged. The webhook handler will:

- Return `401` for invalid signatures
- Return `400` for invalid JSON payloads
- Return `500` for processing errors
- Log all errors with full context

## Advanced Usage

### Custom Verification

```javascript
const verifier = webhookHandler.getVerifier();

// Custom verification logic
const isValid = verifier.verifyHMAC(
  payload,
  signature,
  secret,
  'sha256'
);
```

### Programmatic Processing

```javascript
const processor = webhookHandler.getProcessor();

// Process event programmatically
await processor.process(
  'custom.event',
  { data: 'value' },
  { source: 'internal', timestamp: new Date().toISOString() }
);
```

## Integration with Socket Manager

You can emit real-time updates when webhooks are received:

```javascript
webhookHandler.registerHandler('task.created', async (payload, metadata) => {
  const socketManager = app.locals.socketManager;
  
  // Emit to project room
  socketManager.emitToProject(
    payload.projectId,
    'task:created',
    payload
  );
  
  return { processed: true };
});
```

## Troubleshooting

### Signature Verification Fails

- Check that the secret matches the one configured in the webhook provider
- Ensure the raw body is being used (not parsed JSON)
- Verify the signature algorithm matches (sha256, sha1, etc.)

### Handler Not Executing

- Check that the event type matches exactly
- Verify the handler is registered before the webhook is received
- Check logs for error messages

### Body Parsing Issues

- Ensure webhook routes are registered before `express.json()` middleware
- Verify `express.raw()` is used in the webhook handler

