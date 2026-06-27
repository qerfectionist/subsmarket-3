import { useMutation, useQuery } from "@tanstack/react-query";

import {
  getFamilies,
  getFamilyAuditLog,
  getFamilyByInviteCode,
  getFamilyInvite,
  getFamilyMemberPayments,
  getFamilyMembers,
  getFamilyView,
  getMyFamilies,
  getMyFamilyRequests,
  getOwnerFamilyRequests
} from "../../api";
import { queryKeys } from "./queryKeys";

export function useFamilies(familyType?: string) {
  return useQuery({
    queryKey: queryKeys.families(familyType),
    queryFn: () => getFamilies(familyType as undefined)
  });
}

export function useMyFamilies() {
  return useQuery({ queryKey: queryKeys.myFamilies, queryFn: getMyFamilies });
}

export function useMyFamilyRequests() {
  return useQuery({ queryKey: queryKeys.myRequests, queryFn: getMyFamilyRequests });
}

export function useFamilyView(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyView(familyId ?? ""),
    queryFn: () => getFamilyView(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyAuditLog(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyAuditLog(familyId ?? ""),
    queryFn: () => getFamilyAuditLog(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyInvite(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyInvite(familyId ?? ""),
    queryFn: () => getFamilyInvite(familyId!),
    enabled: familyId !== null
  });
}

export function useOwnerFamilyRequests(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.ownerRequests(familyId ?? ""),
    queryFn: () => getOwnerFamilyRequests(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyMembers(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyMembers(familyId ?? ""),
    queryFn: () => getFamilyMembers(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyMemberPayments(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyMemberPayments(familyId ?? ""),
    queryFn: () => getFamilyMemberPayments(familyId!),
    enabled: familyId !== null
  });
}

export function useResolveInviteCode() {
  return useMutation({ mutationFn: (code: string) => getFamilyByInviteCode(code) });
}