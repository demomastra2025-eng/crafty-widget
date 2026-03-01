import { Metadata } from "next";

import { generateMeta } from "@/lib/generate-meta";

import KassaPageClient from "./kassa-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Касса",
    description: "Доходы и расходы по приемам: оплаты, предоплаты и выплаты врачам.",
    canonical: "/kassa",
  });
}

export default function Page() {
  return <KassaPageClient />;
}
