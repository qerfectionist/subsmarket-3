import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, refreshTelegramProfile } from "../../api";
import { queryKeys } from "./queryKeys";

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe });
}

export function useRefreshTelegramProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshTelegramProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me })
  });
}