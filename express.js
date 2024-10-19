require('dotenv').config();
const express = require('express');
const braintree = require('braintree');
const bodyParser = require('body-parser');
const cors = require('cors');



const app = express();

app.use(cors());
// Use JSON body parser for all routes except /webhooks
app.use((req, res, next) => {
  if (req.path === '/webhooks') {
    bodyParser.urlencoded({ extended: false })(req, res, next);
  } else {
    bodyParser.json()(req, res, next);
  }
});

 
// Initialize Braintree gateway
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

// Generate client token
app.get('/client_token', async (req, res) => {
  try {
    const response = await gateway.clientToken.generate({});
    res.send(response.clientToken);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.post('/create_subscription', async (req, res) => {
  const nonceFromTheClient = req.body.paymentMethodNonce;
  const planId = req.body.planId;

  try {
    // First, create a customer
    const customerResult = await gateway.customer.create({
      paymentMethodNonce: nonceFromTheClient,
    });

    if (!customerResult.success) {
      console.log('Customer creation failed:', customerResult.message);
      return res.status(400).send(customerResult.message);
    }

    const customerId = customerResult.customer.id;

    // Then, create a subscription using the customer's default payment method
    const subscriptionResult = await gateway.subscription.create({
      paymentMethodToken: customerResult.customer.paymentMethods[0].token,
      planId: "sc78"
    });

    if (subscriptionResult.success) {
      console.log('Subscription created:', subscriptionResult.subscription);
      res.send(subscriptionResult.subscription);
    } else {
      console.log('Subscription creation failed:', subscriptionResult.message);
      res.status(400).send(subscriptionResult.message);
    }
  } catch (err) {
    console.log('Error:', err);
    res.status(500).send(err);
  }
});

app.post('/webhooks', (req, res) => {
  console.log("Webhook received");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  const bt_signature = req.body.bt_signature;
  const bt_payload = req.body.bt_payload;

  if (!bt_signature || !bt_payload) {
    console.log("Missing bt_signature or bt_payload");
    return res.status(400).send("Missing required fields");
  }

  gateway.webhookNotification.parse(
    bt_signature,
    bt_payload,
    (err, webhookNotification) => {
      if (err) {
        console.error("Error parsing webhook:", err);
        return res.status(500).send(err);
      }

      console.log("Webhook parsed successfully");
      console.log("Webhook kind:", webhookNotification.kind);

      if (webhookNotification.kind === braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully) {
        console.log('Subscription charged successfully');
        // Handle the successful charge (e.g., update database, send email)
      }

      res.status(200).send();
    }
  );
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});