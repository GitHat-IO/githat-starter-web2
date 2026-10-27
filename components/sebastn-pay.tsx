// Card payments through SebasTN: one element and SebasTN's script. The charge is made on YOUR Stripe account (you
// are the merchant of record; SebasTN takes its published fee on the charge). Get your merchant id by connecting
// Stripe at https://sebastn.com (README, step 3) and set NEXT_PUBLIC_SEBASTN_MERCHANT.
// Until it is set the button says payments are not set up yet; nothing breaks.

import Script from "next/script";

export function SebastnPay(props: { amount: string; label: string; mode?: "payment" | "subscription"; interval?: "month" | "year" }) {
  const merchant = process.env.NEXT_PUBLIC_SEBASTN_MERCHANT ?? "";
  return (
    <>
      <div
        data-sebastn
        data-amount={props.amount}
        data-label={props.label}
        data-merchant={merchant}
        data-api="https://sebastn.com"
        {...(props.mode === "subscription" ? { "data-mode": "subscription", "data-interval": props.interval ?? "month" } : {})}
      />
      <Script src="https://sebastn.com/os.js" strategy="afterInteractive" />
    </>
  );
}
