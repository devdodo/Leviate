module.exports = {
  apps: [
    {
      name: 'leviate-api',
      script: 'dist/main.js',
      cwd: process.cwd(),
      instances: 2, // Use 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/leviate-error.log',
      out_file: '/var/log/pm2/leviate-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
    },
  ],
};

