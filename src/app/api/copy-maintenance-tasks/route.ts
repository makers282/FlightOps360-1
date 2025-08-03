
import { NextRequest, NextResponse } from 'next/server';
import type { CopyTasksInput } from '@/ai/flows/copy-maintenance-tasks-flow';

export async function POST(req: NextRequest) {
  try {
    const input: CopyTasksInput = await req.json();

    if (!input.sourceAircraftId || !input.taskIds || !input.targetAircraftIds) {
        return NextResponse.json({ success: false, status: 'Invalid input provided.' }, { status: 400 });
    }

    let copyMaintenanceTasks;
    try {
      copyMaintenanceTasks = (await import('@/ai/flows/copy-maintenance-tasks-flow')).copyMaintenanceTasks;
      console.log('[API Route] Successfully imported copyMaintenanceTasks');
    } catch (importErr) {
      console.error('[API Route] Failed to import copyMaintenanceTasks:', importErr);
      const errorMessage = importErr instanceof Error ? importErr.message : String(importErr);
      return NextResponse.json({ success: false, status: 'Import failure', error: errorMessage }, { status: 500 });
    }

    const result = await copyMaintenanceTasks(input);
    console.log('[API Route] copyMaintenanceTasks responded with:', result);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API Route] Unhandled Server Error in copy-maintenance-tasks:', errorMessage);
    return NextResponse.json({ success: false, status: `Unhandled Server Error: ${errorMessage}` }, { status: 500 });
  }
}
