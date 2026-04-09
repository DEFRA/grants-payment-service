export const compressResponsePlugin = {
  plugin: {
    name: 'compressResponse',
    register: async function (server, options) {
      const defaultEncoding = options.defaultEncoding || 'gzip'

      server.ext('onRequest', (request, h) => {
        const encoding = request.headers['accept-encoding']

        if (!encoding) {
          return h.continue
        }

        const hasWildcard = encoding.includes('*')
        const hasConcreteEncoding = /(gzip|br|deflate)/i.test(encoding)

        if (hasWildcard && !hasConcreteEncoding) {
          request.headers['accept-encoding'] = defaultEncoding
          request.info.acceptEncoding = defaultEncoding
        }

        return h.continue
      })
    }
  }
}
