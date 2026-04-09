import { config } from '#~/config/index.js'

/**
 * Wraps results with pagination metadata.
 * @param {Array} docs - The list of documents for the current page.
 * @param {number} totalDocs - The total number of documents matching the filters.
 * @param {number} page - The current page number.
 * @param {number} limit - The number of items per page.
 * @returns {Object} The standardized response with docs and pagination metadata.
 */
export const wrapWithPagination = (
  docs,
  totalDocs,
  page,
  limit = config.get('paginationLimit')
) => {
  return {
    docs,
    pagination: {
      page: page || 1,
      total: Math.ceil(totalDocs / limit) || 1
    }
  }
}
