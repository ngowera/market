export type Listing = {
  id: string;
  slug: string;
  title: string;
  category: string;
  method: string;
  price: number;
  location: string;
  condition: string;
  image: string;
  ends_at?: string;
  bids: number;
  increment: number;
  description: string;
  defects: string;
  specs: Record<string, string>;
  status: string;
};
export const categories = [
  "All assets",
  "Vehicles",
  "Electronics",
  "Gaming",
  "Home Appliances",
  "Furniture",
  "Equipment",
  "Other",
];
export const money = (n: number | string) =>
  "MWK " + Number(n).toLocaleString("en-MW", { maximumFractionDigits: 2 });
export const methodName = (m: string) =>
  m.includes("auction")
    ? "Auction"
    : m === "offer"
      ? "Make an offer"
      : "Buy now";
