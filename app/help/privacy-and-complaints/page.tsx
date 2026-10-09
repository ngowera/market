import Link from "next/link";
import { Header, Footer } from "@/components/marketplace";

export default function PrivacyComplaintsPage() {
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
          <div className="eyebrow">TRUST & TRANSPARENCY</div>
          <h1>Privacy & complaints</h1>
          <section>
            <h2>Privacy</h2>
            <p>
              We use personal information to manage accounts, verify payment,
              provide updates, and arrange collection. Information is used only
              for the purposes of the sale process and related support.
            </p>
            <p>
              Public listings do not contain sensitive borrower or private
              evidence information. Payment details are handled through the
              approved secure payment provider, and collection arrangements are
              managed through our Blantyre office process.
            </p>
          </section>
          <section>
            <h2>Complaints</h2>
            <p>
              If you have a concern about an item, payment, order, or collection,
              please contact the support team with the listing or order number
              and a clear description of the issue. Do not send passwords, card
              details, or security codes by email.
            </p>
          </section>
          <section>
            <h2>Safe use of information</h2>
            <p>
              Buyers should protect their account information and avoid sharing
              private login codes, payment details, or verification messages with
              anyone outside the official platform. Any legitimate support request
              will be handled using the approved support process.
            </p>
          </section>
          <section>
            <h2>Responsibility and trust</h2>
            <p>
              This platform is designed to support transparent and accountable
              asset sales. Personal data is kept limited to what is necessary for
              the sale process, and the institution should only use this data for
              permitted operational and legal purposes.
            </p>
            <p>
              If you believe there has been an issue with privacy or a sale
              concern, raise it through the official complaint process with the
              relevant listing or order reference so the matter can be reviewed.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
