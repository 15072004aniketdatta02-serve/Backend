import crypto from 'crypto';
import { ApiError } from '../APIStatus/APIError.js';

/**
 * Webhook Verifier - Handles signature verification for webhooks
 */
export class WebhookVerifier {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Verifies webhook signature using HMAC
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Signature from headers
   * @param {string} secret - Secret key for verification
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {boolean} - True if signature is valid
   */
  verifyHMAC(payload, signature, secret, algorithm = 'sha256') {
    if (!payload || !signature || !secret) {
      return false;
    }

    try {
      const hmac = crypto.createHmac(algorithm, secret);
      const digest = hmac.update(payload).digest('hex');
      
      // Handle different signature formats (with/without prefix)
      const signatureToCompare = signature.startsWith(`${algorithm}=`)
        ? signature.substring(algorithm.length + 1)
        : signature;

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signatureToCompare)
      );
    } catch (error) {
      this.#logger?.error('HMAC verification error', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Verifies GitHub webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - X-Hub-Signature-256 header value
   * @param {string} secret - GitHub webhook secret
   * @returns {boolean} - True if signature is valid
   */
  verifyGitHub(payload, signature, secret) {
    if (!signature) {
      return false;
    }

    return this.verifyHMAC(payload, signature, secret, 'sha256');
  }

  /**
   * Verifies Stripe webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Stripe-Signature header value
   * @param {string} secret - Stripe webhook secret
   * @returns {boolean} - True if signature is valid
   */
  verifyStripe(payload, signature, secret) {
    if (!signature || !secret) {
      return false;
    }

    try {
      const elements = signature.split(',');
      const signatureItems = {};
      
      elements.forEach((element) => {
        const [key, value] = element.split('=');
        signatureItems[key] = value;
      });

      const timestamp = signatureItems.t;
      if (!timestamp) {
        return false;
      }

      // Check timestamp (prevent replay attacks)
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampAge = currentTime - parseInt(timestamp, 10);
      
      // Reject if older than 5 minutes
      if (timestampAge > 300) {
        this.#logger?.warn('Stripe webhook timestamp too old', {
          timestampAge,
        });
        return false;
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signatureItems.v1),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.#logger?.error('Stripe signature verification error', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Verifies generic webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Signature from headers
   * @param {string} secret - Webhook secret
   * @param {Object} options - Verification options
   * @returns {boolean} - True if signature is valid
   */
  verifyGeneric(payload, signature, secret, options = {}) {
    const {
      algorithm = 'sha256',
      headerName = 'x-signature',
      prefix = '',
    } = options;

    return this.verifyHMAC(payload, signature, secret, algorithm);
  }
}

