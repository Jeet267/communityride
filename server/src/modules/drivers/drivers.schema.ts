import { z } from 'zod';
import { DOC_KEY } from '../uploads/uploads.routes';

export const onboardingSchema = z.object({
  licenceNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{8,20}$/, 'Enter your licence number as printed'),
  licenceExpiresAt: z.coerce.date().refine(d => d > new Date(), 'This licence has expired'),
  licenceDocKey: z.string().regex(DOC_KEY, 'Upload your licence photo first'),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
