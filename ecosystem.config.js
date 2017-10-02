module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    {
      name      : 'bobabot',
      script    : './index.js',
      watch     : true,
      ignore_watch: ["node_modules"],
      instance_var: 'INSTANCE_ID',
      env: {
        NODE_ENV: 'dev',
      },
      env_production : {
        NODE_ENV: 'prod'
      }
    },
  ]
};