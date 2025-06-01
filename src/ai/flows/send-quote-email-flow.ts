
'use server';
/**
 * @fileOverview A Genkit flow to compose and "send" (log) a quote email to a client.
 *
 * - sendQuoteEmail - A function that handles the email composition and logging.
 * - SendQuoteEmailInput - The input type for the sendQuoteEmail function.
 * - SendQuoteEmailOutput - The return type for the sendQuoteEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit'; // Use z from genkit as it's common in flows

const SendQuoteEmailInputSchema = z.object({
  clientName: z.string().describe('The name of the client receiving the quote.'),
  clientEmail: z.string().email().describe('The email address of the client.'),
  quoteId: z.string().describe('The unique identifier of the quote.'),
  totalAmount: z.number().describe('The total amount of the quote.'),
  quoteLink: z.string().url().optional().describe('A link to view the full quote details online (optional).'),
});
export type SendQuoteEmailInput = z.infer<typeof SendQuoteEmailInputSchema>;

const SendQuoteEmailOutputSchema = z.object({
  recipientEmail: z.string().email(),
  emailSubject: z.string(),
  emailBody: z.string(),
  status: z.string().describe('Status of the email operation (e.g., "Email content generated and logged").'),
});
export type SendQuoteEmailOutput = z.infer<typeof SendQuoteEmailOutputSchema>;

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<SendQuoteEmailOutput> {
  return sendQuoteEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'composeQuoteEmailPrompt',
  input: { schema: SendQuoteEmailInputSchema },
  output: { schema: z.object({ emailSubject: z.string(), emailBody: z.string() }) }, // AI only generates subject and body
  prompt: `
You are an AI assistant for "FlightOps360", a premier charter flight operator.
Your task is to draft a professional and friendly email to a client regarding their flight quote.

Client Name: {{{clientName}}}
Quote ID: {{{quoteId}}}
Total Quote Amount: {{{totalAmount}}} USD
{{#if quoteLink}}
Link to view full quote: {{{quoteLink}}}
{{/if}}

The email should:
1. Greet the client by name.
2. Clearly state the Quote ID and the total amount.
3. If a quoteLink is provided, mention that they can view the full details via the link.
4. Express enthusiasm for their business.
5. Provide a clear call to action (e.g., contact us to confirm, discuss further, or if they have questions).
6. Sign off professionally from the FlightOps360 Team.

Generate an appropriate subject line and the email body.
Return the output strictly in the specified JSON format.
Example Subject: Your FlightOps360 Quote {{{quoteId}}} is Ready
Example Body (stylized, actual content will vary based on AI):
Dear {{{clientName}}},

Thank you for your interest in flying with FlightOps360!

We're pleased to provide you with Quote #{{{quoteId}}}. The total for your requested itinerary is {{{totalAmount}}} USD.
{{#if quoteLink}}You can view the detailed breakdown of your quote here: {{{quoteLink}}}{{/if}}

We are excited about the possibility of serving you and are confident we can provide an exceptional travel experience.
Please let us know if you have any questions or if you'd like to move forward with booking this trip.

Best regards,
The FlightOps360 Team
  `,
});

const sendQuoteEmailFlow = ai.defineFlow(
  {
    name: 'sendQuoteEmailFlow',
    inputSchema: SendQuoteEmailInputSchema,
    outputSchema: SendQuoteEmailOutputSchema,
  },
  async (input) => {
    const { clientName, clientEmail, quoteId, totalAmount, quoteLink } = input;

    const { output: emailContent } = await prompt({
      clientName,
      clientEmail, // Not strictly needed by prompt but good for context
      quoteId,
      totalAmount,
      quoteLink,
    });

    if (!emailContent || !emailContent.emailSubject || !emailContent.emailBody) {
      throw new Error('AI failed to generate email content.');
    }

    const { emailSubject, emailBody } = emailContent;

    // Simulate sending email by logging to console
    console.log("--- SIMULATING EMAIL SEND ---");
    console.log(`To: ${clientEmail}`);
    console.log(`Subject: ${emailSubject}`);
    console.log(`Body:\n${emailBody}`);
    console.log("--- END OF EMAIL SIMULATION ---");

    // You could add actual email sending logic here using a service like Nodemailer, SendGrid, etc.
    // For example: await sendEmailWithThirdPartyService(clientEmail, emailSubject, emailBody);

    return {
      recipientEmail: clientEmail,
      emailSubject,
      emailBody,
      status: 'Email content generated and logged to console (simulation).',
    };
  }
);
