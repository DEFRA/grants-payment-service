import {
  createMetricsLogger,
  Unit,
  StorageResolution
} from 'aws-embedded-metrics'
import { config } from '#~/config/index.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'

const logger = getLogger()

/**
 * @param {string} metricName
 * @param {number} value
 */
const metricsCounter = async (metricName, value = 1) => {
  const isMetricsEnabled = config.get('featureFlags.isMetricsEnabled')

  if (!isMetricsEnabled) {
    return
  }

  try {
    const metricsLogger = createMetricsLogger()
    metricsLogger.putMetric(
      metricName,
      value,
      Unit.Count,
      StorageResolution.Standard
    )
    await metricsLogger.flush()
  } catch (error) {
    logger.error(error, error.message)
  }
}

export { metricsCounter }
