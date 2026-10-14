import { NextRequest } from "next/server";
import { handleAsk } from "@/lib/article-assistant/handler";
export async function POST(request: NextRequest) {
  return handleAsk(request);
}
