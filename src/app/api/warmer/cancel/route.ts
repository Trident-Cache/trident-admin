import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export async function POST() {
  try {
    return NextResponse.json(await trident.warmerCancel());
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
