#!/usr/bin/env node

/**
 * Test script for Gemini image generation via the local API route.
 * This script exercises the /api/generate-story-images endpoint.
 */

const testRequest = {
  characterProfile: {
    characterDescription:
      "A curious 6-year-old with brown hair and bright eyes, wearing colorful clothing",
    styleNotes: "Illustrated storybook style, warm and friendly, child-like proportions",
    recurringVisualAnchors: ["bright smile", "curious eyes", "colorful outfit"],
  },
  story: {
    title: "Sam's Amazing Adventure",
    coverText: "A tale of courage and friendship",
    pages: [
      {
        pageNumber: 1,
        text: "Once upon a time, there was a brave little explorer named Sam.",
      },
    ],
  },
  imagePrompts: [
    {
      pageNumber: 1,
      prompt:
        "A young child explorer standing at the edge of an enchanted forest, looking curious and excited, in a colorful illustrated storybook style",
    },
  ],
};

async function testImageGeneration() {
  console.log("Testing Gemini image generation via /api/generate-story-images\n");

  const response = await fetch("http://localhost:3000/api/generate-story-images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(testRequest),
  });

  const data = await response.json();

  console.log(`Response Status: ${response.status}`);
  console.log("Response Headers:", {
    "content-type": response.headers.get("content-type"),
  });

  if (!response.ok) {
    console.log("\nRequest failed");
    console.log(JSON.stringify(data, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("\nGenerated Images:");
  for (const image of data.images ?? []) {
    console.log(`  [Page ${image.pageNumber}]`);
    if (image.imageUrl) {
      console.log(`    imageUrl: ${image.imageUrl.substring(0, 80)}...`);
    }
    if (image.error) {
      console.log(`    error: ${image.error}`);
    }
    if (image.isPlaceholder) {
      console.log("    placeholder: true");
    }
  }
}

testImageGeneration().catch((error) => {
  console.error("Test failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});