import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPut, rtdbDelete } from '@/lib/firebase-rtdb';

/**
 * POST /api/dispatch — Send a command from the web dashboard to a driver's mobile app via Firebase RTDB.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fleetId, action, message, newFleetId } = body;

    if (!fleetId || !action) {
      return NextResponse.json(
        { error: 'fleetId and action are required' },
        { status: 400 }
      );
    }

    const VALID_ACTIONS = ['STOP_VEHICLE', 'CHANGE_VEHICLE', 'MESSAGE'];
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const cmd = {
      fleetId:    Number(fleetId),
      action,
      message:    message || '',
      newFleetId: newFleetId ? Number(newFleetId) : null,
      issuedAt:   Date.now(),
      issuedBy:   'web-dashboard',
    };

    await rtdbPut(`dispatch/${fleetId}`, cmd);
    return NextResponse.json({ ok: true, cmd });
  } catch (err) {
    console.error('[POST /api/dispatch]', err);
    return NextResponse.json({ error: 'Failed to dispatch command in Firebase' }, { status: 500 });
  }
}

/**
 * DELETE /api/dispatch?fleetId=X — Clear dispatch command in Firebase.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fleetId = searchParams.get('fleetId');

    if (!fleetId) {
      return NextResponse.json({ error: 'fleetId query param required' }, { status: 400 });
    }

    await rtdbDelete(`dispatch/${fleetId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/dispatch]', err);
    return NextResponse.json({ error: 'Failed to clear dispatch in Firebase' }, { status: 500 });
  }
}

/**
 * GET /api/dispatch?fleetId=X — Get current pending dispatch command from Firebase.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fleetId = searchParams.get('fleetId');

    if (fleetId) {
      const cmd = await rtdbGet(`dispatch/${fleetId}`);
      return NextResponse.json(cmd);
    }

    const all = await rtdbGet('dispatch') || {};
    return NextResponse.json(all);
  } catch (err) {
    console.error('[GET /api/dispatch]', err);
    return NextResponse.json({});
  }
}
