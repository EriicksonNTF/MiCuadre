export default {
  logging: {
    fetches: false,
    browserToTerminal: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Se mantiene habilitada la caché de Webpack para que la compilación dev sea rápida.
      // Si ocurre corrupción de caché, 'pnpm dev' (mediante 'predev') la limpia automáticamente en cada inicio.
      config.cache = false

      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/coverage/**",
          "**/dist/**",
        ],
      }
    }

    return config
  },
}
