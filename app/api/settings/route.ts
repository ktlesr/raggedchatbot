
import { NextResponse } from "next/server";
import { getActiveAesthetic } from "@/lib/utils/settings";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const aesthetic = await getActiveAesthetic();
        return NextResponse.json({ aesthetic });
    } catch {
        return NextResponse.json({ aesthetic: "default" });
    }
}
