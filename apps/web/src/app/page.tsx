import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function getSetupStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/setup-status`, {
      cache: 'no-store',
    });
    if (!res.ok) return true; // Assume completed on error to avoid redirect loop
    const json = (await res.json()) as { data?: { setupCompleted?: boolean } };
    return json.data?.setupCompleted ?? true;
  } catch {
    return true;
  }
}

export default async function RootPage() {
  const setupCompleted = await getSetupStatus();
  redirect(setupCompleted ? '/login' : '/setup');
}
