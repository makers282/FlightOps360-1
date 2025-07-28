
import { NextRequest, NextResponse } from 'next/server';
import { copyMaintenanceTasks } from '@/ai/flows/copy-maintenance-tasks-flow';
import type { CopyTasksInput } from '@/ai/flows/copy-maintenance-tasks-flow';

export async function POST(req: NextRequest) {
  try {
    const input: CopyTasksInput = await req.json();
    
    // Validate input here if necessary (e.g., using Zod)
    if (!input.sourceAircraftId || !input.taskIds || !input.targetAircraftIds) {
        return NextResponse.json({ success: false, status: 'Invalid input provided.' }, { status: 400 });
    }
    
    console.log('[API Route] Received copy-maintenance-tasks request:', input);
    const result = await copyMaintenanceTasks(input);
    console.log('[API Route] copyMaintenanceTasks responded with:', result);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      // If the flow itself returns a non-successful status but doesn't throw an error
      return NextResponse.json(result, { status: 400 });
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown server error occurred.";
    console.error('[API Route] CRITICAL ERROR in copy-maintenance-tasks:', errorMessage);
    return NextResponse.json({ success: false, status: `Server Error: ${errorMessage}` }, { status: 500 });
  }
}
