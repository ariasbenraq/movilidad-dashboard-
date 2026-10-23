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
}).unknown(true);
