import * as Joi from 'joi';

/**
 * Esquema de validación de variables de entorno.
 * La aplicación no arranca si falta una variable obligatoria.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().allow('').default(''),
  DB_SSL: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),

  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().default(465),
  SMTP_SECURE: Joi.boolean().default(true),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  MAIL_FROM_EMAIL: Joi.string().default('noreply@comfasucre.com.co'),
  MAIL_FROM_NAME: Joi.string().default('Comfasucre Admin'),

  COMUNICADOS_MAIL_MODE: Joi.string().valid('test', 'produccion').default('test'),
  COMUNICADOS_MAIL_TEST_TO: Joi.string().allow('').default(''),
  COMUNICADOS_MAIL_PROD_TO: Joi.string().allow('').default(''),

  UPLOADS_DIR: Joi.string().default('./uploads'),
  FRONTEND_URL: Joi.string().default('http://localhost:4200'),
});
