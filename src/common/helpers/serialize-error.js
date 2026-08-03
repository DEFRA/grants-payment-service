/**
 * Convert an Error object into a serializable plain object.
 * This ensures that error details like message and stack are included when stringified to JSON.
 * @param {Error|any} error - The error to serialize.
 * @returns {object|any} - A serializable version of the error or the original value if not an Error.
 */
export const serializeError = (error) => {
  if (!(error instanceof Error)) {
    return error
  }

  const serializable = {
    name: error.name,
    message: error.message,
    stack: error.stack
  }

  // Copy any custom enumerable properties
  Object.getOwnPropertyNames(error).forEach((key) => {
    serializable[key] = error[key]
  })

  return serializable
}
