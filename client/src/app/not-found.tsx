import { ButtonLink, Page } from '@/components/ui';

export default function NotFound() {
  return (
    <Page className="py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">The page you are looking for does not exist.</p>
      <ButtonLink href="/" className="mt-8">Back to home</ButtonLink>
    </Page>
  );
}
