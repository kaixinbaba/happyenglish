export async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error('[generateImage] REPLICATE_API_TOKEN is not set');
    throw new Error('REPLICATE_API_TOKEN is not set');
  }

  console.log('[generateImage] Starting, prompt:', prompt.substring(0, 80));

  // Create prediction via Replicate HTTP API (avoids SDK fs dependency)
  const createResponse = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 90,
      },
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    console.error('[generateImage] Create prediction failed:', createResponse.status, text);
    throw new Error(`Replicate create failed: ${createResponse.status} ${text}`);
  }

  let prediction = await createResponse.json() as { id: string; status: string; output?: string[]; error?: string };
  console.log('[generateImage] Prediction created:', prediction.id, 'status:', prediction.status);

  // Poll for completion (max 60s)
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!pollResponse.ok) {
      const text = await pollResponse.text();
      console.error('[generateImage] Poll failed:', pollResponse.status, text);
      throw new Error(`Replicate poll failed: ${pollResponse.status} ${text}`);
    }

    prediction = await pollResponse.json() as typeof prediction;

    if (prediction.status === 'succeeded') {
      console.log('[generateImage] Succeeded, output:', prediction.output?.length, 'images');
      break;
    }
    if (prediction.status === 'failed') {
      console.error('[generateImage] Prediction failed:', prediction.error);
      throw new Error(`Replicate prediction failed: ${prediction.error || 'unknown'}`);
    }
  }

  if (!prediction.output || prediction.output.length === 0) {
    throw new Error('No output from Replicate prediction');
  }

  console.log('[generateImage] Fetching image from:', prediction.output[0]);

  // Fetch the generated image
  const imageResponse = await fetch(prediction.output[0]);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  console.log('[generateImage] Image fetched, size:', imageResponse.headers.get('content-length'));

  return await imageResponse.arrayBuffer();
}
