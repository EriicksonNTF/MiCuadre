export default {
  logging: {
    fetches: false,
    browserToTerminal: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
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
