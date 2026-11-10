import { roadsApi } from "@/server/api/roads/roads.api";

export function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("name") || url.searchParams.get("unnamed") === "1") {
    return roadsApi.segments(request);
  }
  return roadsApi.groups(request);
}
