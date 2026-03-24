import Replicate from 'replicate';

let client: Replicate | null = null;

function getReplicateClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
  }
  return client;
}

export async function generateImage(prompt: string): Promise<ArrayBuffer | null> {
  try {
    const replicate = getReplicateClient();

    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 90,
      },
    });

    // output is an array of FileOutput (ReadableStream-like objects with url)
    const results = output as Array<{ url: () => string }>;
    if (!results || results.length === 0) return null;

    // Fetch the image from the temporary URL
    const imageUrl = typeof results[0] === 'string' ? results[0] : results[0].url();
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}
