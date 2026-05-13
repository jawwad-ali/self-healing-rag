"use server";

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function submitFeedback(
    queryId: number,
    feedback: -1 | 0 | 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!Number.isInteger(queryId) || queryId <= 0) {
        return { ok: false, error: "invalid query id" };
    }
    if (![-1, 0, 1].includes(feedback)) {
        return { ok: false, error: "feedback must be -1, 0, or 1" };
    }

    await sql`
        UPDATE obs.queries
        SET user_feedback = ${feedback}
        WHERE id = ${queryId}
    `;

    revalidatePath("/");
    revalidatePath(`/queries/${queryId}`);
    return { ok: true };
}
