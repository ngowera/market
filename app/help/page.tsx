import { Header, Footer } from "@/components/marketplace";
export default function Help() {
  return (
    <>
      <Header />
      <main className="help-layout">
        <nav className="help-nav">
          <a href="#bidding">Bidding & buying</a>
          <a href="#payment">Payment</a>
          <a href="#collection">Collection</a>
          <a href="#terms">Sale terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#complaints">Help & complaints</a>
        </nav>
        <article className="help-copy">
          <div className="eyebrow">BUY WITH CONFIDENCE</div>
          <h1>A clear process, every step.</h1>
          <section id="bidding">
            <h2>Bidding & buying</h2>
            <p>
              Browse the condition report and specifications before choosing an
              asset. Create an account and verify your contact details to bid. A
              bid must meet the server’s minimum next bid. All auction close
              times display in Central Africa Time (CAT, UTC+2). Qualifying late
              bids may extend an auction to give other buyers a fair
              opportunity. The server confirms the winner; the countdown is
              informational.
            </p>
            <p>
              For fixed-price listings, Buy now reserves the asset for a limited
              checkout window. For offer-enabled listings, submit your amount
              and wait for the institution’s acceptance or counteroffer. An
              accepted offer does not confirm payment.
            </p>
          </section>
          <section id="payment">
            <h2>Payment</h2>
            <p>
              Checkout uses PayChangu’s hosted payment page. Never pay staff
              through an unofficial personal wallet. The platform verifies the
              transaction reference, amount and currency on the server. A
              successful return screen alone does not confirm that your order is
              paid. Your account shows the verified status.
            </p>
          </section>
          <section id="collection">
            <h2>Collection</h2>
            <p>
              Collection is available only after verified payment and staff
              release approval. Follow the collection location and deadline
              shown on your order. Bring identification matching your account or
              arrange an authorized collector with staff. Collection codes are
              single-use. Arrange suitable transport for vehicles and larger
              appliances.
            </p>
          </section>
          <section id="terms">
            <h2>Terms of sale</h2>
            <div className="legal-draft">
              Draft for institutional review. Final seller identity, approved
              auction terms, fees, tax treatment and complaint contacts must be
              configured before public launch.
            </div>
            <p>
              Assets are used collateral sold by the institution. Review known
              defects and inspect an asset where viewing is available.
              Descriptions must be accurate, and any applicable buyer fees must
              be disclosed before commitment. Rights, warranties, refunds, bid
              withdrawal and dispute handling are governed by the institution’s
              legally reviewed terms. Sample listings cannot be purchased.
            </p>
          </section>
          <section id="privacy">
            <h2>Privacy</h2>
            <p>
              Buyer contact details support account access, transaction
              notifications, payment reconciliation and collection. Staff access
              is restricted by role. Public bid histories use aliases. Borrower
              identities, loan information and private evidence do not appear in
              public listings. Payment card details are handled by the hosted
              payment provider.
            </p>
            <p>
              The institution must publish its controller identity, lawful
              purposes, retention periods, processor details and rights-request
              contact before collecting production data.
            </p>
          </section>
          <section id="complaints">
            <h2>Help & complaints</h2>
            <p>
              For an asset concern, include its listing reference. For payment
              or collection concerns, include your order number. Never send card
              details, passwords or one-time sign-in codes. The institution’s
              verified support email, phone and escalation process will be
              displayed here once configured.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
