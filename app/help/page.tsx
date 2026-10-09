import { Header, Footer } from "@/components/marketplace";
export default function Help() {
  return (
    <>
      <Header />
      <main className="help-layout">
        <nav className="help-nav">
          <a href="/help/bidding">Bidding & collection</a>
          <a href="/help/terms">Terms of sale</a>
          <a href="/help/privacy-and-complaints">Privacy & complaints</a>
          <a href="/help">General help</a>
        </nav>
        <article className="help-copy">
          <div className="eyebrow">BUY WITH CONFIDENCE</div>
          <h1>A clear process, every step.</h1>
          <section id="bidding">
            <h2>Bidding & buying</h2>
            <p>
              Buyers can browse available listings, review item details and
              decide whether to bid or buy now. Each listing includes a clear
              description, condition notes and collection information so you know
              what you are buying before you commit.
            </p>
            <p>
              Auctions are subject to the stated minimum bid and closing rules.
              Fixed-price listings may be purchased immediately if available,
              while some listings may accept a buyer offer. The final sale is
              confirmed only after the platform accepts the transaction.
            </p>
          </section>
          <section id="payment">
            <h2>Payment</h2>
            <p>
              Payment is made through the secure checkout process provided by the
              platform. Do not pay by personal transfer or outside the official
              system. Once payment is confirmed, the order status updates and the
              item is held for collection according to the sale rules.
            </p>
          </section>
          <section id="collection">
            <h2>Collection</h2>
            <p>
              Collection is available only after verified payment and staff
              release approval. All collection takes place at our office in
              Blantyre. Follow the collection deadline shown on your order and
              bring identification matching your account or arrange an authorized
              collector with staff. Collection codes are single-use. Arrange
              suitable transport for vehicles and larger appliances.
            </p>
          </section>
          <section id="terms">
            <h2>Terms of sale</h2>
            <p>
              All listings are sold according to the item description, condition
              notes, payment rules and collection instructions shown on the
              website. Buyers should review the details carefully before placing a
              bid or making a purchase.
            </p>
            <p>
              The institution may cancel or withhold a sale where the asset is not
              available, the required approvals are not complete, or the listing
              rules are not met. Final sale confirmation is given only after the
              platform approves the transaction.
            </p>
          </section>
          <section id="privacy">
            <h2>Privacy</h2>
            <p>
              We use buyer information to create and manage accounts, confirm
              identity, process payments, send important updates and support
              collection. Personal information is kept private and only shared
              where required to complete the sale or provide support.
            </p>
            <p>
              Public listings do not contain sensitive borrower or private
              evidence information. Payment details are handled by the approved
              secure payment provider.
            </p>
          </section>
          <section id="complaints">
            <h2>Help & complaints</h2>
            <p>
              If you have a concern about a listing, payment, order, or
              collection, contact the support team with the relevant listing or
              order number and a short description of the issue. Please do not
              send passwords, card details, or private security codes by email.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
