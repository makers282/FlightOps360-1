
// src/app/api/test-api/route.ts
export async function GET() {
  return new Response("Hello from API", { status: 200 });
}
