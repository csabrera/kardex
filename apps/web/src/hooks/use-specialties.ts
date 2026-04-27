import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface Specialty {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
}

const BASE = '/specialties';

export function useSpecialties(
  params: { search?: string; includeInactive?: boolean } = {},
) {
  return useQuery<Specialty[]>({
    queryKey: ['specialties', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}
