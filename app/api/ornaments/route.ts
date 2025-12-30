const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL!;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  //console.log('Route.ts - userId from query params:', userId); // Добавь лог
  
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'getOrnaments',
      userId: userId // ← Этот userId может быть null!
    })
  });
  
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