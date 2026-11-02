import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankSite } from "@/components/bank/BankSite";
import { BANKS, bankByKey } from "@/niyam/data/banks";

export function generateStaticParams() {
  return BANKS.map((b) => ({ key: b.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const b = BANKS.find((x) => x.key === key);
  return b ? { title: { absolute: `${b.short} · Rule engine operations` }, description: `${b.short} (synthetic): live rules, NIYAM rollouts, Sentinel and Golden Thread.`, robots: { index: false } } : {};
}

export default async function BankPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!BANKS.some((b) => b.key === key)) notFound();
  const b = bankByKey(key);
  return <BankSite bank={{ key: b.key, short: b.short, kind: b.kind, profile: b.profile, rules: b.rules, policies: b.policies, brand: b.brand, host: b.host, circular: b.circular }} />;
}
