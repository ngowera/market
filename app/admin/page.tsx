import Admin from "@/components/admin";
import { config } from "@/lib/server";
export const metadata = { title: "Recovery workspace | CMRP" };
export default function Page() {
  const c = config();
  return <Admin connected={!!(c.url && c.key)} />;
}
