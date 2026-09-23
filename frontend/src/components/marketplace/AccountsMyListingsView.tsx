import { Button as AppButton } from "../ui";
import { SystemSymbol } from "../SystemSymbol";
import { AccountListingCard as ListingRow } from "../ListingCard";
import type { AccountListing } from "../../types";

export function AccountsMyListingsView({
  listings,
  loadingMore,
  hasMore,
  onCreate,
  onOpen,
  onLoadMore
}: {
  listings: AccountListing[];
  loadingMore: boolean;
  hasMore: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onLoadMore: () => unknown;
}) {
  return (
    <section className="gb-stack">
      <AppButton fullWidth onClick={onCreate}>
        <SystemSymbol name="plus" size={18} />
        Продать аккаунт
      </AppButton>
      {listings.length === 0 ? (
        <div className="gb-empty sm-market-empty">
          <SystemSymbol name="clipboard.list" size={28} />
          <h3>Объявлений пока нет</h3>
          <p>Ваши опубликованные предложения появятся здесь.</p>
        </div>
      ) : (
        <div className="sm-market-family-list">
          {listings.map((item) => (
            <ListingRow
              key={item.id}
              listing={item}
              onClick={() => onOpen(item.id)}
              showStatus
            />
          ))}
        </div>
      )}
      {hasMore ? (
        <AppButton
          variant="tertiary"
          fullWidth
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Загружаем…" : "Показать ещё"}
        </AppButton>
      ) : null}
    </section>
  );
}
