import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';

export async function action(args: ActionFunctionArgs) {
  return deepResearchAction(args);
}

async function deepResearchAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
  }>();

  const { name: providerName } = provider;

  // validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  try {
    const result = await streamText({
      messages: [
        {
          role: 'user',
          content:
            `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` +
            stripIndents`
              You are a market research and business analysis expert tasked with analyzing an app idea. 
              Your goal is to provide a comprehensive analysis covering various aspects of the proposed app's 
              market potential and business viability. 

                    Here is the app idea you will be analyzing:

                    <app_idea>
                    ${message}
                    </app_idea>

                    Conduct a thorough analysis of this app idea, covering the following sections:

                    1. Market Overview:
                      - Assess the current state of the market related to this app idea
                      - Identify key trends and growth projections
                      - Provide relevant market size statistics if available

                    2. Target Audience Analysis:
                      - Define the primary and secondary target audiences for this app
                      - Describe their demographics, psychographics, and behavior patterns
                      - Explain why these audiences would be interested in the app

                    3. Competitor Analysis:
                      - Identify direct and indirect competitors in the market
                      - Analyze their strengths and weaknesses
                      - Highlight any gaps in the market that this app could fill

                    4. Potential Revenue Streams:
                      - Suggest multiple ways the app could generate revenue
                      - Evaluate the viability of each revenue stream
                      - Provide rough estimates of potential earnings if possible

                    5. Key Challenges and Risks:
                      - Identify potential obstacles in development, launch, or scaling
                      - Assess market-related risks and how they might impact success
                      - Consider regulatory or legal challenges that may arise

                    6. Development Recommendations:
                      - Suggest key features or functionalities to prioritize
                      - Recommend strategies for user acquisition and retention
                      - Propose a high-level roadmap for development and launch

                    Guidelines for your analysis:
                    - Provide detailed insights for each section
                    - Focus on actionable information and specific market opportunities
                    - Include relevant market trends and statistics where possible
                    - Base your analysis on current market data and industry best practices
                    - Be objective in your assessment, highlighting both positive aspects and potential drawbacks

                    Format your response in clear sections, using headings for each of the six analysis areas. 
                    Within each section, use subheadings or bullet points to organize information for easy readability.

                    Your final output should consist only of the analysis itself, without any preliminary notes or explanations. 
                    Begin your response with:

                    <analysis>

                    And end it with:

                    </analysis>

            Ensure that your analysis is comprehensive, well-structured, and provides valuable insights for 
            decision-making regarding this app idea.
            `,
        },
      ],
      env: context.cloudflare?.env as any,
      apiKeys,
      providerSettings,
    });

    return new Response(result.textStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof Error && error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
