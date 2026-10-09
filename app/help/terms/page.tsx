import Link from "next/link";
import { Header, Footer } from "@/components/marketplace";

export default function TermsPage() {
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
          <div className="eyebrow">IMPORTANT INFORMATION</div>
          <h1>Terms of sale</h1>
          <section>
            <h2>Overview</h2>
            <p>
              All listed items are sold according to the information shown on the
              website, including the description, condition, specifications, and
              collection terms. Buyers should review all information before
              placing a bid or completing a purchase.
            </p>
          </section>
          <section>
            <h2>Sale confirmation</h2>
            <p>
              A sale is only confirmed when the platform has accepted the bid,
              offer, or purchase and an order has been created. The institution
              may cancel or withhold a sale if required approvals or conditions
              are not met.
            </p>
          </section>
          <section>
            <h2>Payments and collection</h2>
            <p>
              Payment must be completed through the official secure payment
              process. Collection only occurs after payment is verified and the
              order is released by the institution. All collection takes place at
              our office in Blantyre, and any collection deadline must be
              respected.
            </p>
          </section>
          <section>
            <h2>Item condition and disclosure</h2>
            <p>
              The seller provides the information available about the listing at
              the time of sale. Buyers are expected to review the item condition,
              defect notes, and collection details before committing to a bid or
              purchase. Specific details may vary depending on the asset type.
            </p>
          </section>
          <section>
            <h2>Rights and final confirmation</h2>
            <p>
              Final sale acceptance depends on the platform’s approval and the
              completion of any required checks. Where a listing is unavailable,
              under review, or fails to meet approval requirements, the seller may
              cancel or delay the sale as needed.
            </p>
            <p>
              This site is for public browsing and information purposes. The full
              legal arrangement for each transaction remains subject to the
              official sale document and the institution’s final approved terms.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
