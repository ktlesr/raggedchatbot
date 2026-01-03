import ChatInterface from "@/components/ChatInterface";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yatırım Teşvik Asistanı",
  description: "Yapay zeka ile mevzuat sorgulama ve analiz yapın.",
};

export default function ChatPage() {
  return <ChatInterface />;
}
