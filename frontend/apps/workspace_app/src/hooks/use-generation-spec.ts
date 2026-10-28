import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants'
import { fetchGenerationSpec } from '@/services/workflow-generation-spec-api'

/** The published workflow generation spec. Re-read every minute so an Admin Center publish shows up without a reload. */
export function useGenerationSpec() {
  return useQuery({
    queryKey: QUERY_KEYS.generationSpec,
    queryFn: fetchGenerationSpec,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
