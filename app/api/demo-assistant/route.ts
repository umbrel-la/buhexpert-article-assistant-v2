import { NextRequest } from "next/server";
import { handleAsk } from "@/lib/article-assistant/handler";
// Only public demo fixtures, even in a real pilot deployment.
export async function POST(request: NextRequest) {
  return handleAsk(request, true);
}
