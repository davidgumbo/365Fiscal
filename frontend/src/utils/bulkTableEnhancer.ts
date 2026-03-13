let bulkTableCounter = 0;

const TABLE_SELECTOR = ".page-content table";

function ensureTableId(table: HTMLTableElement) {
  if (!table.dataset.bulkTableId) {
    bulkTableCounter += 1;
    table.dataset.bulkTableId = `bulk-table-${bulkTableCounter}`;
  }
  return table.dataset.bulkTableId;
}

function getToolbar(table: HTMLTableElement) {
  const tableId = ensureTableId(table);
  const existing = document.querySelector<HTMLDivElement>(
    `.bulk-table-toolbar[data-table-id="${tableId}"]`,
  );
  if (existing) return existing;

  const toolbar = document.createElement("div");
  toolbar.className = "bulk-table-toolbar";
  toolbar.dataset.tableId = tableId;
  toolbar.innerHTML = `
    <div class="bulk-table-toolbar-left">
      <label class="bulk-table-master-toggle">
        <input type="checkbox" class="bulk-table-master-checkbox" />
        <span>Select all</span>
      </label>
      <div class="bulk-table-toolbar-info">0 selected</div>
    </div>
    <div class="bulk-table-toolbar-actions">
      <button type="button" class="bulk-table-btn bulk-table-export">Export Selected</button>
      <button type="button" class="bulk-table-btn bulk-table-delete">Delete Selected</button>
    </div>
  `;

  const anchor = table.closest(".table-wrap") ?? table.parentElement ?? table;
  anchor.parentElement?.insertBefore(toolbar, anchor);
  return toolbar;
}

function getRowCheckboxes(table: HTMLTableElement) {
  return Array.from(
    table.querySelectorAll<HTMLInputElement>('tbody .bulk-table-checkbox'),
  );
}

function getSelectedRows(table: HTMLTableElement) {
  return getRowCheckboxes(table)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.closest("tr"))
    .filter((row): row is HTMLTableRowElement => Boolean(row));
}

function getDeleteButton(row: HTMLTableRowElement) {
  const selectors = [
    'button[title*="delete" i]',
    'button[aria-label*="delete" i]',
    "button.icon-btn.danger",
    "button.btn-danger",
    'button[data-action="delete"]',
  ];
  for (const selector of selectors) {
    const match = row.querySelector<HTMLButtonElement>(selector);
    if (match) return match;
  }

  const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>("button"));
  return (
    buttons.find((button) => {
      const text = (button.textContent || "").trim().toLowerCase();
      const className = button.className.toLowerCase();
      return (
        text.includes("delete") ||
        text.includes("remove") ||
        className.includes("danger") ||
        className.includes("delete")
      );
    }) ?? null
  );
}

function extractCellValue(cell: HTMLTableCellElement | HTMLTableHeaderCellElement) {
  const input = cell.querySelector<HTMLInputElement>("input");
  if (input) {
    if (input.type === "checkbox" || input.type === "radio") {
      return input.checked ? "Yes" : "No";
    }
    return input.value.trim();
  }
  const textarea = cell.querySelector<HTMLTextAreaElement>("textarea");
  if (textarea) return textarea.value.trim();
  const select = cell.querySelector<HTMLSelectElement>("select");
  if (select) {
    return select.options[select.selectedIndex]?.text?.trim() ?? "";
  }
  return (cell.textContent || "").replace(/\s+/g, " ").trim();
}

function downloadCsv(table: HTMLTableElement) {
  const rows = getSelectedRows(table);
  if (!rows.length) return;

  const headers = Array.from(
    table.querySelectorAll<HTMLTableCellElement>("thead th"),
  )
    .filter((th) => !th.classList.contains("bulk-table-select-cell"))
    .map((th) => extractCellValue(th));

  const csvRows = [
    headers,
    ...rows.map((row) =>
      Array.from(row.cells)
        .filter((cell) => !cell.classList.contains("bulk-table-select-cell"))
        .map((cell) => extractCellValue(cell)),
    ),
  ];

  const csv = csvRows
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table.dataset.bulkTableId || "table"}-selected.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateToolbarState(table: HTMLTableElement) {
  const toolbar = getToolbar(table);
  const selectedRows = getSelectedRows(table);
  const count = selectedRows.length;
  const info = toolbar.querySelector<HTMLDivElement>(".bulk-table-toolbar-info");
  const exportButton = toolbar.querySelector<HTMLButtonElement>(".bulk-table-export");
  const deleteButton = toolbar.querySelector<HTMLButtonElement>(".bulk-table-delete");
  const masterCheckbox = toolbar.querySelector<HTMLInputElement>(
    ".bulk-table-master-checkbox",
  );
  const headerCheckbox = table.querySelector<HTMLInputElement>(
    "thead .bulk-table-checkbox",
  );
  const rowCheckboxes = getRowCheckboxes(table);

  if (info) {
    info.textContent = `${count} selected`;
  }
  if (exportButton) {
    exportButton.disabled = count === 0;
    exportButton.onclick = () => downloadCsv(table);
  }
  const deletableRows = selectedRows.filter((row) => getDeleteButton(row));
  if (deleteButton) {
    deleteButton.disabled = deletableRows.length === 0;
    deleteButton.style.display = rowCheckboxes.some((checkbox) => getDeleteButton(checkbox.closest("tr") as HTMLTableRowElement))
      ? "inline-flex"
      : "none";
    deleteButton.onclick = () => {
      if (!deletableRows.length) return;
      const confirmed = window.confirm(
        `Delete ${deletableRows.length} selected item${deletableRows.length === 1 ? "" : "s"}?`,
      );
      if (!confirmed) return;
      [...deletableRows].reverse().forEach((row) => {
        getDeleteButton(row)?.click();
      });
    };
  }
  if (headerCheckbox) {
    headerCheckbox.checked = count > 0 && count === rowCheckboxes.length;
    headerCheckbox.indeterminate = count > 0 && count < rowCheckboxes.length;
  }
  if (masterCheckbox) {
    masterCheckbox.checked = count > 0 && count === rowCheckboxes.length;
    masterCheckbox.indeterminate = count > 0 && count < rowCheckboxes.length;
    masterCheckbox.onchange = () => {
      rowCheckboxes.forEach((rowCheckbox) => {
        rowCheckbox.checked = masterCheckbox.checked;
      });
      updateToolbarState(table);
    };
  }
  toolbar.classList.toggle("active", count > 0);
}

function enhanceTable(table: HTMLTableElement) {
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  if (!bodyRows.length) return;

  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  if (headerRow && !headerRow.querySelector(".bulk-table-select-cell")) {
    const th = document.createElement("th");
    th.className = "bulk-table-select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bulk-table-checkbox";
    checkbox.addEventListener("change", () => {
      getRowCheckboxes(table).forEach((rowCheckbox) => {
        rowCheckbox.checked = checkbox.checked;
      });
      updateToolbarState(table);
    });
    th.appendChild(checkbox);
    headerRow.prepend(th);
  }

  bodyRows.forEach((row) => {
    if (row.querySelector(".bulk-table-select-cell")) return;
    const td = document.createElement("td");
    td.className = "bulk-table-select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bulk-table-checkbox";
    checkbox.addEventListener("change", () => updateToolbarState(table));
    td.appendChild(checkbox);
    row.prepend(td);
  });

  getToolbar(table);
  updateToolbarState(table);
  table.dataset.bulkEnhanced = "true";
}

function scanTables() {
  document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table) => {
    enhanceTable(table);
  });
}

export function initBulkTableEnhancer() {
  const scan = () => scanTables();
  const raf = window.requestAnimationFrame(scan);
  const observer = new MutationObserver(() => scanTables());
  const root = document.querySelector(".page-content") ?? document.body;
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    window.cancelAnimationFrame(raf);
    observer.disconnect();
  };
}
