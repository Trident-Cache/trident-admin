import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

// Next 15+: a dynamic route's params arrive as a Promise.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = await trident.deleteBan(id);
    return NextResponse.json({ success });
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
