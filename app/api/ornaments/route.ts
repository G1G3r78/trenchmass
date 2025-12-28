const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL!;

export async function GET() {
  const res = await fetch(SCRIPT_URL, { method: 'GET' });
  const text = await res.text();

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(req: Request) {
  const body = await req.text();

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const text = await res.text();

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
