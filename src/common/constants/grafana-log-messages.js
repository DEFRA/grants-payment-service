/**
 * WARNING: These log messages are monitored by Grafana
 * When changing, please update the Grafana alert rules
 * @type {Object}
 * @property {Object} error - Error log messages
 */
export const grafanaLogMessages = Object.freeze({
  error: {
    createPayment: 'Error creating grant payment',
    cancelPayment: 'Error cancelling grant payment',
    sendPaymentHubRequest: 'PaymentHub request failed'
  }
})
