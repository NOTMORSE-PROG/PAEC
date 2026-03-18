export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeDatabase } = await import('./lib/database')
      await initializeDatabase()
    } catch (error) {
      console.error('Database initialization failed (non-fatal):', error)
    }
  }
}
