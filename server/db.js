import { neon } from '@neondatabase/serverless'
import { serverConfig } from './config.js'
export function createDatabase(config = serverConfig()) {
  const sql = neon(config.databaseUrl)
  return {
    query: (statement, parameters = []) => sql.query(statement, parameters),
    transaction: async (buildQueries, options = {}) => {
      const results = await sql.transaction((transaction) => buildQueries({
        query: (statement, parameters = []) => transaction.query(statement, parameters),
      }), { isolationMode: 'Serializable', ...options })
      return results
    },
  }
}
