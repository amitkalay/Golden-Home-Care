import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "../../../lib/stripe";
import {
  markCheckoutSessionFailed,
  markCheckoutSessionPaid,
  refreshProviderStripeAccount,
} from "../../../payments/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        await markCheckoutSessionPaid(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "checkout.session.async_payment_failed": {
        await markCheckoutSessionFailed(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "checkout.session.expired": {
        await markCheckoutSessionFailed(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await refreshProviderStripeAccount(account.id);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Failed to process Stripe webhook", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
