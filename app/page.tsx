import { ArticlePrototype } from "@/components/ArticlePrototype";
import { isDemo, pilotEnabled } from "@/lib/article-assistant/server";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <ArticlePrototype
      enabled={pilotEnabled()}
      mode={isDemo() ? "demo" : "real"}
    />
  );
}
