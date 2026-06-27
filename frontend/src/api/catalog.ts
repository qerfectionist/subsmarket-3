import { post, request } from "./client";
import type { FamilyService, FamilyType } from "../types";

export function getFamilyServices(familyType?: FamilyType): Promise<FamilyService[]> {
  const query = familyType ? `?family_type=${familyType}` : "";
  return request<FamilyService[]>(`/api/catalog/family-services${query}`);
}

export async function importFamilyServices(): Promise<void> {
  await post("/api/catalog/import-family-services");
}