import { redirect } from 'next/navigation';

// Sign-up and sign-in are one flow now (enter email/phone → code → new users pick name + role), like Ola / Uber.
export default function RegisterPage() {
  redirect('/login');
}
