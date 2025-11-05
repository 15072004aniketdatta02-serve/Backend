import express from 'express';
import { WebhookVerifier } from './WebhookVerifier.js';
import { WebhookProcessor } from './WebhookProcessor.js';
import { Logger } from '../logger/logger.js';
import { ApiError } from '../APIStatus/APIError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Webhook Handler - Main class for handling webhooks
 */
export class WebhookHandler {
  #router;
  #verifier;
  #processor;
  #logger;
  #config;

  /**
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Logger instance
   * @param {Object} options.config - Webhook configuration
   */
  constructor({ logger, config = {} } = {}) {
    this.#logger = logger || new Logger('webhook', 'webhook.log');
    this.#verifier = new WebhookVerifier({ logger: this.#logger });
    this.#processor = new WebhookProcessor({ logger: this.#logger });
    this.#config = {
      requireSignature: config.requireSignature ?? true,
      secrets: config.secrets || {},
      ...config,
    };

    this.#router = express.Router();
    this.#setupRoutes();
  }

  /**
   * Sets up webhook routes
   */
  #setupRoutes() {
    // Generic webhook endpoint
    this.#router.post(
      '/:source',
      express.raw({ type: 'application/json', limit: '10mb' }),
      asyncHandler(this.#handleWebhook.bind(this))
    );

    // Health check for webhook endpoint
    this.#router.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        registeredHandlers: this.#processor.getRegisteredEventTypes(),
      });
    });
  }

  /**
   * Handles incoming webhook requests
   */
  async #handleWebhook(req, res) {
    const { source } = req.params;
    const rawBody = req.body?.toString('utf8') || JSON.stringify(req.body);
    
    try {
      // Parse payload
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (parseError) {
        throw new ApiError(400, 'Invalid JSON payload');
      }

      // Extract headers
      const headers = req.headers;
      const signature = this.#extractSignature(headers, source);

      // Verify signature if required
      if (this.#config.requireSignature) {
        const secret = this.#getSecret(source);
        if (!secret) {
          this.#logger?.warn('No secret configured for webhook source', {
            source,
          });
          throw new ApiError(401, 'Webhook secret not configured');
        }

        const isValid = await this.#verifySignature(
          source,
          rawBody,
          signature,
          secret
        );

        if (!isValid) {
          this.#logger?.warn('Webhook signature verification failed', {
            source,
            signature: signature?.substring(0, 20) + '...',
          });
          throw new ApiError(401, 'Invalid webhook signature');
        }
      }

      // Determine event type
      const eventType = this.#extractEventType(headers, payload, source);

      // Process webhook
      const metadata = {
        source,
        headers,
        signature,
        ip: req.ip,
        userAgent: headers['user-agent'],
        timestamp: new Date().toISOString(),
      };

      const result = await this.#processor.process(eventType, payload, metadata);

      if (!result.success) {
        throw new ApiError(500, result.error || 'Failed to process webhook');
      }

      // Log successful processing
      this.#logger?.info('Webhook processed successfully', {
        source,
        eventType,
        ip: req.ip,
      });

      // Send response
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        eventType,
      });
    } catch (error) {
      this.#logger?.error('Webhook processing error', {
        source,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Extracts signature from headers based on source
   */
  #extractSignature(headers, source) {
    const signatureHeaders = {
      github: headers['x-hub-signature-256'] || headers['x-hub-signature'],
      stripe: headers['stripe-signature'],
      generic: headers['x-signature'] || headers['signature'],
    };

    return signatureHeaders[source] || signatureHeaders.generic;
  }

  /**
   * Extracts event type from headers or payload
   */
  #extractEventType(headers, payload, source) {
    // GitHub
    if (source === 'github') {
      return headers['x-github-event'] || payload.action || 'unknown';
    }

    // Stripe
    if (source === 'stripe') {
      return payload.type || 'unknown';
    }

    // Generic
    return (
      headers['x-event-type'] ||
      headers['x-webhook-event'] ||
      payload.event ||
      payload.type ||
      'unknown'
    );
  }

  /**
   * Verifies webhook signature based on source
   */
  async #verifySignature(source, payload, signature, secret) {
    switch (source) {
      case 'github':
        return this.#verifier.verifyGitHub(payload, signature, secret);
      case 'stripe':
        return this.#verifier.verifyStripe(payload, signature, secret);
      default:
        return this.#verifier.verifyGeneric(payload, signature, secret);
    }
  }

  /**
   * Gets secret for webhook source
   */
  #getSecret(source) {
    // Check config secrets first
    if (this.#config.secrets?.[source]) {
      return this.#config.secrets[source];
    }

    // Check environment variables
    const envKey = `WEBHOOK_SECRET_${source.toUpperCase()}`;
    return process.env[envKey] || process.env.WEBHOOK_SECRET;
  }

  /**
   * Registers a webhook handler
   * @param {string} eventType - Event type
   * @param {Function} handler - Handler function
   */
  registerHandler(eventType, handler) {
    this.#processor.registerHandler(eventType, handler);
  }

  /**
   * Registers multiple handlers
   * @param {Object} handlers - Object mapping event types to handlers
   */
  registerHandlers(handlers) {
    this.#processor.registerHandlers(handlers);
  }

  /**
   * Gets the Express router
   * @returns {express.Router} - Express router
   */
  getRouter() {
    return this.#router;
  }

  /**
   * Gets the processor instance (for advanced usage)
   * @returns {WebhookProcessor} - Processor instance
   */
  getProcessor() {
    return this.#processor;
  }

  /**
   * Gets the verifier instance (for advanced usage)
   * @returns {WebhookVerifier} - Verifier instance
   */
  getVerifier() {
    return this.#verifier;
  }
}

