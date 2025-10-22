import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, parseStorageUrl, getSupabasePublicUrl } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ error: "STORAGE_URL not configured" }, { status: 500 });
    }

    const { bucket, path: prefix } = parseStorageUrl(storageUrl);
    const supabase = getSupabaseAdmin();

    // Parse request body
    const tour = await req.json();

    if (!tour.slug) {
      return NextResponse.json({ error: "Tour slug is required" }, { status: 400 });
    }

    // Validate tour has required fields
    if (!tour.title || !tour.regions || tour.regions.length === 0) {
      return NextResponse.json(
        { error: "Tour must have title and at least one region" },
        { status: 400 }
      );
    }

    // Save tour manifest to Supabase Storage
    // Note: prefix already contains "tours", so just add slug
    const manifestPath = `${prefix}/${tour.slug}/manifest.json`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(manifestPath, JSON.stringify(tour, null, 2), {
        contentType: "application/json",
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Update tours index
    // Note: prefix already contains "tours"
    const indexPath = `${prefix}/index.json`;
    let index = { tours: [] as any[] };

    try {
      // Try to get existing index
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(indexPath);

      if (!error && data) {
        const body = await data.text();
        index = JSON.parse(body);
      }
    } catch (error: any) {
      // Index doesn't exist yet, will create new one
      console.log("Index doesn't exist, creating new one");
    }

    // Update or add tour in index
    const existingIndex = index.tours.findIndex((t: any) => t.slug === tour.slug);
    const tourSummary = {
      slug: tour.slug,
      title: tour.title,
      description: tour.description || "",
      priceEUR: tour.priceEUR || 0,
      locales: tour.locales || [],
      published: true,
      updatedAt: new Date().toISOString(),
      manifestUrl: `${prefix}/${tour.slug}/manifest.json`,
    };

    if (existingIndex >= 0) {
      index.tours[existingIndex] = tourSummary;
    } else {
      index.tours.push(tourSummary);
    }

    // Save updated index
    const { error: indexError } = await supabase.storage
      .from(bucket)
      .upload(indexPath, JSON.stringify(index, null, 2), {
        contentType: "application/json",
        upsert: true
      });

    if (indexError) {
      throw indexError;
    }

    const manifestUrl = getSupabasePublicUrl(bucket, manifestPath);

    return NextResponse.json({
      success: true,
      tour: tourSummary,
      manifestUrl
    });

  } catch (error: any) {
    console.error("Error publishing tour:", error);
    return NextResponse.json(
      { error: "Failed to publish tour", details: error.message },
      { status: 500 }
    );
  }
}
