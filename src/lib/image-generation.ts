export async function generateImage(prompt: string): Promise<ArrayBuffer | null> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error('REPLICATE_API_TOKEN is not set');
      return null;
    }

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
      console.error('Replicate create prediction failed:', await createResponse.text());
      return null;
    }

    let prediction = await createResponse.json() as { id: string; status: string; output?: string[]; error?: string };

    // Poll for completion
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!pollResponse.ok) {
        console.error('Replicate poll failed:', await pollResponse.text());
        return null;
      }

      prediction = await pollResponse.json() as typeof prediction;
    }

    if (prediction.status === 'failed' || !prediction.output || prediction.output.length === 0) {
      console.error('Replicate prediction failed:', prediction.error);
      return null;
    }

    // Fetch the generated image
    const imageResponse = await fetch(prediction.output[0]);
    if (!imageResponse.ok) return null;

    return await imageResponse.arrayBuffer();
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}
