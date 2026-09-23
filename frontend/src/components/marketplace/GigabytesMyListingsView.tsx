import { Button as AppButton } from "../ui";
import { SystemSymbol } from "../SystemSymbol";
import { GigabytesListingCard as ListingRow } from "../ListingCard";
import type { MarketplaceListing } from "../../types";

export function GigabytesMyListingsView({
  listings,
  loading,
  loadingMore,
  hasMore,
  onCreate,
  onOpen,
  onLoadMore
}: {
  listings: MarketplaceListing[];
  loading: boolean;
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
        Продать ГБ
      </AppButton>
      {loading ? (
        <div className="sm-market-family-list" aria-label="Загружаем" role="status">
          {[0, 1].map((n) => (
            <div key={n} className="sm-listing-skeleton" aria-hidden>
              <span />
              <div />
              <span />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="gb-empty sm-market-empty">
          <SystemSymbol name="clipboard.list" size={28} />
          <h3>Объявлений пока нет</h3>
          <p>Ваши предложения появятся здесь.</p>
        </div>
      ) : (
        <div className="sm-market-family-list">
          {listings.map((item) => (
            <ListingRow key={item.id} listing={item} onClick={() => onOpen(item.id)} showStatus />
          ))}
        </div>
      )}
      {hasMore ? (
        <AppButton variant="tertiary" fullWidth disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Загружаем…" : "Показать ещё"}
        </AppButton>
      ) : null}
    </section>
  );
}
