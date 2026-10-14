import { ArticlePrototype } from "@/components/ArticlePrototype";
import { pilotEnabled } from "@/lib/article-assistant/server";
export const dynamic = "force-dynamic";

export default function Home() {
  return <ArticlePrototype enabled={pilotEnabled()} />;
}
