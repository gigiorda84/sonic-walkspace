import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, parseStorageUrl } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: "STORAGE_URL not configured" }, { status: 500 });
    }

    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    const supabase = getSupabaseAdmin();

    const { slug } = params;
    // Note: prefix already contains "tours", so just add slug
    const manifestPath = `${prefix}/${slug}/manifest.json`;

    try {
      // Download the manifest file from Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(manifestPath);

      if (error) {
        if (error.message.includes("not found") || error.message.includes("404")) {
          return NextResponse.json({ error: "Tour not found" }, { status: 404 });
        }
        throw error;
      }

      // Convert blob to text
      const body = await data.text();
      const tour = JSON.parse(body);
      return NextResponse.json({ tour });

    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return NextResponse.json({ error: "Tour not found" }, { status: 404 });
      }
      throw error;
    }

  } catch (error: any) {
    console.error("Error fetching tour:", error);
    return NextResponse.json(
      { error: "Failed to fetch tour", details: error.message },
      { status: 500 }
    );
  }
}
