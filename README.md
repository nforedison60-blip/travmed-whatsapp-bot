# TravMed WhatsApp Bot

A WhatsApp chatbot for **TravMed International** (travmed.co.za), built on Meta's official **WhatsApp Cloud API**.

**What it does** (follows TravMed's own WhatsApp script)

1. *Welcome to TravMed 😊 What would you like to book?* Medical Check Up / Appointments / Assessments / Reports
2. *Which area?* Johannesburg, Pretoria, Durban, Bloemfontein, Gqeberha, Polokwane, Mbombela, Kimberley, Rustenburg
3. *Our medical assessments cost R3 050. You pay the Doctor on arrival*
4. *What time would you prefer?* 9–11am / 11am–2pm / 2–5pm
5. *Please send your Name, Cell Number (for calls) and email address.* These can come in one message or several, and the bot asks only for what's missing.
6. *One of our consultants will call you from our 087 703 3699 number. Have a good day 😊*

Customers can tap the options or type the number (e.g. "3"), like in the original script. Typed names work too ("durban", "Nelspruit", "Port Elizabeth"). `hi`/`menu` restarts and `cancel` stops. Each completed booking is **emailed to info@travmed.co.za** with the client's details and a `wa.me` link.

```
src/
  content.js   ← all wording, areas, time slots, price. Edit this to change what the bot says
  bot.js       ← conversation flow
  whatsapp.js  ← WhatsApp Cloud API calls
  mailer.js    ← emails leads (SMTP)
  index.js     ← web server + Meta webhook
test/flow.test.js
```

---

## 1. Changing the wording

All messages, areas, booking types, time slots and the price are in `src/content.js`. Change them there and redeploy.

---

## 2. Set up WhatsApp on Meta (about 30–60 min)

> ⚠️ **About the phone number:** a number connected to the Cloud API normally **can't also be used in the regular WhatsApp / WhatsApp Business app**. If TravMed's number is on the app now, either use a different number for the bot, or delete the WhatsApp account on that number first (back up chats). Some providers offer "coexistence" so one number can use both the app and the API. Ask about this if you need it.

1. **Meta Business portfolio.** Sign in at <https://business.facebook.com> and create a portfolio for TravMed, or use an existing one. Business verification is recommended because it raises messaging limits.
2. **Create the app.** Go to <https://developers.facebook.com/apps> → **Create app** → use case **"Connect with customers through WhatsApp"** (or type *Business*) → link it to the TravMed portfolio.
3. **Add the number.** In the app, open **WhatsApp → API Setup** → **Add phone number**, then enter TravMed's details, display name *TravMed International* and the number. Verify it by SMS or voice call.
   - Copy the **Phone number ID** (a long number, *not* the phone number) → `WHATSAPP_PHONE_NUMBER_ID`
4. **Permanent access token.** The token shown on API Setup expires after 24 hours, so make a permanent one:
   - Business settings → **Users → System users** → **Add**, with role *Admin*
   - **Assign assets** → Apps → your app → *Full control*. Also assign the WhatsApp account.
   - **Generate token** → choose the app, expiry **Never**, permissions `whatsapp_business_messaging` + `whatsapp_business_management`
   - Copy it → `WHATSAPP_ACCESS_TOKEN`
5. **App secret.** App settings → **Basic** → **App secret** → *Show* → `META_APP_SECRET`
6. **Payment method.** In WhatsApp Manager, add a card. Under Meta's current pricing, replies inside the 24-hour window after a customer messages you are free service messages, and this bot only sends that kind. Check <https://developers.facebook.com/docs/whatsapp/pricing> for current rates.

---

## 3. Deploy on Render

1. Put this folder in a **GitHub** repo. `.env` is git-ignored, so never commit secrets.
2. At <https://render.com>, go to **New → Web Service** → pick the repo.
   - Runtime **Node** · Build `npm install` · Start `npm start`
3. Under **Environment**, add the variables from `.env.example`:

| Variable | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | permanent token from step 2.4 |
| `WHATSAPP_PHONE_NUMBER_ID` | from step 2.3 |
| `WHATSAPP_VERIFY_TOKEN` | **any random string you invent**, e.g. `travmed-8f3k2q` |
| `META_APP_SECRET` | from step 2.5 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | TravMed's email account SMTP details, from their email host |
| `LEADS_EMAIL_TO` | `info@travmed.co.za` |

4. Deploy, then open `https://<your-app>.onrender.com/`. It should say *"TravMed WhatsApp bot is running."*

> **Free vs paid plan:** Render's free plan sleeps after about 15 minutes with no traffic, so the first message after a quiet spell can take up to a minute to get a reply. For a business line, the **Starter** plan keeps the bot always on.

---

## 4. Connect the webhook

1. In the Meta app, open **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://<your-app>.onrender.com/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN` you set on Render
   - **Verify and save**
2. Under **Webhook fields**, **subscribe to `messages`**.
3. Send "Hi" to the TravMed number from your phone. The menu should appear. Complete a test booking and check info@travmed.co.za.

If something fails, check **Render → Logs**. Leads are also printed there if email isn't set up.

---

## 5. Add a WhatsApp button to the website

Link to `https://wa.me/27XXXXXXXXX?text=Hi` (the number in international format, without `+` or spaces). In WordPress you can use a "Click to Chat" plugin, or paste this into a Custom HTML block or the footer:

```html
<a href="https://wa.me/27XXXXXXXXX?text=Hi%20TravMed" target="_blank" rel="noopener"
   style="position:fixed;right:20px;bottom:20px;z-index:9999;background:#25D366;color:#fff;
          padding:14px 18px;border-radius:30px;font:600 15px sans-serif;text-decoration:none;
          box-shadow:0 4px 12px rgba(0,0,0,.2)">💬 Chat on WhatsApp</a>
```

---

## Running locally / tests

```
npm install && npm test
```

To try the live webhook from your own PC, run `npm start` with a `.env` file (`node --env-file=.env src/index.js`) and expose port 3000 with a tunnel such as ngrok.

## Notes

- Half-finished bookings are kept in memory for 30 minutes. A redeploy or restart clears them, but completed leads are already emailed.
- Staff can reply to customers in **WhatsApp Manager** or another API inbox. The regular WhatsApp app can't be used on an API number unless you set up coexistence.
