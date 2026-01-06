/**
 * PM2 Ecosystem Configuration for Trader Bias Backend
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop traderbias-backend
 *   pm2 restart traderbias-backend
 *   pm2 logs traderbias-backend
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'traderbias-backend',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },

      // Restart policy
      autorestart: true,
      watch: false,
      max_memory_restart: '800M', // Restart if exceeds 800MB (safety margin on 1GB VPS)

      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Resource limits (optional, for extra safety)
      max_restarts: 10,
      min_uptime: '10s',

      // Cron restart (optional - restart daily at 4 AM to clear any memory leaks)
      cron_restart: '0 4 * * *'
    }
  ]
};
