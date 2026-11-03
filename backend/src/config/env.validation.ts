import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().trim().min(1).required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).required(),
  DB_USER: Joi.string().trim().min(1).required(),
  DB_PASSWORD: Joi.string().min(1).required(),
  DB_NAME: Joi.string().trim().min(1).required(),

  REDIS_HOST: Joi.string().trim().min(1).required(),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).required(),

  INGEST_API_KEY: Joi.string().min(32).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  CORS_ORIGIN: Joi.string().uri().required(),
  // Trust Cloudflare's CF-Connecting-IP for the login rate limit. Only behind the proxy.
  // OpenRouteService. Optional: without it route distances and times stay null.
  ORS_API_KEY: Joi.string().allow('').optional(),
  TRUST_PROXY: Joi.boolean().default(false),
}).unknown(true);
