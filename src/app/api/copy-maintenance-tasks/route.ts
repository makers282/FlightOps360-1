import { NextRequest, NextResponse } from 'next/server';
import type { CopyTasksInput } from '@/ai/flows/copy-maintenance-tasks-flow';

export async function POST(req: NextRequest) {
  console.log('[API Route] route.ts loaded');

  try {
    const input: CopyTasksInput = await req.json();
    console.log('[API Route] Parsed input:', input);

    if (!input.sourceAircraftId || !input.taskIds || !input.targetAircraftIds) {
      console.log('[API Route] Invalid input:', input);
      return NextResponse.json({ success: false, status: 'Invalid input provided.' }, { status: 400 });
    }

    let copyMaintenanceTasks;
    try {
      console.log('[API Route] Importing copyMaintenanceTasks...');
      copyMaintenanceTasks = (await import('@/ai/flows/copy-maintenance-tasks-flow')).copyMaintenanceTasks;
      console.log('[API Route] Successfully imported copyMaintenanceTasks');
    } catch (importErr) {
      console.error('[API Route] Failed to import copyMaintenanceTasks:', importErr);
      return NextResponse.json({ success: false, status: 'Import failure', error: String(importErr) }, { status: 500 });
    }

    try {
      console.log('[API Route] Invoking copyMaintenanceTasks...');
      const result = await copyMaintenanceTasks(input);
      console.log('[API Route] copyMaintenanceTasks result:', result);

      if (result.success) {
        return NextResponse.json(result, { status: 200 });
      } else {
        return NextResponse.json(result, { status: 400 });
      }
    } catch (fnErr) {
      console.error('[API Route] copyMaintenanceTasks threw:', fnErr);
      return NextResponse.json({ success: false, status: 'copyMaintenanceTasks failed', error: String(fnErr) }, { status: 500 });
    }

  } catch (outerErr) {
    console.error('[API Route] Outer catch hit:', outerErr);
    return NextResponse.json({ success: false, status: 'Unhandled Server Error', error: String(outerErr) }, { status: 500 });
  }
}
