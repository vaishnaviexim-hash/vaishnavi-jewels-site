// netlify/functions/draft-review.js
//
// Called by the "Leave a Review" page. Takes the customer's short answers
// and asks GPT to draft a review IN THEIR VOICE, as a starting point they
// edit and post themselves. This function never posts anything to Google —
// it only returns text back to the browser. Posting is always a manual,
// separate step the customer does themselves, on their own Google account.
//
// Requires an OPENAI_API_KEY environment variable set in Netlify
// (Project configuration → Environment variables). Never commit the key
// to the repo.

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const { name, purchase, highlight, tone } = body;

  // Basic guardrails: don't call the API on empty/garbage input.
  if (!highlight || String(highlight).trim().length < 3) {
    return new Response(
      JSON.stringify({ error: 'Please share at least a little about your experience.' }),
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Review drafting is not configured yet.' }),
      { status: 500 }
    );
  }

  const systemPrompt = `You draft short, genuine-sounding Google review starting
points for a jewellery showroom called Vaishnavi Jewels in Surat, India, based
on a real customer's own notes. Rules:
- Write in first person, as if the customer is writing it themselves.
- Base it ONLY on what the customer actually told you. Never invent specific
  claims (no made-up prices, delivery times, staff names, or guarantees).
- Keep it natural and specific, not generic corporate praise. 2-4 sentences.
- Do not use exclamation marks more than once.
- This is a DRAFT the customer will read and edit before posting — make it
  a strong, honest starting point, not a finished, unchangeable text.`;

  const userPrompt = `Customer name: ${name || 'not given'}
What they purchased: ${purchase || 'not specified'}
What stood out to them (their own words): ${highlight}
Preferred tone: ${tone || 'warm and simple'}

Draft a short review based only on the above.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', errText);
      return new Response(
        JSON.stringify({ error: 'Could not draft a review right now. Please try again.' }),
        { status: 502 }
      );
    }

    const data = await response.json();
    const draft = data.choices?.[0]?.message?.content?.trim();

    if (!draft) {
      return new Response(
        JSON.stringify({ error: 'Could not draft a review right now. Please try again.' }),
        { status: 502 }
      );
    }

    return new Response(JSON.stringify({ draft }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('draft-review function error:', err);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500 }
    );
  }
};
