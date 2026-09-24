import { version } from '../../../../package.json';

export async function GET() {
  return Response.json({
    status: 'ok',
    version,
    ts: new Date().toISOString(),
  });
}
