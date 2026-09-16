export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not configured'
    });
  }

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://vexa-version1.vercel.app',
          'X-Title': 'VEXA'
        },
        body: JSON.stringify(req.body)
      }
    );

    res.statusCode = response.status;

    const contentType = response.headers.get('content-type');

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    if (!response.body) {
      const text = await response.text();
      return res.end(text);
    }

    const reader = response.body.getReader();

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      res.write(Buffer.from(value));
    }

    res.end();

  } catch (error) {
    console.error('[VEXA] OpenRouter proxy error:', error);

    return res.status(500).json({
      error: 'Failed to contact OpenRouter'
    });
  }
}