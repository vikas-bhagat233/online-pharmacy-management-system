const { Client, Environment, OrdersController } = require('@paypal/paypal-server-sdk');

function isConfigured() {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
  return Boolean(
    clientId &&
    clientSecret &&
    clientId !== 'your_client_id' &&
    clientSecret !== 'your_secret'
  );
}

function getClient() {
  if (!isConfigured()) {
    throw new Error('PayPal credentials are not configured');
  }

  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: process.env.PAYPAL_CLIENT_ID,
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
    },
    environment: String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase() === 'live'
      ? Environment.Production
      : Environment.Sandbox
  });
}

function getOrdersController() {
  const client = getClient();
  return new OrdersController(client);
}

function getOrderAmountInPaypalCurrency(amountInr) {
  const exchangeRate = Number(process.env.PAYPAL_INR_TO_USD || 0.012);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error('PAYPAL_INR_TO_USD must be a positive number');
  }

  return Math.max(0.01, Number((Number(amountInr || 0) * exchangeRate).toFixed(2))).toFixed(2);
}

module.exports = {
  getClient,
  getOrdersController,
  getOrderAmountInPaypalCurrency,
  isConfigured,
  mode: () => String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase(),
  currency: () => 'USD'
};