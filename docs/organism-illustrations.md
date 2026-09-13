# Organism field illustrations

The default-checked “Include a field illustration” option displays a scientific
2D concept in the Evolve Life panel alongside the optional
[procedural 3D specimen in the planet scene](organism-3d.md). The textual analysis
appears immediately; `POST /api/organism-image` runs independently of the four-stage
analysis and the 3D request, with its own loading state and retry. If disabled,
the completed result offers manual image generation. Image output is not used to
construct the 3D mesh.

The panel remains open when the 3D model arrives so the illustration and analysis
stay visible. “View organism” minimizes the notes for 3D inspection. Both visual
requests are held in the parent panel and survive minimization.

## Source and scientific limits

`buildOrganismImagePrompt(planet, environment, organism)` uses only a strict
snapshot of the selected Planet, PlanetEnvironment and ValidatedOrganism. It
has no access to the draft, critic ledger, pressure-array input, hidden reasoning,
web search or scene screenshots. A fixed illustration brief asks for faithful
body proportions, locomotion, surface protection, sensory systems and qualitative
environmental lighting. It preserves uncertainty, depicts microscopic organisms
as magnified specimens, and prohibits decorative anatomy and invented habitats.
The returned alternative text identifies a speculative concept, not evidence of
life or additional scientific validation. The illustration component also displays
that caption. Text remains the authoritative description.

After final approval, the Evolve endpoint signs that exact context with a
domain-separated HMAC. The token expires in 30 minutes and is portable across
serverless workers. The image endpoint accepts only this token, so browser edits
cannot substitute a rejected draft, different conditions, or arbitrary prompts.
The token contains public result data and a signature, never the API key. It is
not encrypted and should not contain private data. No database or job queue is
needed; HTTP responses use `Cache-Control: no-store`.

## OpenAI configuration

`OPENAI_API_KEY` remains server-only. `OPENAI_IMAGE_MODEL` defaults to
`gpt-image-2.5-flare`, the fast image model in the
[official model documentation](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
This uses the official SDK's `client.images.generate()` following the
[Image API guide](https://developers.openai.com/api/docs/guides/image-generation):
one 1024×1024 image, medium quality, JPEG output with compression 80. No text
or image-generation credentials reach client code. Model access depends on the
server's OpenAI project; unavailable models produce an image-only failure.

## Reliability and tests

The image call has a 120-second deadline, no automatic SDK retry, and request
cancellation. The HTTP route has 150 seconds of host time. The illustration hook
bounds its wait at 130 seconds. JPEG output is
size-limited and checked before returning; the component decodes it before
display. Empty, malformed, oversized or undecodable images produce an image-only
failure, preserving both the analysis and any 3D specimen. “Retry illustration”
uses the same valid token and retries only image generation. Expired tokens
preserve analysis and require a new Evolve run for a
new image authorization. An already-sent remote request may still finish after
request cancellation.

Server logs contain a diagnostic ID, elapsed time, stable error code and output
byte count. Prompts, tickets, model output, provider messages and API credentials
are excluded.

Run `npm run test:images` for the endpoint, prompt, token and client
contracts. Offline tests mock image responses; they do not prove visual fidelity.
For a live browser check, evolve life with the illustration option enabled.
Confirm text appears first and the image develops separately; an image failure
must preserve the analysis and 3D specimen with a separate retry. The disabled
option should offer manual image generation. See
[organisms in the 3D world](organism-3d.md) for `npm run test:scenes` coverage.
