import { SebastnPay } from "../components/sebastn-pay";
import { currentUser } from "../lib/auth";

export default async function Home() {
  const user = await currentUser();
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1>Your app is ready.</h1>

      <h2>Sign in</h2>
      {user ? (
        <form method="post" action="/api/auth/logout">
          <p>Signed in as {user.email}.</p>
          <button type="submit">Sign out</button>
        </form>
      ) : (
        <p><a href="/api/auth/google/start">Sign in with Google</a></p>
      )}

      <h2>Take a card payment</h2>
      <p>Through SebasTN, straight to your Stripe account. You write no payment code.</p>
      <SebastnPay amount="5.00" label="Pay $5" />

      <h2>Get paid per call (x402)</h2>
      <p>
        <code>GET /api/x402/hello</code> answers 402 with what to pay; an agent or any x402 client pays 0.01 test USDC on
        Base Sepolia and gets the answer. Copy that route for your own paid endpoints.
      </p>
    </main>
  );
}
