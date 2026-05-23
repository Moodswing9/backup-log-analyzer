export async function GET() {
  return Response.json({
    status: 'ok',
    version: '0.3.0',
    ts: new Date().toISOString(),
  });
}
