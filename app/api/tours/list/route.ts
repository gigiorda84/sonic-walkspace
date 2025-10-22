import { NextResponse } from "next/server";
import { getSupabaseAdmin, parseStorageUrl } from "@/lib/supabase";

export async function GET() {
  try {
    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: "STORAGE_URL not configured" }, { status: 500 });
    }

    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    const supabase = getSupabaseAdmin();

    // Try to fetch the tours index
    // Note: prefix already contains "tours", so just add index.json
    const indexPath = `${prefix}/index.json`;

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(indexPath);

      if (error) {
        // Index doesn't exist yet, return empty array
        if (error.message.includes("not found") || error.message.includes("404")) {
          return NextResponse.json({ tours: [] });
        }
        throw error;
      }

      const body = await data.text();
      const index = JSON.parse(body);
      return NextResponse.json({ tours: index.tours || [] });

    } catch (error: any) {
      // If index doesn't exist, return empty array
      if (error.message?.includes("not found")) {
        return NextResponse.json({ tours: [] });
      }
      throw error;
    }

  } catch (error: any) {
    console.error("Error listing tours:", error);
    return NextResponse.json(
      { error: "Failed to list tours", details: error.message },
      { status: 500 }
    );
  }
}
