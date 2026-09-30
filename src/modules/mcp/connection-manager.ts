export interface McpClientPort<Tools> {
  tools(): Promise<Tools>
  close(): Promise<void>
}

interface Connection<Tools> {
  opening: Promise<Tools>
  client?: McpClientPort<Tools>
  closing?: Promise<void>
}

/** Own clients by server ID without coupling the lifecycle to an SDK or UI. */
export function createMcpConnectionManager<Config extends { id: string }, Tools>(
  createClient: (config: Config) => Promise<McpClientPort<Tools>>,
) {
  const connections = new Map<string, Connection<Tools>>()

  function close(id: string, entry: Connection<Tools>): Promise<void> {
    if (entry.closing) return entry.closing
    const client = entry.client
    if (!client) {
      if (connections.get(id) === entry) connections.delete(id)
      return Promise.resolve()
    }
    entry.closing = Promise.resolve()
      .then(() => client.close())
      .then(() => {
        entry.client = undefined
        if (connections.get(id) === entry) connections.delete(id)
      }, (error: unknown) => {
        // Keep ownership on failure, allowing explicit disconnect to retry.
        entry.closing = undefined
        throw error
      })
    return entry.closing
  }

  return {
    async connect(config: Config): Promise<Tools> {
      const id = config.id
      if (!id.trim()) throw new Error('MCP server ID must be non-empty.')
      if (connections.has(id)) {
        throw new Error('MCP server ID is already connecting or connected; disconnect it before reconnecting.')
      }

      // Reserve the ID before asynchronous creation/discovery can yield.
      const entry: Connection<Tools> = {
        opening: Promise.resolve().then(async () => {
          try {
            entry.client = await createClient(config)
            return await entry.client.tools()
          } catch (error) {
            try {
              await close(id, entry)
            } catch (cleanupError) {
              throw Object.assign(new Error('MCP connection setup and cleanup failed; retry disconnect before reconnecting.'), {
                cause: error,
                cleanupError,
              })
            }
            throw error
          }
        }),
      }
      connections.set(id, entry)
      return entry.opening
    },

    async disconnect(id: string): Promise<void> {
      const entry = connections.get(id)
      if (!entry) return
      // Pending discovery owns the client until it succeeds or cleans up.
      // A previous cleanup failure remains retryable below.
      await entry.opening.catch(() => {})
      await close(id, entry)
    },
  }
}
