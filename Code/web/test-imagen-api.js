#!/usr/bin/env node

/**
 * Test script for Imagen image generation API
 * This script tests the /api/generate-story-images endpoint
 */

const http = require('http');

// Sample test data
const testRequest = {
  characterProfile: {
    characterDescription: "A curious 6-year-old with brown hair and bright eyes, wearing colorful clothing",
    styleNotes: "Illustrated storybook style, warm and friendly, child-like proportions",
    recurringVisualAnchors: ["bright smile", "curious eyes", "colorful outfit"]
  },
  story: {
    title: "Sam's Amazing Adventure",
    coverText: "A tale of courage and friendship",
    pages: [
      {
        pageNumber: 1,
        text: "Once upon a time, there was a brave little explorer named Sam."
      }
    ]
  },
  imagePrompts: [
    {
      pageNumber: 1,
      prompt: "A young child explorer standing at the edge of an enchanted forest, looking curious and excited, in a colorful illustrated storybook style"
    }
  ]
};

async function testImageGeneration() {
  console.log("🧪 Testing Imagen API image generation...\n");

  try {
    const response = await fetch('http://localhost:3000/api/generate-story-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest),
    });

    const data = await response.json();

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Headers:`, {
      'content-type': response.headers.get('content-type'),
    });

    if (response.ok) {
      console.log("\n✅ SUCCESS - Image generation API returned 200");
      console.log("\n📸 Generated Images:");
      data.images.forEach((img, idx) => {
        console.log(`  [Page ${img.pageNumber}]`);
        if (img.imageUrl) {
          console.log(`    ✓ Image URL generated (${img.imageUrl.substring(0, 80)}...)`);
        }
        if (img.error) {
          console.log(`    ✗ Error: ${img.error}`);
        }
      });
    } else {
      console.log("\n❌ ERROR - Request failed");
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("\n❌ ERROR - Network or parsing error:", error.message);
    process.exit(1);
  }
}

// Run test
testImageGeneration().then(() => {
  console.log("\n✨ Test complete!");
  process.exit(0);
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
