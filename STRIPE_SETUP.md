# Stripe Payment Integration Setup

This guide walks you through setting up Stripe payment processing for Bix Fitness Coaching Platform.

## Prerequisites

- Stripe account (create at https://stripe.com)
- Netlify account with deployment configured
- Your Firebase project fully set up

## Step 1: Create a Stripe Account

1. Go to https://stripe.com and create a free account
2. Complete the verification process
3. You'll be taken to the Stripe Dashboard

## Step 2: Get Your Stripe Keys

1. From the Stripe Dashboard, click **"Developers"** in the left sidebar
2. Click **"API keys"**
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

4. Save both keys somewhere safe (you'll need them in the next steps)

## Step 3: Set Up Netlify Environment Variables

Your Netlify Functions need access to your Stripe secret key. Here's how to add it:

### Option A: Using Netlify UI

1. Go to your Netlify site dashboard
2. Click **"Site Settings"** → **"Build & Deploy"** → **"Environment"**
3. Click **"Edit variables"**
4. Add a new variable:
   - **Key:** `STRIPE_SECRET_KEY`
   - **Value:** Your secret key from Step 2 (e.g., `sk_test_51234567890...`)
5. Save and redeploy your site

### Option B: Using netlify.toml

Edit `netlify.toml` to include environment variables:

```toml
[build.environment]
STRIPE_SECRET_KEY = "sk_test_YOUR_SECRET_KEY_HERE"
```

**⚠️ Warning:** Don't commit the secret key to version control!

## Step 4: Configure the Frontend

You need to provide your Stripe **publishable key** to the frontend. There are three ways:

### Option A: Store in localStorage (Development Only)

In `coach.html`, after the sidebar is loaded, add:
```javascript
// After sessionReady event
localStorage.setItem('stripe_public_key', 'pk_test_YOUR_PUBLISHABLE_KEY_HERE');
```

### Option B: Use Firebase Remote Config (Recommended)

1. Go to your Firebase Console
2. Click **Remote Config** in the left sidebar
3. Create a new parameter:
   - **Parameter key:** `stripe_public_key`
   - **Default value:** Your publishable key (e.g., `pk_test_51234567890...`)
4. Publish the config

Then update `coach.html` module script:
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getRemoteConfig } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-remote-config.js';

// ... after Firebase init ...
const remoteConfig = getRemoteConfig();
await remoteConfig.ensureInitialized();
const stripeKey = remoteConfig.getValue('stripe_public_key').asString();
localStorage.setItem('stripe_public_key', stripeKey);
```

### Option C: Environment Variables (if using a build process)

Add to your `.env` file:
```
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

## Step 5: Test the Integration

### 5a. Use Stripe Test Cards

Stripe provides test card numbers for development:

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Test card - Success |
| 4000 0000 0000 0002 | Test card - Card declined |
| 3782 822463 10005 | Test card - American Express |

- **Expiry:** Any future date (e.g., 12/25)
- **CVC:** Any 3-digit number (e.g., 123)

### 5b. Deploy and Test

1. Commit your changes to git
2. Push to your branch
3. Netlify will automatically deploy
4. Go to your live site and test the payment flow:
   - Click **"Billing"** → **"Card"**
   - Fill in member and amount
   - Use a test card number above
   - Click **"Pay Now"**

## Step 6: Monitor Transactions

### In Stripe Dashboard

1. Click **"Payments"** in the left sidebar
2. You'll see all payment attempts
3. Click a payment to see details

### In Firebase Console

1. Go to **Firestore Database**
2. Look for the `transactions` collection
3. Each successful payment is logged here with:
   - Payment Intent ID
   - Member info
   - Amount and duration
   - Timestamp

## Step 7: Switch to Live Mode

Once you're ready to accept real payments:

1. Go to Stripe Dashboard → **"Developers"** → **"API keys"**
2. Toggle to **"Live"** to get your live keys
3. Replace `pk_test_` and `sk_test_` with `pk_live_` and `sk_live_` versions
4. Update your Netlify environment variables with live keys
5. Update your frontend with the live public key

## Troubleshooting

### "Stripe.js failed to load"
- Check that Stripe.js is loading from CDN (network tab in DevTools)
- Ensure your domain is whitelisted in Stripe settings

### "Invalid Stripe public key format"
- Verify the key starts with `pk_test_` or `pk_live_`
- Don't confuse publishable key with secret key

### "Payment Element not rendering"
- Check browser console for errors
- Ensure Stripe public key is set correctly
- Test in Incognito/Private mode to avoid cache issues

### "Failed to create payment intent"
- Check that Netlify Functions are deployed (check status in Netlify UI)
- Verify `STRIPE_SECRET_KEY` environment variable is set
- Check Netlify function logs for errors

## Next Steps

- [ ] Create Stripe account and get API keys
- [ ] Set up Netlify environment variables
- [ ] Configure frontend with publishable key
- [ ] Test payment flow with test cards
- [ ] Test on mobile devices
- [ ] Monitor transactions in Stripe + Firebase
- [ ] Switch to live keys when ready for real payments
