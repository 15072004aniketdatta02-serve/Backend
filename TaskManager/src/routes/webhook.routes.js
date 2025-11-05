import { WebhookHandler } from '../webhookHandler/index.js';
import { Logger } from '../logger/logger.js';

// Initialize webhook handler
const webhookHandler = new WebhookHandler({
  logger: new Logger('webhook', 'webhook.log'),
  config: {
    requireSignature: process.env.WEBHOOK_REQUIRE_SIGNATURE !== 'false',
    secrets: {
      github: process.env.GITHUB_WEBHOOK_SECRET,
      stripe: process.env.STRIPE_WEBHOOK_SECRET,
      generic: process.env.WEBHOOK_SECRET,
    },
  },
});

// Register webhook handlers
// Example: GitHub webhook handlers
webhookHandler.registerHandler('github.push', async (payload, metadata) => {
  // Handle GitHub push event
  console.log('GitHub push event received:', payload);
  // Add your business logic here
  return { processed: true };
});

webhookHandler.registerHandler('github.pull_request', async (payload, metadata) => {
  // Handle GitHub pull request event
  console.log('GitHub pull request event received:', payload);
  // Add your business logic here
  return { processed: true };
});

// Example: Stripe webhook handlers
webhookHandler.registerHandler('payment_intent.succeeded', async (payload, metadata) => {
  // Handle successful payment
  console.log('Payment succeeded:', payload);
  // Add your business logic here
  return { processed: true };
});

webhookHandler.registerHandler('customer.subscription.deleted', async (payload, metadata) => {
  // Handle subscription cancellation
  console.log('Subscription cancelled:', payload);
  // Add your business logic here
  return { processed: true };
});

// Generic webhook handlers
webhookHandler.registerHandler('task.created', async (payload, metadata) => {
  // Handle task creation webhook
  console.log('Task created webhook:', payload);
  // Add your business logic here
  return { processed: true };
});

// Export the router and handler instance
export { webhookHandler };
export default webhookHandler.getRouter();

