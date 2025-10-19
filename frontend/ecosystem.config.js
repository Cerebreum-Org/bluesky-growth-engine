module.exports = {
  apps: [{
    name: 'bluesky-frontend',
    script: './node_modules/.bin/next',
    args: 'start -H 0.0.0.0 -p 3000',
    cwd: '/home/cerebreum/bluesky-growth-engine/frontend',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
