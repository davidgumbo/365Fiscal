interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

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
        <select
          className="pager-size-select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
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
          ←
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
          →
        </button>
      </div>
    </div>
  );
}
