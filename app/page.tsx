import HomeClient from "@/components/HomeClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yatırım Teşvik Rehberi",
  description:
    "Yapay zeka asistanı ile yatırım teşviklerini keşfedin ve mevzuat analizi yapın.",
};

export default function Home() {
  return <HomeClient />;
}
