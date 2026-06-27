import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getFamilyServices, importFamilyServices } from "../../api";
import { queryKeys } from "./queryKeys";

export function useFamilyServices(familyType?: string) {
  return useQuery({
    queryKey: queryKeys.services(familyType),
    queryFn: () => getFamilyServices(familyType as undefined)
  });
}

export function useImportFamilyServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importFamilyServices,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] })
  });
}