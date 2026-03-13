interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const NextArrow = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    className="size-6"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
    />
  </svg>
);

const PrevArrow = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    className="size-6"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18"
    />
  </svg>
);

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className = "",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const fromItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toItem = Math.min(totalItems, safePage * pageSize);

  return (
    <div className={`table-pagination ${className}`.trim()}>
      <div className="pager-left">
        <label className="pager-size-label">Rows:</label>
        {/* <select
          className="pager-size-select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select> */}
      </div>

      <span className="pager-info">
        {totalItems === 0
          ? "No records"
          : `Showing ${fromItem}-${toItem} of ${totalItems}`}
      </span>

      <div className="pager-buttons">
        <button
          className="pager-btn"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
        >
          <PrevArrow />
        </button>
        <span className="pager-page">
          Page {safePage} of {totalPages}
        </span>
        <button
          className="pager-btn"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
        >
          <NextArrow />
        </button>
      </div>
    </div>
  );
}
