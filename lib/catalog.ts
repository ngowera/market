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
export const samples: Listing[] = [
  {
    id: "demo-hilux",
    slug: "toyota-hilux-double-cab",
    title: "Toyota Hilux Double Cab",
    category: "Vehicles",
    method: "auction",
    price: 18500000,
    location: "Lilongwe",
    condition: "Good",
    image: "/assets/hilux.webp",
    ends_at: "2026-10-09T14:00:00Z",
    bids: 18,
    increment: 100000,
    description:
      "A capable double-cab pickup for work and everyday journeys. Viewing is recommended before bidding.",
    defects:
      "Used vehicle. Minor body scratches and wear on driver seat. Service history requires inspection.",
    specs: {
      Make: "Toyota",
      Model: "Hilux",
      Transmission: "Manual",
      Fuel: "Diesel",
      Collection: "Lilongwe collection centre",
    },
    status: "live",
  },
  {
    id: "demo-ps5",
    slug: "sony-playstation-5",
    title: "Sony PlayStation 5 · 825GB",
    category: "Gaming",
    method: "auction",
    price: 420000,
    location: "Blantyre",
    condition: "Good",
    image: "/assets/ps5.webp",
    ends_at: "2026-10-08T12:00:00Z",
    bids: 12,
    increment: 10000,
    description:
      "Disc edition console with one DualSense controller. Tested for basic functionality.",
    defects:
      "Light cosmetic marks. Original packaging not included. Inspect controller battery condition.",
    specs: {
      Brand: "Sony",
      Storage: "825 GB",
      Included: "Console + one controller",
      Collection: "Blantyre collection centre",
    },
    status: "live",
  },
  {
    id: "demo-phone",
    slug: "apple-iphone-13",
    title: "Apple iPhone 13 · 128GB",
    category: "Electronics",
    method: "fixed_plus_offer",
    price: 485000,
    location: "Lilongwe",
    condition: "Good",
    image: "/assets/phone.webp",
    bids: 0,
    increment: 0,
    description:
      "Midnight finish, unlocked handset. Basic camera, calling and display functions tested.",
    defects:
      "Small scratches on frame. Battery health to be confirmed on inspection. Charger not included.",
    specs: {
      Brand: "Apple",
      Storage: "128 GB",
      Colour: "Midnight",
      Collection: "Lilongwe collection centre",
    },
    status: "live",
  },
  {
    id: "demo-fridge",
    slug: "samsung-double-door-fridge",
    title: "Samsung Double-door Fridge",
    category: "Home Appliances",
    method: "fixed_plus_offer",
    price: 650000,
    location: "Mzuzu",
    condition: "Fair",
    image: "/assets/fridge.webp",
    bids: 0,
    increment: 0,
    description:
      "Silver freestanding refrigerator with separate freezer compartment. Bring suitable transport for collection.",
    defects:
      "Small dents on door. Internal shelf wear. Cooling tested; inspect before commitment.",
    specs: {
      Brand: "Samsung",
      Type: "Double door",
      Finish: "Silver",
      Collection: "Mzuzu collection centre",
    },
    status: "live",
  },
];
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
