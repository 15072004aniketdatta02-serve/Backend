import { Logger } from '../logger/logger.js';

/**
 * Webhook Processor - Processes webhook payloads and executes handlers
 */
export class WebhookProcessor {
  #logger;
  #handlers = new Map(); // eventType -> handler function

  constructor({ logger }) {
    this.#logger = logger || new Logger('webhook', 'webhook.log');
  }

  /**
   * Registers a handler for a specific event type
   * @param {string} eventType - Type of webhook event
   * @param {Function} handler - Handler function
   */
  registerHandler(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.#handlers.set(eventType, handler);
    this.#logger?.debug('Webhook handler registered', { eventType });
  }

  /**
   * Registers multiple handlers at once
   * @param {Object} handlers - Object mapping event types to handlers
   */
  registerHandlers(handlers) {
    Object.entries(handlers).forEach(([eventType, handler]) => {
      this.registerHandler(eventType, handler);
    });
  }

  /**
   * Processes a webhook event
   * @param {string} eventType - Type of webhook event
   * @param {Object} payload - Webhook payload
   * @param {Object} metadata - Additional metadata (headers, source, etc.)
   * @returns {Promise<Object>} - Processing result
   */
  async process(eventType, payload, metadata = {}) {
    const handler = this.#handlers.get(eventType);

    if (!handler) {
      this.#logger?.warn('No handler registered for event type', {
        eventType,
        availableHandlers: Array.from(this.#handlers.keys()),
      });

      return {
        success: false,
        message: `No handler registered for event type: ${eventType}`,
      };
    }

    try {
      this.#logger?.info('Processing webhook event', {
        eventType,
        source: metadata.source,
        payloadSize: JSON.stringify(payload).length,
      });

      const result = await handler(payload, metadata);

      this.#logger?.info('Webhook event processed successfully', {
        eventType,
        source: metadata.source,
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      this.#logger?.error('Error processing webhook event', {
        eventType,
        source: metadata.source,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Gets all registered event types
   * @returns {Array<string>} - Array of event types
   */
  getRegisteredEventTypes() {
    return Array.from(this.#handlers.keys());
  }

  /**
   * Checks if a handler exists for an event type
   * @param {string} eventType - Event type to check
   * @returns {boolean} - True if handler exists
   */
  hasHandler(eventType) {
    return this.#handlers.has(eventType);
  }

  /**
   * Removes a handler
   * @param {string} eventType - Event type to remove handler for
   */
  removeHandler(eventType) {
    this.#handlers.delete(eventType);
    this.#logger?.debug('Webhook handler removed', { eventType });
  }
}

