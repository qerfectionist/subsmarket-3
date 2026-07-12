import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import {
  getFamiliesPage,
  getFamilyAuditLog,
  getFamilyByInviteCode,
  getFamilyInvite,
  getFamilyMemberPayments,
  getFamilyMembersPage,
  getFamilyView,
  getMyFamiliesPage,
  getMyFamilyRequestsPage,
  getOwnerFamilyRequestsPage
} from "../../api";
import type { FamilyType } from "../../types";
import { queryKeys } from "./queryKeys";

export function useFamilies(familyType?: FamilyType) {
  return useInfiniteQuery({
    queryKey: queryKeys.families(familyType),
    queryFn: ({ pageParam }) =>
      getFamiliesPage({ familyType, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    refetchOnMount: "always",
    refetchInterval: 10_000,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useMyFamilies() {
  return useInfiniteQuery({
    queryKey: queryKeys.myFamilies,
    queryFn: ({ pageParam }) => getMyFamiliesPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useMyFamilyRequests() {
  return useInfiniteQuery({
    queryKey: queryKeys.myRequests,
    queryFn: ({ pageParam }) => getMyFamilyRequestsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
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
  return useInfiniteQuery({
    queryKey: queryKeys.ownerRequests(familyId ?? ""),
    queryFn: ({ pageParam }) => getOwnerFamilyRequestsPage(familyId!, pageParam),
    enabled: familyId !== null,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useFamilyMembers(familyId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.familyMembers(familyId ?? ""),
    queryFn: ({ pageParam }) => getFamilyMembersPage(familyId!, pageParam),
    enabled: familyId !== null,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
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
