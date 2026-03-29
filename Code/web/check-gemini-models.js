#!/usr/bin/env node

/**
 * Test script for Google Gemini API models and capabilities
 * This script checks what image generation models are available
 */

async function checkGeminiModels() {
  console.log("🔍 Checking Google Generative Language API Models...\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY environment variable not set");
    process.exit(1);
  }

  try {
    // List all available models
    console.log("📋 Fetching available models from Google API...\n");
    const listResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error(`❌ ERROR listing models (${listResponse.status}):`, errorText);
      return;
    }

    const listData = await listResponse.json();
    const models = listData.models || [];

    console.log(`✅ Found ${models.length} models:\n`);

    // Categorize models
    const imageModels = [];
    const textModels = [];
    const otherModels = [];

    models.forEach((model) => {
      const name = model.name || "";
      const methods = model.supportedGenerationMethods || [];

      if (name.includes("imagen")) {
        imageModels.push({ name, methods });
      } else if (name.includes("gemini")) {
        textModels.push({ name, methods });
      } else {
        otherModels.push({ name, methods });
      }
    });

    // Display Text/Chat Models
    if (textModels.length > 0) {
      console.log("📝 TEXT/CHAT MODELS:");
      textModels.forEach((model) => {
        console.log(`  • ${model.name}`);
        console.log(`    Methods: ${model.methods.join(", ")}`);
      });
      console.log("");
    }

    // Display Image Models
    if (imageModels.length > 0) {
      console.log("🖼️  IMAGE GENERATION MODELS:");
      imageModels.forEach((model) => {
        console.log(`  • ${model.name}`);
        console.log(`    Methods: ${model.methods.join(", ")}`);
      });
      console.log("");
    } else {
      console.log("⚠️  NO IMAGE GENERATION MODELS FOUND\n");
    }

    // Display Other Models
    if (otherModels.length > 0) {
      console.log("📦 OTHER MODELS:");
      otherModels.forEach((model) => {
        console.log(`  • ${model.name}`);
        console.log(`    Methods: ${model.methods.join(", ")}`);
      });
      console.log("");
    }

    // Test text generation (should work)
    console.log("\n🧪 Testing Text Generation...\n");
    const textResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Say 'Hello from Gemini!' in one sentence." }],
            },
          ],
        }),
      }
    );

    if (textResponse.ok) {
      const textData = await textResponse.json();
      const textResult = textData.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log("✅ Text Generation: WORKING");
      console.log(`   Response: "${textResult}"\n`);
    } else {
      const errorText = await textResponse.text();
      console.log("❌ Text Generation: FAILED");
      console.log(`   Error: ${errorText}\n`);
    }

    // Test image generation with available models
    if (imageModels.length > 0) {
      console.log("🧪 Testing Image Generation...\n");

      for (const imageModel of imageModels) {
        const modelName = imageModel.name.split("/")[1]; // Extract just the model ID
        console.log(`  Testing ${modelName}...`);

        try {
          const imageResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: "A colorful illustration of a child explorer with a map" }],
                  },
                ],
              }),
            }
          );

          if (imageResponse.ok) {
            console.log(`    ✅ Response 200 OK`);
            const imageData = await imageResponse.json();
            console.log(`    Response: ${JSON.stringify(imageData).substring(0, 100)}...`);
          } else {
            console.log(
              `    ❌ Response ${imageResponse.status}: ${await imageResponse.text()}`
            );
          }
        } catch (err) {
          console.log(`    ❌ Error: ${err.message}`);
        }

        console.log("");
      }
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

// Run check
checkGeminiModels()
  .then(() => {
    console.log("✨ Model check complete!");
  })
  .catch((err) => {
    console.error("Check failed:", err);
    process.exit(1);
  });
