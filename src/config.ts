const NODE_ENV = process.env.NODE_ENV || "development";
const appUrl = process.env.APP_URL || "http://localhost:3000";

function getMpesaBaseUrl(env: string): string {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export const config = {
  nodeEnv: NODE_ENV,
  isProd: NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl,
  corsOrigins: process.env.CORS_ORIGINS || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  mpesaEnv: process.env.MPESA_ENV || "sandbox",
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || "",
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
  mpesaShortCode: process.env.MPESA_SHORT_CODE || "",
  mpesaPasskey: process.env.MPESA_PASSKEY || "",
  mpesaWebhookSecret: process.env.MPESA_WEBHOOK_SECRET || "",
  mpesaCallbackUrl:
    process.env.MPESA_CALLBACK_URL || `${appUrl}/api/payments/mpesa-callback`,
  mpesaB2CInitiatorName: process.env.MPESA_B2C_INITIATOR_NAME || "",
  mpesaB2CSecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL || "",
  mpesaB2CResultUrl:
    process.env.MPESA_B2C_RESULT_URL || `${appUrl}/api/payments/b2c-result`,
  mpesaB2CQueueTimeoutUrl:
    process.env.MPESA_B2C_QUEUE_TIMEOUT_URL || `${appUrl}/api/payments/b2c-timeout`,
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFromAddress: process.env.EMAIL_FROM || "noreply@twendehub.com",
  emailFromName: process.env.EMAIL_FROM_NAME || "TwendeHub",
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  get mpesaBaseUrl(): string {
    return getMpesaBaseUrl(this.mpesaEnv);
  },
  get mpesaEnabled(): boolean {
    return !!this.mpesaConsumerKey && !!this.mpesaConsumerSecret && !!this.mpesaShortCode && !!this.mpesaPasskey;
  },
  get b2cEnabled(): boolean {
    return !!this.mpesaB2CInitiatorName && !!this.mpesaB2CSecurityCredential;
  },
  get redisEnabled(): boolean {
    return !!this.upstashRedisUrl && !!this.upstashRedisToken;
  },
};

if (config.isProd) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production");
  }
  if (!config.mpesaWebhookSecret) {
    throw new Error("MPESA_WEBHOOK_SECRET is required in production for secure callback verification");
  }
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is required in production for transactional emails");
  }
  if (!config.redisEnabled) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for rate limiting");
  }
}

export default config;
