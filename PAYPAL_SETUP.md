# PayPal Payment Integration Setup

Payment processing for Bix Fitness using PayPal — works from Israel. Free account, you only pay ~3.5% per transaction when someone actually pays you.

---

## Step 1: Create a PayPal Business Account

1. Go to https://www.paypal.com/il/business and click **Sign Up**
2. Choose **Business Account** (not Personal)
3. Complete email verification
4. You don't need to link a bank account until you want to receive real payments

---

## Step 2: Get Your Sandbox Credentials (Free Testing)

1. Go to https://developer.paypal.com
2. Log in with your PayPal account
3. Click **Apps & Credentials** in the top nav
4. Make sure you're on the **Sandbox** tab
5. Click **Create App**
   - App Name: `Bix Training`
   - App Type: Merchant
6. You'll see:
   - **Client ID** — copy this (starts with `AX...`)
   - **Secret** — click "Show" and copy this

---

## Step 3: Set Up Netlify Environment Variables

Go to your Netlify dashboard → **Site Settings** → **Build & Deploy** → **Environment variables** → **Add variable**:

| Key | Value |
|-----|-------|
| `PAYPAL_CLIENT_ID` | Your Client ID from Step 2 |
| `PAYPAL_CLIENT_SECRET` | Your Secret from Step 2 |
| `PAYPAL_SANDBOX` | `true` (for testing; change to `false` for live) |
| `FIREBASE_SERVICE_ACCOUNT` | Your Firebase service account JSON (see below) |

### Getting Firebase Service Account JSON:
1. Go to Firebase Console → Project Settings → **Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Copy the entire JSON content and paste it as the value of `FIREBASE_SERVICE_ACCOUNT`

---

## Step 4: Configure Frontend with Client ID

In `coach.html`, after the user logs in (inside the `sessionReady` event), add:

```javascript
localStorage.setItem('paypal_client_id', 'YOUR_SANDBOX_CLIENT_ID_HERE');
```

This tells the PayPal SDK which account to use. The `'sb'` default in the code is a generic sandbox test mode.

---

## Step 5: Test Payments in Sandbox

PayPal Sandbox provides test buyer accounts automatically. When the PayPal button popup appears:

1. Click the yellow **PayPal** button in the Bix payment modal
2. Log in with the **sandbox buyer email** (shown in PayPal Developer Dashboard → Sandbox → Accounts)
3. Approve the payment
4. You'll see the success message and membership will be updated

### Finding Your Sandbox Buyer Account:
1. PayPal Developer Dashboard → **Sandbox** → **Accounts**
2. You'll see a "Personal" account (the fake buyer) and "Business" account (your seller)
3. Click the Personal account → **View/Edit Account** to see the email and password

---

## Step 6: Check Transactions

### In PayPal Developer Dashboard:
- Go to **Sandbox** → **Notifications** to see test transactions

### In Firebase Firestore:
- Go to your Firebase Console → Firestore Database
- Look for the `transactions` collection
- Each successful payment creates a document with:
  - `paypalOrderId` — the PayPal order reference
  - `memberId`, `memberName` — who paid
  - `amount`, `duration` — what they paid for
  - `status: 'completed'`

---

## Step 7: Go Live (When Ready for Real Payments)

1. In PayPal Developer Dashboard, switch from **Sandbox** to **Live** tab
2. Create a **Live App** to get live credentials
3. Update Netlify environment variables:
   - Change `PAYPAL_CLIENT_ID` to the **Live** Client ID
   - Change `PAYPAL_CLIENT_SECRET` to the **Live** Secret
   - Change `PAYPAL_SANDBOX` from `true` to `false`
4. Update the `localStorage.setItem('paypal_client_id', ...)` in coach.html with your **Live** Client ID
5. Redeploy on Netlify

---

## Pricing Reminder

| Plan | Price | PayPal Fee (~3.5%) | You Keep |
|------|-------|-------------------|----------|
| 1 Month | $29.99 | ~$1.05 | ~$28.94 |
| 3 Months | $79.99 | ~$2.80 | ~$77.19 |
| 1 Year | $249.99 | ~$8.75 | ~$241.24 |

---

## Troubleshooting

**PayPal buttons don't appear:**
- Check that your Client ID is set in localStorage
- Open browser DevTools → Console for errors
- Make sure Netlify Functions are deployed

**"Failed to create order" error:**
- Check Netlify Function logs (Netlify Dashboard → Functions)
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set correctly
- Make sure `PAYPAL_SANDBOX=true` during testing

**Membership not updating after payment:**
- Check Firebase Firestore rules allow writes from Netlify Functions
- Verify `FIREBASE_SERVICE_ACCOUNT` is set correctly in Netlify env vars

**Payment succeeds but Firestore is not updated:**
- The `capture-paypal-order` function needs Firebase Admin access
- Check that the service account JSON is valid and has Firestore write permissions
