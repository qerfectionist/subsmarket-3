import { useMemo } from "react";
import type { ActionsArchiveItem } from "../families";
import type {
  MarketplaceListingRequest,
  AccountRequest,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  Family,
  OwnerFamilyRequest
} from "../../types";
import { formatTradeGb } from "../TradeRequestCard";
import { formatDate, formatDateTime, familyTitle } from "../../format";
import { getOrderNumber, formatArchiveAccountTitle } from "./actionsFilterTypes";
import { isRequestExpired } from "./useRequestTimeRemaining";
import type { ActionsTab } from "./ActionsScopePager";

export interface UseActionsArchiveItemsOptions {
  actionsTab: ActionsTab;
  sellerGbRequests: MarketplaceListingRequest[];
  sellerAccountRequests: AccountRequest[];
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  buyerGbRequests: MarketplaceListingRequest[];
  buyerAccountRequests: AccountRequest[];
  requests: FamilyRequest[];
  candidateRequests?: Array<{ family: Family; request: OwnerFamilyRequest }>;
  timeTick?: number;
}

export function useActionsArchiveItems({
  actionsTab,
  sellerGbRequests,
  sellerAccountRequests,
  families,
  ownerDetails,
  buyerGbRequests,
  buyerAccountRequests,
  requests,
  candidateRequests,
  timeTick
}: UseActionsArchiveItemsOptions) {
  const inboxArchiveItems = useMemo<ActionsArchiveItem[]>(() => {
    const items: ActionsArchiveItem[] = [];
    for (const req of sellerGbRequests) {
      const expired = isRequestExpired(req.status, req.created_at);
      if (["closed", "cancelled", "rejected", "expired"].includes(req.status) || expired) {
        const isSuccess = req.status === "closed";
        items.push({
          id: `gb-${req.id}`,
          title: `${formatTradeGb(req.amount_gb)} ГБ · ${req.operator_name}`,
          orderNumber: getOrderNumber(req.id),
          category: "gigabytes",
          categoryLabel: "Трафик",
          serviceName: req.operator_name,
          serviceSlug: req.operator_slug ? `${req.operator_slug}-family-tariff` : undefined,
          counterparty: `Покупатель: @${req.counterparty_username ?? "покупатель"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess
            ? "Завершена"
            : req.status === "rejected"
              ? "Отклонена"
              : req.status === "cancelled"
                ? "Отменена"
                : "Вы не ответили, срок истёк",
          amountKzt: req.total_price_kzt
        });
      }
    }
    for (const req of sellerAccountRequests) {
      const expired = isRequestExpired(req.status, req.created_at);
      if (["closed", "cancelled", "rejected", "expired"].includes(req.status) || expired) {
        const isSuccess = req.status === "closed";
        items.push({
          id: `acc-${req.id}`,
          title: formatArchiveAccountTitle(req.service_name, req.title),
          orderNumber: getOrderNumber(req.id),
          category: "accounts",
          categoryLabel: "Аккаунт",
          serviceName: req.service_name,
          serviceSlug: req.service_slug,
          counterparty: `Покупатель: @${req.counterparty_username ?? "покупатель"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess
            ? "Завершена"
            : req.status === "rejected"
              ? "Отклонён"
              : req.status === "cancelled"
                ? "Отменён"
                : "Вы не ответили, срок истёк",
          amountKzt: req.price_kzt
        });
      }
    }
    const seenCandidateIds = new Set<string>();
    if (candidateRequests && candidateRequests.length > 0) {
      for (const { family, request: req } of candidateRequests) {
        if (seenCandidateIds.has(req.id)) continue;
        seenCandidateIds.add(req.id);
        const expired = isRequestExpired(req.status, req.created_at, req.expires_at);
        if (["approved", "rejected", "cancelled", "expired"].includes(req.status) || expired) {
          const isSuccess = req.status === "approved";
          const price = req.member_share_kzt ?? family.member_share_kzt;
          items.push({
            id: `fam-req-${req.id}`,
            title: familyTitle(family),
            orderNumber: getOrderNumber(req.id),
            category: "families",
            categoryLabel: "Семья",
            serviceName: family.service_name,
            serviceSlug: family.service_slug,
            counterparty: `Кандидат: @${req.candidate?.username ?? "пользователь"}`,
            counterpartyUsername: req.candidate?.username,
            date: req.created_at ? formatDate(req.created_at) : "",
            dateTime: req.created_at ? formatDateTime(req.created_at) : "",
            rawDate: req.created_at ?? "",
            status: isSuccess ? "successful" : "cancelled",
            statusLabel: isSuccess
              ? "Принята"
              : req.status === "rejected"
                ? "Отклонена"
                : req.status === "cancelled"
                  ? "Отменена"
                  : "Вы не ответили, срок истёк",
            amountKzt: price != null ? price : undefined
          });
        }
      }
    } else {
      for (const fam of families) {
        if (fam.membership.role === "owner" && ownerDetails[fam.family.id]) {
          for (const req of ownerDetails[fam.family.id].requests) {
            if (seenCandidateIds.has(req.id)) continue;
            seenCandidateIds.add(req.id);
            const expired = isRequestExpired(req.status, req.created_at, req.expires_at);
            if (["approved", "rejected", "cancelled", "expired"].includes(req.status) || expired) {
              const isSuccess = req.status === "approved";
              const price = req.member_share_kzt ?? fam.family.member_share_kzt;
              items.push({
                id: `fam-req-${req.id}`,
                title: familyTitle(fam.family),
                orderNumber: getOrderNumber(req.id),
                category: "families",
                categoryLabel: "Семья",
                serviceName: fam.family.service_name,
                serviceSlug: fam.family.service_slug,
                counterparty: `Кандидат: @${req.candidate?.username ?? "пользователь"}`,
                counterpartyUsername: req.candidate?.username,
                date: req.created_at ? formatDate(req.created_at) : "",
                dateTime: req.created_at ? formatDateTime(req.created_at) : "",
                rawDate: req.created_at ?? "",
                status: isSuccess ? "successful" : "cancelled",
                statusLabel: isSuccess
                  ? "Принята"
                  : req.status === "rejected"
                    ? "Отклонена"
                    : req.status === "cancelled"
                      ? "Отменена"
                      : "Вы не ответили, срок истёк",
                amountKzt: price != null ? price : undefined
              });
            }
          }
        }
      }
    }
    return items.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));
  }, [sellerGbRequests, sellerAccountRequests, families, ownerDetails, candidateRequests, timeTick]);

  const outboxArchiveItems = useMemo<ActionsArchiveItem[]>(() => {
    const items: ActionsArchiveItem[] = [];
    for (const req of buyerGbRequests) {
      const expired = isRequestExpired(req.status, req.created_at);
      if (["closed", "cancelled", "rejected", "expired"].includes(req.status) || expired) {
        const isSuccess = req.status === "closed";
        items.push({
          id: `gb-${req.id}`,
          originalId: req.id,
          listingId: req.listing_id,
          amountGb: String(req.amount_gb),
          title: `${formatTradeGb(req.amount_gb)} ГБ · ${req.operator_name}`,
          orderNumber: getOrderNumber(req.id),
          category: "gigabytes",
          categoryLabel: "Трафик",
          serviceName: req.operator_name,
          serviceSlug: req.operator_slug ? `${req.operator_slug}-family-tariff` : undefined,
          counterparty: `Продавец: @${req.counterparty_username ?? "продавец"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess
            ? "Завершена"
            : req.status === "rejected"
              ? "Отклонена"
              : req.status === "cancelled"
                ? "Отменена"
                : "Продавец не ответил, срок истёк",
          amountKzt: req.total_price_kzt
        });
      }
    }
    for (const req of buyerAccountRequests) {
      const expired = isRequestExpired(req.status, req.created_at);
      if (["closed", "cancelled", "rejected", "expired"].includes(req.status) || expired) {
        const isSuccess = req.status === "closed";
        items.push({
          id: `acc-${req.id}`,
          originalId: req.id,
          listingId: req.listing_id,
          title: formatArchiveAccountTitle(req.service_name, req.title),
          orderNumber: getOrderNumber(req.id),
          category: "accounts",
          categoryLabel: "Аккаунт",
          serviceName: req.service_name,
          serviceSlug: req.service_slug,
          counterparty: `Продавец: @${req.counterparty_username ?? "продавец"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess
            ? "Завершена"
            : req.status === "rejected"
              ? "Отклонён"
              : req.status === "cancelled"
                ? "Отменён"
                : "Продавец не ответил, срок истёк",
          amountKzt: req.price_kzt
        });
      }
    }
    for (const req of requests) {
      const expired = isRequestExpired(req.status, req.created_at, req.expires_at);
      if (["approved", "rejected", "cancelled", "expired"].includes(req.status) || expired) {
        const isSuccess = req.status === "approved";
        const price = req.member_share_kzt ?? req.price_kzt;
        items.push({
          id: `fam-req-${req.id}`,
          originalId: req.id,
          familyId: req.family_id,
          title: familyTitle(req),
          orderNumber: getOrderNumber(req.id),
          category: "families",
          categoryLabel: "Семья",
          serviceName: req.service_name ?? "Заявка в семью",
          counterparty: `Организатор: @${req.owner_username ?? "организатор"}`,
          counterpartyUsername: req.owner_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess
            ? "Принята"
            : req.status === "rejected"
              ? "Отклонена"
              : req.status === "cancelled"
                ? "Отменена"
                : "Владелец не ответил, срок истёк",
          amountKzt: price != null ? price : undefined
        });
      }
    }
    return items.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));
  }, [buyerGbRequests, buyerAccountRequests, requests, timeTick]);

  const displayArchiveItems = actionsTab === "inbox" ? inboxArchiveItems : outboxArchiveItems;

  return {
    inboxArchiveItems,
    outboxArchiveItems,
    displayArchiveItems
  };
}
