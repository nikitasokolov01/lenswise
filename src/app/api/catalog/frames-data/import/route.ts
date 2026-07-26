import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { isAuthorizedFramesDataImport } from "@/lib/catalog/importAuth";
import { framesDataImportRequestSchema } from "@/lib/catalog/framesData";
import {
  failFramesDataImport,
  finishFramesDataImport,
  importFramesDataBatch,
  startFramesDataImport,
} from "@/lib/catalog/importService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedFramesDataImport(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const input = framesDataImportRequestSchema.parse(await request.json());
    switch (input.operation) {
      case "start":
        return NextResponse.json(
          await startFramesDataImport({
            mode: input.mode,
            sourceCursor: input.sourceCursor,
          }),
          { status: 201 }
        );
      case "batch":
        return NextResponse.json(await importFramesDataBatch(input.runId, input.items));
      case "finish":
        return NextResponse.json(await finishFramesDataImport(input.runId));
      case "fail":
        return NextResponse.json(await failFramesDataImport(input.runId, input.error));
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid Frames Data import payload.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Frames Data import failed.";
    const configurationError = message.includes("FRAMES_DATA_IMPORT_SECRET");
    return NextResponse.json(
      { error: configurationError ? "Frames Data import is not configured." : message },
      { status: configurationError ? 503 : 500 }
    );
  }
}
