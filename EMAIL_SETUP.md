# Email Setup Guide for Vercel

This guide will help you configure email functionality using Resend (free tier available).

## Step 1: Sign up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

## Step 2: Get Your API Key

1. Log in to Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Give it a name (e.g., "Advice Response App")
5. Copy the API key (starts with `re_...`)

## Step 3: Verify Your Domain (Optional but Recommended)

For production use, you should verify your domain:
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Follow the DNS setup instructions
4. Once verified, you can use emails like `noreply@yourdomain.com`

**Note:** For testing, you can use the default `onboarding@resend.dev` email (limited to receiving emails only).

## Step 4: Configure Vercel Environment Variables

### Option A: Via Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   - **Name:** `RESEND_API_KEY`
   - **Value:** Your Resend API key (e.g., `re_xxxxxxxxxxxxx`)
   - **Environment:** Production, Preview, Development (select all)

   - **Name:** `RECIPIENT_EMAIL`
   - **Value:** Your email address where submissions should be sent
   - **Environment:** Production, Preview, Development (select all)

   - **Name:** `FROM_EMAIL` (Optional)
   - **Value:** Your verified domain email (e.g., `noreply@yourdomain.com`) or `onboarding@resend.dev` for testing
   - **Environment:** Production, Preview, Development (select all)

### Option B: Via Vercel CLI

```bash
vercel env add RESEND_API_KEY
# Paste your API key when prompted

vercel env add RECIPIENT_EMAIL
# Paste your email address when prompted

vercel env add FROM_EMAIL
# Paste your from email (or use onboarding@resend.dev)
```

## Step 5: Redeploy

After adding environment variables, redeploy your application:

```bash
vercel --prod
```

Or push to your Git repository (if auto-deploy is enabled).

## Testing

1. Submit a response using the Submit button
2. Check your email inbox (and spam folder)
3. You should receive a formatted email with all submission data

## Troubleshooting

### Email not sending?

1. **Check Vercel logs:**
   - Go to Vercel dashboard → Your project → **Deployments** → Click on latest deployment → **Functions** → `api/send-email` → View logs

2. **Verify environment variables:**
   - Make sure variables are set for the correct environment (Production/Preview/Development)

3. **Check Resend dashboard:**
   - Go to Resend → **Logs** to see email sending status
   - Check for any errors or rate limits

4. **Common issues:**
   - API key not set correctly
   - Recipient email not configured
   - Rate limit exceeded (free tier: 100 emails/day)
   - Domain not verified (if using custom domain)

### Using Default Email (Testing Only)

If you haven't verified a domain, you can use:
- **FROM_EMAIL:** `onboarding@resend.dev` (only works for receiving, not sending to external addresses)
- **RECIPIENT_EMAIL:** Your verified email address

**Note:** The default `onboarding@resend.dev` email can only receive emails, not send to external addresses. For production, verify your domain.

## Alternative: Using SendGrid

If you prefer SendGrid instead of Resend:

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key
3. Update `api/send-email.js` to use SendGrid API instead
4. Set environment variable `SENDGRID_API_KEY` instead of `RESEND_API_KEY`

## Cost

- **Resend Free Tier:** 100 emails/day, 3,000 emails/month
- **Resend Pro:** $20/month for 50,000 emails
- **SendGrid Free Tier:** 100 emails/day

For most use cases, the free tier should be sufficient.

