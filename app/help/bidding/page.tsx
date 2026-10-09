import Link from "next/link";
import { Header, Footer } from "@/components/marketplace";

export default function BiddingPage() {
  return (
    <>
      <Header />
      <main className="help-layout">
        <nav className="help-nav">
          <Link href="/help/bidding">Bidding & collection</Link>
          <Link href="/help/terms">Terms of sale</Link>
          <Link href="/help/privacy-and-complaints">Privacy & complaints</Link>
          <Link href="/help">General help</Link>
        </nav>
        <article className="help-copy">
          <div className="eyebrow">BUY WITH CONFIDENCE</div>
          <h1>Bidding & collection</h1>
          <section>
            <h2>How bidding works</h2>
            <p>
              Buyers may browse available listings and review each item’s
              description, condition, and collection details before submitting a
              bid or accepting a purchase offer. All bids are subject to the
              stated minimum amount and platform rules.
            </p>
            <p>
              Auction listings follow the advertised closing time and the
              platform’s bid validation rules. The final sale is only confirmed
              once the system has accepted the transaction and the order has been
              created.
            </p>
          </section>
          <section>
            <h2>Collection process</h2>
            <p>
              Once payment is verified, collection can be arranged at our office
              in Blantyre. Buyers should bring the required identification and
              any supporting documents requested by the institution.
            </p>
            <p>
              Collection must be completed within the stated timeframe. Failure to
              collect on time may result in a cancellation or further action as
              permitted by the sale terms.
            </p>
          </section>
          <section>
            <h2>Before you confirm a bid</h2>
            <p>
              It is important to read the listing carefully before placing a bid.
              Look at the condition notes, defect information, collection point,
              and any additional restrictions or pickup requirements. This helps
              avoid misunderstandings after the sale is confirmed.
            </p>
            <p>
              Buyers should also check that they are able to complete payment and
              collection within the required timeline. Bidding is a commitment to
              review and complete the transaction if the bid is accepted.
            </p>
          </section>
          <section>
            <h2>What happens after winning</h2>
            <p>
              Once a listing is won or purchased, the system creates an order and
              confirms the next steps for payment and collection. The buyer will
              receive the relevant instructions through the official order
              process and should follow those instructions without delay.
            </p>
            <p>
              This process is designed to provide a clear trail of ownership,
              payment, and collection so the buyer has confidence in the sale and
              the institution has a verifiable record of each transaction.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
