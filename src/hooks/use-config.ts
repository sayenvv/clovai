import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants'
import * as configApi from '@/services/config-api'
import type { AppConfig } from '@/types/config'

/** Active configuration — cached aggressively since it changes rarely. */
export function useActiveConfig() {
  return useQuery({
    queryKey: QUERY_KEYS.activeConfig,
    queryFn: configApi.getActiveConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export function useConfigList() {
  return useQuery({
    queryKey: QUERY_KEYS.configList,
    queryFn: configApi.listConfigs,
  })
}

export function useConfigById(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.config(id ?? ''),
    queryFn: () => configApi.getConfig(id as string),
    enabled: id !== null,
  })
}

function useInvalidateConfigs() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['config'] })
  }
}

export function useSaveConfig() {
  const invalidate = useInvalidateConfigs()
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: AppConfig }) =>
      configApi.saveConfig(name, config),
    onSuccess: invalidate,
  })
}

export function useUpdateConfig() {
  const invalidate = useInvalidateConfigs()
  return useMutation({
    mutationFn: ({ id, config, name }: { id: string; config: AppConfig; name?: string }) =>
      configApi.updateConfig(id, config, name),
    onSuccess: invalidate,
  })
}

export function useActivateConfig() {
  const invalidate = useInvalidateConfigs()
  return useMutation({
    mutationFn: (id: string) => configApi.activateConfig(id),
    onSuccess: invalidate,
  })
}

export function useDeleteConfig() {
  const invalidate = useInvalidateConfigs()
  return useMutation({
    mutationFn: (id: string) => configApi.deleteConfig(id),
    onSuccess: invalidate,
  })
}
