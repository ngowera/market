import Marketplace from "@/components/marketplace";
import { getPublicListings } from "@/lib/server";
export default async function Browse() {
  const data = await getPublicListings();
  return <Marketplace initial={data.listings} demo={data.demo} browse />;
}
