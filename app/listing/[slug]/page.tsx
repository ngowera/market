import { notFound } from "next/navigation";
import ListingDetail from "@/components/listing-detail";
import { getPublicListings } from "@/lib/server";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getPublicListings();
  const i = d.listings.find((x) => x.slug === slug);
  return {
    title: i ? i.title + " | CMRP" : "Asset not found | CMRP",
    description: i?.description,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getPublicListings();
  const i = d.listings.find((x) => x.slug === slug);
  if (!i) notFound();
  return <ListingDetail item={i} demo={d.demo} />;
}
