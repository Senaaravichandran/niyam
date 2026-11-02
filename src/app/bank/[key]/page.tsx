import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankSite } from "@/components/bank/BankSite";
import { BANKS, CUSTOM_DEFAULT, bankByKey, customBank } from "@/niyam/data/banks";

/** The four banks, plus "custom": a visitor's own bank, whose details arrive with the release. */
const KEYS = [...BANKS.map((b) => b.key), "custom"];

export function generateStaticParams() {
  return KEYS.map((key) => ({ key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const b = key === "custom" ? customBank(CUSTOM_DEFAULT) : BANKS.find((x) => x.key === key);
  return b ? { title: { absolute: `${key === "custom" ? "Your bank" : b.short} · Rule engine operations` }, description: `${b.short} (synthetic): live rules, NIYAM rollouts, Sentinel and Golden Thread.`, robots: { index: false } } : {};
}

export default async function BankPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEYS.includes(key)) notFound();
  const b = key === "custom" ? customBank(CUSTOM_DEFAULT) : bankByKey(key);
  return <BankSite bank={{ key: b.key, short: key === "custom" ? "Your bank" : b.short, kind: b.kind, profile: b.profile, rules: b.rules, policies: b.policies, brand: b.brand, host: b.host, circular: b.circular }} />;
}
