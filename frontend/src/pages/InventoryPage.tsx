import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";
import { useCompanies, Company } from "../hooks/useCompanies";

// ============= TYPES =============
type Category = {
  id: number;
  company_id: number;
  name: string;
};

type Product = {
  id: number;
  company_id: number;
  category_id: number | null;
  name: string;
  description: string;
  image_url: string;
  sale_price: number;
  tax_rate: number;
  tax_id: number | null;
  sales_cost: number;
  purchase_cost: number;
  hs_code: string;
  reference: string;
  barcode: string;
  product_type: string;
  uom: string;
  track_inventory: boolean;
  min_stock_quantity: number;
  max_stock_quantity: number;
  reorder_point: number;
  weight: number;
  weight_uom: string;
  is_active: boolean;
  can_be_sold: boolean;
  can_be_purchased: boolean;
};

type TaxSetting = {
  id: number;
  company_id: number;
  name: string;
  rate: number;
  zimra_tax_id: number | null;
  zimra_tax_code: string;
  is_zimra_tax: boolean;
  is_active: boolean;
};

type ProductWithStock = Product & {
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  stock_value: number;
};

type Warehouse = {
  id: number;
  company_id: number;
  name: string;
  code: string;
  address: string;
};

type Location = {
  id: number;
  warehouse_id: number;
  name: string;
  code: string;
  is_primary: boolean;
};

type StockMove = {
  id: number;
  company_id: number;
  product_id: number;
  warehouse_id: number | null;
  location_id: number | null;
  reference: string;
  move_type: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  source_document: string;
  state: string;
  scheduled_date: string | null;
  done_date: string | null;
  notes: string;
};

type StockQuant = {
  id: number;
  product_id: number;
  warehouse_id: number | null;
  location_id: number | null;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  unit_cost: number;
  total_value: number;
};

// ============= CONSTANTS =============
const MOVE_TYPES = [
  { value: "in", label: "Receipt" },
  { value: "out", label: "Delivery" },
  { value: "internal", label: "Internal Transfer" },
  { value: "adjustment", label: "Inventory Adjustment" },
];

const STATES = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const PRODUCT_TYPES = [
  { value: "storable", label: "Storable Product" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
];

const UOMS = [
  { value: "Units", label: "Units" },
  { value: "KG", label: "Kilograms" },
  { value: "L", label: "Liters" },
  { value: "M", label: "Meters" },
  { value: "BOX", label: "Box" },
  { value: "PACK", label: "Pack" },
];

type MainView =
  | "overview"
  | "products"
  | "categories"
  | "warehouses"
  | "operations"
  | "reporting";
type SubView = "list" | "kanban" | "form";
type InventoryIconProps = { color?: string };

const OverviewIcon = ({ color }: InventoryIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={color ? { color } : undefined}
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ProductsIcon = ({ color }: InventoryIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={color ? { color } : undefined}
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const CategoriesIcon = ({ color }: InventoryIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={color ? { color } : undefined}
  >
    <rect x="3" y="4" width="7" height="7" rx="1" />
    <rect x="3" y="13" width="7" height="7" rx="1" />
    <rect x="14" y="6" width="7" height="12" rx="1" />
  </svg>
);

const WarehousesIcon = ({ color }: InventoryIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={color ? { color } : undefined}
  >
    <path d="M3 7l9-4 9 4" />
    <path d="M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />
    <path d="M3 7l9 4 9-4" />
    <path d="M7 11v6" />
    <path d="M12 12v7" />
    <path d="M17 11v6" />
  </svg>
);

const OperationsIcon = ({ color }: InventoryIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={color ? { color } : undefined}
  >
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>
);

export default function InventoryPage() {
  const navigate = useNavigate();
  const { me } = useMe();
  const companies = useCompanies();
  const isAdmin = Boolean(me?.is_admin);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");

  const filteredCompanies = useMemo(() => {
    if (!companyQuery.trim()) return companies;
    const q = companyQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.tin && c.tin.toLowerCase().includes(q)) ||
        (c.vat && c.vat.toLowerCase().includes(q)),
    );
  }, [companies, companyQuery]);

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;

  const [mainView, setMainView] = useState<MainView>("overview");
  const [subView, setSubView] = useState<SubView>("list");

  // Data states
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [stockQuants, setStockQuants] = useState<StockQuant[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);

  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(
    null,
  );
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const [isNew, setIsNew] = useState(false);

  // Product form
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    reference: "",
    barcode: "",
    category_id: null as number | null,
    product_type: "storable",
    uom: "Units",
    sale_price: 0,
    sales_cost: 0,
    purchase_cost: 0,
    tax_rate: 15,
    tax_id: null as number | null,
    hs_code: "",
    track_inventory: true,
    min_stock_quantity: 0,
    max_stock_quantity: 0,
    reorder_point: 0,
    weight: 0,
    weight_uom: "kg",
    is_active: true,
    can_be_sold: true,
    can_be_purchased: true,
  });
  const [productInfoTab, setProductInfoTab] = useState<
    "general" | "inventory" | "description"
  >("general");
  useEffect(() => {
    if (
      productForm.product_type !== "storable" &&
      productInfoTab === "inventory"
    ) {
      setProductInfoTab("general");
    }
  }, [productForm.product_type, productInfoTab]);
  const [productImageUrl, setProductImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Warehouse form
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    code: "",
    address: "",
  });

  // Location form
  const [locationForm, setLocationForm] = useState({
    warehouse_id: null as number | null,
    name: "",
    code: "",
    is_primary: false,
  });
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Stock move form
  const [moveForm, setMoveForm] = useState({
    product_id: null as number | null,
    warehouse_id: null as number | null,
    location_id: null as number | null,
    move_type: "in",
    quantity: 0,
    unit_cost: 0,
    reference: "",
    source_document: "",
    notes: "",
  });

  // Category form
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Operations sub-tab
  const [operationsTab, setOperationsTab] = useState<"moves" | "quants">(
    "moves",
  );
  const [filterState, setFilterState] = useState<string>("all");

  // ============= EFFECTS =============
  // Portal users auto-select their first company
  useEffect(() => {
    if (!isAdmin && companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [isAdmin, companies, companyId]);

  useEffect(() => {
    if (companyId) {
      loadAllData();
    }
  }, [companyId]);

  // ============= DATA LOADING =============
  const loadAllData = async () => {
    if (!companyId) {
      console.log("loadAllData skipped - no companyId");
      return;
    }
    console.log("loadAllData starting for companyId:", companyId);
    setLoading(true);
    try {
      const [prods, cats, whs, moves, quants, taxes] = await Promise.all([
        apiFetch<ProductWithStock[]>(
          `/products/with-stock?company_id=${companyId}`,
        ),
        apiFetch<Category[]>(`/categories?company_id=${companyId}`),
        apiFetch<Warehouse[]>(`/warehouses?company_id=${companyId}`),
        apiFetch<StockMove[]>(`/stock/moves?company_id=${companyId}`),
        apiFetch<StockQuant[]>(`/stock/quants?company_id=${companyId}`),
        apiFetch<TaxSetting[]>(`/tax-settings?company_id=${companyId}`),
      ]);
      console.log("loadAllData results:", {
        prods: prods.length,
        cats: cats.length,
        whs: whs.length,
        moves: moves.length,
        quants: quants.length,
      });
      console.log("Warehouses loaded:", whs);
      const stockValueByProductId = new Map<number, number>();
      for (const quant of quants) {
        const current = stockValueByProductId.get(quant.product_id) ?? 0;
        stockValueByProductId.set(
          quant.product_id,
          current +
            (Number.isFinite(quant.total_value) ? quant.total_value : 0),
        );
      }
      const productsWithStockValue = prods.map((p) => {
        const valueFromQuants = stockValueByProductId.get(p.id);
        const computedValue =
          valueFromQuants ??
          (Number.isFinite(p.quantity_on_hand) &&
          Number.isFinite(p.purchase_cost)
            ? p.quantity_on_hand * p.purchase_cost
            : 0);
        return { ...p, stock_value: computedValue };
      });
      setProducts(productsWithStockValue);
      setCategories(cats);
      setWarehouses(whs);
      setStockMoves(moves);
      setStockQuants(quants);
      setTaxSettings(taxes);

      // Load locations for all warehouses
      if (whs.length) {
        const allLocs = await Promise.all(
          whs.map((w) =>
            apiFetch<Location[]>(`/locations?warehouse_id=${w.id}`),
          ),
        );
        setLocations(allLocs.flat());
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  // ============= PRODUCT ACTIONS =============
  const startNewProduct = () => {
    setSelectedProductId(null);
    setIsNew(true);
    setProductImageUrl("");
    setProductForm({
      name: "",
      description: "",
      reference: "",
      barcode: "",
      category_id: null,
      product_type: "storable",
      uom: "Units",
      sale_price: 0,
      sales_cost: 0,
      purchase_cost: 0,
      tax_rate: 15,
      tax_id: null,
      hs_code: "",
      track_inventory: true,
      min_stock_quantity: 0,
      max_stock_quantity: 0,
      reorder_point: 0,
      weight: 0,
      weight_uom: "kg",
      is_active: true,
      can_be_sold: true,
      can_be_purchased: true,
    });
    setSubView("form");
  };

  const openProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setIsNew(false);
    setProductImageUrl(product.image_url || "");
    setProductForm({
      name: product.name,
      description: product.description,
      reference: product.reference,
      barcode: product.barcode,
      category_id: product.category_id,
      product_type: product.product_type,
      uom: product.uom,
      sale_price: product.sale_price,
      sales_cost: product.sales_cost,
      purchase_cost: product.purchase_cost,
      tax_rate: product.tax_rate,
      tax_id: product.tax_id ?? null,
      hs_code: product.hs_code,
      track_inventory: product.track_inventory,
      min_stock_quantity: product.min_stock_quantity,
      max_stock_quantity: product.max_stock_quantity,
      reorder_point: product.reorder_point,
      weight: product.weight,
      weight_uom: product.weight_uom,
      is_active: product.is_active,
      can_be_sold: product.can_be_sold,
      can_be_purchased: product.can_be_purchased,
    });
    setSubView("form");
  };

  const saveProduct = async () => {
    if (!companyId || !productForm.name) return;
    setSaving(true);
    try {
      const payload = { ...productForm, company_id: companyId };
      if (selectedProductId && !isNew) {
        await apiFetch(`/products/${selectedProductId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadAllData();
      setSubView("list");
      setIsNew(false);
    } finally {
      setSaving(false);
    }
  };

  const handleProductImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!selectedProductId || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const updated = await apiFetch<Product>(
        `/products/${selectedProductId}/image`,
        {
          method: "POST",
          body: fd,
        },
      );
      setProductImageUrl(updated.image_url || "");
    } catch (err: any) {
      alert(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleProductImageDelete = async () => {
    if (!selectedProductId) return;
    setUploadingImage(true);
    try {
      const updated = await apiFetch<Product>(
        `/products/${selectedProductId}/image`,
        { method: "DELETE" },
      );
      setProductImageUrl(updated.image_url || "");
    } catch {
      alert("Failed to remove image");
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteProduct = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setSaving(true);
    try {
      await apiFetch(`/products/${productId}`, { method: "DELETE" });
      await loadAllData();
      setSubView("list");
    } finally {
      setSaving(false);
    }
  };

  // ============= WAREHOUSE ACTIONS =============
  const startNewWarehouse = () => {
    setSelectedWarehouseId(null);
    setIsNew(true);
    setWarehouseForm({ name: "", code: "", address: "" });
    setSubView("form");
  };

  const openWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouseId(warehouse.id);
    setIsNew(false);
    setWarehouseForm({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
    });
    setSubView("form");
  };

  const saveWarehouse = async () => {
    console.log("saveWarehouse called", {
      companyId,
      warehouseForm,
      selectedWarehouseId,
      isNew,
    });
    if (!companyId) {
      alert("Please select a company first");
      return;
    }
    if (!warehouseForm.name) {
      alert("Please enter a warehouse name");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...warehouseForm, company_id: companyId };
      console.log("saveWarehouse payload:", payload);
      if (selectedWarehouseId && !isNew) {
        console.log("PATCH warehouse", selectedWarehouseId);
        await apiFetch(`/warehouses/${selectedWarehouseId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        console.log("POST new warehouse");
        await apiFetch("/warehouses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      console.log("saveWarehouse success, loading data");
      await loadAllData();
      setSubView("list");
      setIsNew(false);
    } catch (err) {
      console.error("Error saving warehouse:", err);
      alert(
        "Error saving warehouse: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (warehouseId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this warehouse? This will also delete all its locations.",
      )
    )
      return;
    setSaving(true);
    try {
      await apiFetch(`/warehouses/${warehouseId}`, { method: "DELETE" });
      await loadAllData();
      setSubView("list");
    } finally {
      setSaving(false);
    }
  };

  // ============= LOCATION ACTIONS =============
  const openLocationModal = (location?: Location) => {
    if (location) {
      setSelectedLocationId(location.id);
      setLocationForm({
        warehouse_id: location.warehouse_id,
        name: location.name,
        code: location.code,
        is_primary: location.is_primary,
      });
    } else {
      setSelectedLocationId(null);
      setLocationForm({
        warehouse_id: warehouses[0]?.id ?? null,
        name: "",
        code: "",
        is_primary: false,
      });
    }
    setShowLocationModal(true);
  };

  const saveLocation = async () => {
    if (!locationForm.warehouse_id || !locationForm.name) return;
    setSaving(true);
    try {
      if (selectedLocationId) {
        await apiFetch(`/locations/${selectedLocationId}`, {
          method: "PATCH",
          body: JSON.stringify(locationForm),
        });
      } else {
        await apiFetch("/locations", {
          method: "POST",
          body: JSON.stringify(locationForm),
        });
      }
      await loadAllData();
      setShowLocationModal(false);
      setSelectedLocationId(null);
      setLocationForm({
        warehouse_id: null,
        name: "",
        code: "",
        is_primary: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteLocation = async (locationId: number) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    setSaving(true);
    try {
      await apiFetch(`/locations/${locationId}`, { method: "DELETE" });
      await loadAllData();
    } finally {
      setSaving(false);
    }
  };

  // ============= STOCK MOVE ACTIONS =============
  const startNewMove = (moveType: string = "in") => {
    setSelectedMoveId(null);
    setIsNew(true);
    const defaultProduct = products[0];
    setMoveForm({
      product_id: defaultProduct?.id ?? null,
      warehouse_id: warehouses[0]?.id ?? null,
      location_id: locations[0]?.id ?? null,
      move_type: moveType,
      quantity: 0,
      unit_cost: defaultProduct?.purchase_cost ?? 0,
      reference: "",
      source_document: "",
      notes: "",
    });
    setSubView("form");
  };

  const openMove = (move: StockMove) => {
    setSelectedMoveId(move.id);
    setIsNew(false);
    setMoveForm({
      product_id: move.product_id,
      warehouse_id: move.warehouse_id,
      location_id: move.location_id,
      move_type: move.move_type,
      quantity: move.quantity,
      unit_cost: move.unit_cost,
      reference: move.reference,
      source_document: move.source_document,
      notes: move.notes,
    });
    setSubView("form");
  };

  const saveMove = async () => {
    if (!companyId || !moveForm.product_id) return;
    setSaving(true);
    try {
      const payload = { ...moveForm, company_id: companyId };
      if (selectedMoveId && !isNew) {
        await apiFetch(`/stock/moves/${selectedMoveId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/stock/moves", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadAllData();
      setSubView("list");
      setIsNew(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmMove = async (moveId: number) => {
    if (!companyId) return;
    await apiFetch(`/stock/moves/${moveId}/confirm`, { method: "POST" });
    await loadAllData();
  };

  const cancelMove = async (moveId: number) => {
    if (!companyId) return;
    await apiFetch(`/stock/moves/${moveId}/cancel`, { method: "POST" });
    await loadAllData();
  };

  // ============= CATEGORY ACTIONS =============
  const openCategoryModal = (category?: Category) => {
    if (category) {
      setSelectedCategoryId(category.id);
      setCategoryForm({ name: category.name });
    } else {
      setSelectedCategoryId(null);
      setCategoryForm({ name: "" });
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!companyId || !categoryForm.name) return;
    setSaving(true);
    try {
      if (selectedCategoryId) {
        await apiFetch(`/categories/${selectedCategoryId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: categoryForm.name }),
        });
      } else {
        await apiFetch("/categories", {
          method: "POST",
          body: JSON.stringify({ ...categoryForm, company_id: companyId }),
        });
      }
      await loadAllData();
      setShowCategoryModal(false);
      setSelectedCategoryId(null);
      setCategoryForm({ name: "" });
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    setSaving(true);
    try {
      await apiFetch(`/categories/${categoryId}`, { method: "DELETE" });
      await loadAllData();
    } finally {
      setSaving(false);
    }
  };

  // ============= NAVIGATION =============
  const goBack = () => {
    setSubView("list");
    setSelectedProductId(null);
    setSelectedWarehouseId(null);
    setSelectedMoveId(null);
    setIsNew(false);
  };

  // ============= COMPUTED =============
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedWarehouse = warehouses.find(
    (w) => w.id === selectedWarehouseId,
  );
  const selectedMove = stockMoves.find((m) => m.id === selectedMoveId);

  const filteredProducts = products.filter((p) => {
    if (filterCategoryId !== null && p.category_id !== filterCategoryId)
      return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  });

  const filteredMoves = stockMoves.filter((m) => {
    if (filterState !== "all" && m.state !== filterState) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const product = products.find((p) => p.id === m.product_id);
    return (
      m.reference?.toLowerCase().includes(q) ||
      product?.name.toLowerCase().includes(q)
    );
  });

  const productMonetaryTotals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => {
        acc.salePrice += Number.isFinite(p.sale_price) ? p.sale_price : 0;
        acc.purchaseCost += Number.isFinite(p.purchase_cost)
          ? p.purchase_cost
          : 0;
        acc.stockValue += Number.isFinite(p.stock_value) ? p.stock_value : 0;
        return acc;
      },
      { salePrice: 0, purchaseCost: 0, stockValue: 0 },
    );
  }, [filteredProducts]);

  const categoryProductCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products) {
      if (p.category_id === null) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  // Stats
  const stats = {
    totalProducts: products.length,
    lowStock: products.filter(
      (p) => p.quantity_on_hand <= p.reorder_point && p.track_inventory,
    ).length,
    totalWarehouses: warehouses.length,
    totalLocations: locations.length,
    pendingMoves: stockMoves.filter((m) => m.state === "draft").length,
    totalStockValue: stockQuants.reduce((sum, q) => sum + q.total_value, 0),
  };

  const warehouseLocations = (warehouseId: number) =>
    locations.filter((l) => l.warehouse_id === warehouseId);

  const goBackToCompanies = () => {
    setCompanyId(null);
    setProducts([]);
    setCategories([]);
    setWarehouses([]);
    setLocations([]);
    setStockMoves([]);
    setStockQuants([]);
    setTaxSettings([]);
    navigate("/inventory");
  };

  // ─── Admin company selection view ───
  if (isAdmin && !companyId) {
    return (
      <div className="content">
        <div
          className=""
          style={{
            display: "flex",
            width: "auto",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div className="company-search">
            <input
              type="text"
              placeholder="Search company by name, VAT, or TIN"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
          </div>
        </div>

        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
          Select a company to view its inventory.
        </p>

        <div className="device-company-grid">
          {filteredCompanies.map((c) => (
            <button
              key={c.id}
              className="device-company-card"
              onClick={() => setCompanyId(c.id)}
            >
              <div className="device-company-icon">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <path d="M9 22v-4h6v4" />
                  <line x1="8" y1="6" x2="8" y2="6.01" />
                  <line x1="16" y1="6" x2="16" y2="6.01" />
                  <line x1="12" y1="6" x2="12" y2="6.01" />
                  <line x1="8" y1="10" x2="8" y2="10.01" />
                  <line x1="16" y1="10" x2="16" y2="10.01" />
                  <line x1="12" y1="10" x2="12" y2="10.01" />
                  <line x1="8" y1="14" x2="8" y2="14.01" />
                  <line x1="16" y1="14" x2="16" y2="14.01" />
                  <line x1="12" y1="14" x2="12" y2="14.01" />
                </svg>
              </div>
              <div className="device-company-info">
                <div className="device-company-name">{c.name}</div>
                {c.tin && (
                  <div className="device-company-detail">TIN: {c.tin}</div>
                )}
                {c.vat && (
                  <div className="device-company-detail">VAT: {c.vat}</div>
                )}
              </div>
              <div className="device-company-arrow">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
          {!filteredCompanies.length && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: 40,
                color: "var(--muted)",
              }}
            >
              {companyQuery.trim()
                ? "No companies match your search."
                : "No companies found. Create a company first."}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============= RENDER =============
  return (
    <>
      {/* Company breadcrumb for admin */}
      {isAdmin && companyId && (
        <div
          className="o-control-panel"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            padding: "0 8px",
          }}
        >
          <div className="o-breadcrumb">
            <span
              className="o-breadcrumb-item"
              style={{ cursor: "pointer" }}
              onClick={goBackToCompanies}
            >
              Inventory
            </span>
            <span className="o-breadcrumb-separator">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span className="o-breadcrumb-current">
              {selectedCompany?.name || "Company"}
            </span>
          </div>
        </div>
      )}
      <div
        className="page-container"
        style={{
          display: "flex",
          gap: 0,
          flexWrap: "nowrap",
        }}
      >
        <div id="main-content" className="two-panel two-panel-left">
          {/* Side Bar Navigation */}
          <div className="o-sidebar">
            <div className="o-sidebar-section">
              <div className="o-sidebar-title">MENU</div>
              {[
                {
                  key: "overview",
                  label: "OVERVIEW",
                  icon: OverviewIcon,
                  color: "var(--blue-600)",
                },
                {
                  key: "products",
                  label: "PRODUCTS",
                  icon: ProductsIcon,
                  color: "var(--amber-500)",
                },
                {
                  key: "categories",
                  label: "PRODUCT CATEGORIES",
                  icon: CategoriesIcon,
                  color: "var(--indigo-500)",
                },
                {
                  key: "warehouses",
                  label: "WAREHOUSES",
                  icon: WarehousesIcon,
                  color: "var(--emerald-500)",
                },
                {
                  key: "operations",
                  label: "OPERATIONS",
                  icon: OperationsIcon,
                  color: "var(--violet-500)",
                },
              ].map((tab) => (
                <div
                  key={tab.key}
                  className={`o-sidebar-item ${mainView === tab.key ? "active" : ""}`}
                  onClick={() => {
                    setMainView(tab.key as MainView);
                    setSubView("list");
                    setSearchQuery("");
                  }}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <tab.icon color={tab.color} />
                    <span
                      style={{
                        letterSpacing: "0.5px",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {tab.label}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="o-main">
            {/* Form Sub Control Panel */}
            {subView === "form" && (
              <div
                className="o-control-panel"
                style={{ background: "var(--gray-50)", marginTop: -8 }}
              >
                <div className="o-control-panel-left">
                  <button className="o-btn o-btn-link" onClick={goBack}>
                    ← Back to List
                  </button>
                  <span style={{ fontWeight: 600, marginLeft: 16 }}>
                    {mainView === "products" &&
                      (isNew ? "New Product" : selectedProduct?.name)}
                    {mainView === "warehouses" &&
                      (isNew ? "New Warehouse" : selectedWarehouse?.name)}
                    {mainView === "operations" &&
                      (isNew
                        ? "New Stock Move"
                        : selectedMove?.reference || `Move #${selectedMoveId}`)}
                  </span>
                </div>
                <div className="o-control-panel-right">
                  <button
                    className="o-btn o-btn-primary"
                    onClick={() => {
                      if (mainView === "products") saveProduct();
                      else if (mainView === "warehouses") saveWarehouse();
                      else if (mainView === "operations") saveMove();
                    }}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  {!isNew && (
                    <button
                      className="device-icon-btn danger"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => {
                        if (mainView === "products" && selectedProductId)
                          deleteProduct(selectedProductId);
                        else if (
                          mainView === "warehouses" &&
                          selectedWarehouseId
                        )
                          deleteWarehouse(selectedWarehouseId);
                      }}
                      disabled={saving}
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <button className="o-btn o-btn-secondary" onClick={goBack}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div
              className="o-content"
              style={{
                flexWrap: "wrap",
                alignContent: "flex-start",
                rowGap: 12,
              }}
            >
              {/* Sub Control Panel */}
              {subView !== "form" && mainView !== "overview" && (
                <div
                  id="filters-search"
                  className="o-control-panel"
                  style={{
                    background: "var(--white-500)",
                    height: "5rem",
                    width: "100%",
                    flex: "1 1 100%",
                  }}
                >
                  <div className="o-control-panel-left">
                    <div className="o-searchbox">
                      <span className="o-searchbox-icon">Search</span>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {mainView === "operations" && (
                      <div style={{ display: "flex", gap: 4, marginLeft: 1 }}>
                        <button
                          className={`o-btn ${operationsTab === "moves" ? "o-btn-primary" : "o-btn-secondary"}`}
                          onClick={() => setOperationsTab("moves")}
                        >
                          Stock Moves
                        </button>
                        <button
                          className={`o-btn ${operationsTab === "quants" ? "o-btn-primary" : "o-btn-secondary"}`}
                          onClick={() => setOperationsTab("quants")}
                        >
                          Stock On Hand
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="o-control-panel-right">
                    {mainView === "products" && (
                      <div className="o-view-switcher">
                        <button
                          className={subView === "list" ? "active" : ""}
                          onClick={() => setSubView("list")}
                          title="List View"
                        >
                          List
                        </button>
                        <button
                          className={subView === "kanban" ? "active" : ""}
                          onClick={() => setSubView("kanban")}
                          title="Kanban View"
                        >
                          Grid
                        </button>
                      </div>
                    )}

                    {mainView === "products" && (
                      <>
                        <button
                          className="o-btn o-btn-secondary"
                          onClick={() => openCategoryModal()}
                        >
                          + Category
                        </button>
                        <button
                          className="o-btn o-btn-primary"
                          onClick={startNewProduct}
                        >
                          + New Product
                        </button>
                      </>
                    )}

                    {mainView === "categories" && (
                      <button
                        className="o-btn o-btn-primary"
                        onClick={() => openCategoryModal()}
                      >
                        + New Category
                      </button>
                    )}

                    {mainView === "warehouses" && (
                      <button
                        className="o-btn o-btn-primary"
                        onClick={startNewWarehouse}
                      >
                        + New Warehouse
                      </button>
                    )}

                    {mainView === "operations" && operationsTab === "moves" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {MOVE_TYPES.map((t) => (
                          <button
                            key={t.value}
                            className="o-btn o-btn-secondary"
                            onClick={() => startNewMove(t.value)}
                            title={t.label}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* ============= OVERVIEW ============= */}
              {mainView === "overview" && (
                <div style={{ padding: 20, width: "100%" }}>
                  {/* Stats Row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 1,
                      background: "var(--zinc-200)",
                      borderRadius: 8,
                      overflow: "hidden",
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        background: "var(--white-500)",
                        padding: "16px 20px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                      onClick={() => setMainView("products")}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "var(--blue-600)",
                        }}
                      >
                        {stats.totalProducts}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--gray-500)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginTop: 4,
                        }}
                      >
                        Products
                      </div>
                    </div>
                    <div
                      style={{
                        background:
                          stats.lowStock > 0
                            ? "var(--amber-100)"
                            : "var(--white-500)",
                        padding: "16px 20px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color:
                            stats.lowStock > 0
                              ? "var(--yellow-800)"
                              : "var(--blue-600)",
                        }}
                      >
                        {stats.lowStock}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--gray-500)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginTop: 4,
                        }}
                      >
                        Low Stock
                      </div>
                    </div>
                    <div
                      style={{
                        background: "var(--white-500)",
                        padding: "16px 20px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                      onClick={() => setMainView("warehouses")}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "var(--blue-600)",
                        }}
                      >
                        {stats.totalWarehouses}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--gray-500)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginTop: 4,
                        }}
                      >
                        Warehouses
                      </div>
                    </div>
                    <div
                      style={{
                        background: "var(--white-500)",
                        padding: "16px 20px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                      onClick={() => setMainView("operations")}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "var(--blue-600)",
                        }}
                      >
                        {stats.pendingMoves}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--gray-500)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginTop: 4,
                        }}
                      >
                        Pending Moves
                      </div>
                    </div>
                    <div
                      style={{
                        background: "var(--white-500)",
                        padding: "16px 20px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "var(--blue-600)",
                        }}
                      >
                        ${stats.totalStockValue.toFixed(2)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--gray-500)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginTop: 4,
                        }}
                      >
                        Stock Value
                      </div>
                    </div>
                  </div>

                  {/* Three Column Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    {/* Quick Actions */}
                    <div
                      style={{
                        background: "var(--white-500)",
                        border: "1px solid var(--zinc-200)",
                        borderRadius: 8,
                        padding: 20,
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        Quick Actions
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                        }}
                      >
                        {MOVE_TYPES.map((t) => (
                          <button
                            key={t.value}
                            className="o-btn o-btn-secondary"
                            style={{
                              justifyContent: "flex-start",
                              padding: "12px 16px",
                              fontSize: 13,
                            }}
                            onClick={() => {
                              setMainView("operations");
                              startNewMove(t.value);
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div
                      style={{
                        background: "var(--white-500)",
                        border: "1px solid var(--zinc-200)",
                        borderRadius: 8,
                        padding: 20,
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        Recent Stock Moves
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {stockMoves.slice(0, 5).map((m) => {
                          const product = products.find(
                            (p) => p.id === m.product_id,
                          );
                          return (
                            <div
                              key={m.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "var(--gray-50)",
                                borderRadius: 4,
                                fontSize: 13,
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 500 }}>
                                  {m.reference ||
                                    `MOV/${String(m.id).padStart(5, "0")}`}
                                </span>
                                <span
                                  style={{
                                    color: "var(--gray-500)",
                                    marginLeft: 8,
                                  }}
                                >
                                  {product?.name}
                                </span>
                              </div>
                              <span className={`o-tag o-tag-${m.state}`}>
                                {STATES.find((s) => s.value === m.state)?.label}
                              </span>
                            </div>
                          );
                        })}
                        {stockMoves.length === 0 && (
                          <div
                            style={{
                              color: "var(--gray-500)",
                              textAlign: "center",
                              padding: 20,
                              fontSize: 13,
                            }}
                          >
                            No stock moves yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Low Stock Alert */}
                    <div
                      style={{
                        background: "var(--white-500)",
                        border: "1px solid var(--zinc-200)",
                        borderRadius: 8,
                        padding: 20,
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--yellow-800)",
                        }}
                      >
                        Low Stock Products
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {products
                          .filter(
                            (p) =>
                              p.quantity_on_hand <= p.reorder_point &&
                              p.track_inventory,
                          )
                          .slice(0, 5)
                          .map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "var(--amber-100)",
                                borderRadius: 4,
                                fontSize: 13,
                              }}
                            >
                              <span style={{ fontWeight: 500 }}>{p.name}</span>
                              <span style={{ color: "var(--yellow-800)" }}>
                                {p.quantity_on_hand} / {p.reorder_point} {p.uom}
                              </span>
                            </div>
                          ))}
                        {stats.lowStock === 0 && (
                          <div
                            style={{
                              color: "var(--gray-500)",
                              textAlign: "center",
                              padding: 20,
                              fontSize: 13,
                            }}
                          >
                            All products have sufficient stock
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Warehouses Summary - Full Width */}
                  <div
                    style={{
                      background: "var(--white-500)",
                      border: "1px solid var(--zinc-200)",
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 16px 0",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Warehouses
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {warehouses.map((w) => (
                        <div
                          key={w.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "var(--gray-50)",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                          onClick={() => {
                            setMainView("warehouses");
                            openWarehouse(w);
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500 }}>{w.name}</span>
                            <span
                              style={{
                                color: "var(--gray-500)",
                                marginLeft: 8,
                              }}
                            >
                              ({w.code})
                            </span>
                          </div>
                          <span style={{ color: "var(--gray-500)" }}>
                            {warehouseLocations(w.id).length} locations
                          </span>
                        </div>
                      ))}
                      {warehouses.length === 0 && (
                        <div style={{ textAlign: "center", padding: 20 }}>
                          <button
                            className="o-btn o-btn-primary"
                            onClick={() => {
                              setMainView("warehouses");
                              startNewWarehouse();
                            }}
                          >
                            + Create First Warehouse
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============= PRODUCTS LIST ============= */}
              {mainView === "products" && subView === "list" && (
                <>
                  {/* Sidebar */}
                  <div className="o-sidebar">
                    <div className="o-sidebar-section">
                      <div
                        className="o-sidebar-title"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>Categories</span>
                        <button
                          onClick={() => openCategoryModal()}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--indigo-500)",
                            fontSize: 18,
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                          title="Add Category"
                        >
                          +
                        </button>
                      </div>
                      <select
                        className="o-form-select"
                        value={filterCategoryId ?? ""}
                        onChange={(e) =>
                          setFilterCategoryId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">
                          All Products ({products.length})
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (
                            {
                              products.filter((p) => p.category_id === c.id)
                                .length
                            }
                            )
                          </option>
                        ))}
                      </select>
                      {categories.length === 0 && (
                        <div
                          style={{
                            paddingTop: 8,
                            color: "var(--slate-400)",
                            fontSize: 12,
                          }}
                        >
                          No categories yet.
                        </div>
                      )}
                    </div>

                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title">Product Type</div>
                      {PRODUCT_TYPES.map((t) => (
                        <div key={t.value} className="o-sidebar-item">
                          <span>{t.label}</span>
                          <span className="o-sidebar-count">
                            {
                              products.filter((p) => p.product_type === t.value)
                                .length
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main List */}
                  <div className="o-main">
                    <div className="o-list-view">
                      <table className="o-list-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}></th>
                            <th>Product</th>
                            <th>Reference</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>On Hand</th>
                            <th>Available</th>
                            <th className="text-end">Sale Price</th>
                            <th className="text-end">Cost</th>
                            <th className="text-end">Stock Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((p) => {
                            const category = categories.find(
                              (c) => c.id === p.category_id,
                            );
                            return (
                              <tr
                                key={p.id}
                                onDoubleClick={() => openProduct(p)}
                                style={{ cursor: "pointer" }}
                              >
                                <td>
                                  <span
                                    style={{ fontSize: 14, fontWeight: 600 }}
                                  >
                                    P
                                  </span>
                                </td>
                                <td>
                                  <span
                                    style={{
                                      color: "var(--blue-600)",
                                      fontWeight: 500,
                                      cursor: "pointer",
                                    }}
                                    onClick={() => openProduct(p)}
                                  >
                                    {p.name}
                                  </span>
                                  {p.barcode && (
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "var(--muted)",
                                      }}
                                    >
                                      {p.barcode}
                                    </div>
                                  )}
                                </td>
                                <td>{p.reference || "-"}</td>
                                <td>{category?.name || "-"}</td>
                                <td>
                                  <span
                                    className={`o-tag o-tag-${p.product_type === "storable" ? "in" : p.product_type === "service" ? "internal" : "out"}`}
                                  >
                                    {
                                      PRODUCT_TYPES.find(
                                        (t) => t.value === p.product_type,
                                      )?.label
                                    }
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {p.quantity_on_hand} {p.uom}
                                </td>
                                <td style={{ color: "var(--green-600)" }}>
                                  {p.quantity_available} {p.uom}
                                </td>
                                <td className="o-monetary">
                                  ${p.sale_price.toFixed(2)}
                                </td>
                                <td className="o-monetary">
                                  ${p.purchase_cost.toFixed(2)}
                                </td>
                                <td
                                  className="o-monetary"
                                  style={{ fontWeight: 600 }}
                                >
                                  ${p.stock_value.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredProducts.length === 0 && (
                            <tr>
                              <td
                                colSpan={10}
                                style={{ textAlign: "center", padding: 40 }}
                              >
                                <button
                                  className="o-btn o-btn-primary"
                                  onClick={startNewProduct}
                                >
                                  + Create Product
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                textAlign: "left",
                                fontWeight: "bold",
                                background: "var(--gray-200)",
                              }}
                            >
                              Totals:
                            </td>
                            <td
                              className="o-monetary"
                              style={{
                                fontWeight: 700,
                                background: "var(--gray-200)",
                              }}
                            >
                              ${productMonetaryTotals.salePrice.toFixed(2)}
                            </td>
                            <td
                              className="o-monetary"
                              style={{
                                fontWeight: 700,
                                background: "var(--gray-200)",
                              }}
                            >
                              ${productMonetaryTotals.purchaseCost.toFixed(2)}
                            </td>
                            <td
                              className="o-monetary"
                              style={{
                                fontWeight: 700,
                                background: "var(--gray-200)",
                              }}
                            >
                              ${productMonetaryTotals.stockValue.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ============= CATEGORIES LIST ============= */}
              {mainView === "categories" && subView === "list" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-list-view">
                    <table className="o-list-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Products</th>
                          <th style={{ width: 160 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategories.map((c) => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 500 }}>{c.name}</td>
                            <td>{categoryProductCounts.get(c.id) ?? 0}</td>
                            <td>
                              <button
                                className="o-btn o-btn-link"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                onClick={() => openCategoryModal(c)}
                              >
                                Edit
                              </button>
                              <button
                                className="o-btn o-btn-link"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  color: "var(--red-500)",
                                }}
                                onClick={() => deleteCategory(c.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredCategories.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              style={{ textAlign: "center", padding: 40 }}
                            >
                              {categories.length === 0 ? (
                                <button
                                  className="o-btn o-btn-primary"
                                  onClick={() => openCategoryModal()}
                                >
                                  + Create Category
                                </button>
                              ) : (
                                <span style={{ color: "var(--muted)" }}>
                                  No categories match your search.
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============= PRODUCTS KANBAN ============= */}
              {mainView === "products" && subView === "kanban" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-kanban">
                    {filteredProducts.map((p) => {
                      const category = categories.find(
                        (c) => c.id === p.category_id,
                      );
                      return (
                        <div
                          key={p.id}
                          className="o-kanban-card"
                          onClick={() => openProduct(p)}
                        >
                          <div className="o-kanban-header">
                            <div>
                              <div className="o-kanban-title">{p.name}</div>
                              <div className="o-kanban-subtitle">
                                {p.reference || p.barcode || "No reference"}
                              </div>
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 700 }}>
                              P
                            </span>
                          </div>
                          <div className="o-kanban-body">
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 8,
                              }}
                            >
                              <span style={{ color: "var(--muted)" }}>
                                On Hand
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                {p.quantity_on_hand} {p.uom}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 8,
                              }}
                            >
                              <span style={{ color: "var(--muted)" }}>
                                Sale Price
                              </span>
                              <span>${p.sale_price.toFixed(2)}</span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: "var(--muted)" }}>
                                Stock Value
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                ${p.stock_value.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="o-kanban-footer">
                            <div className="o-kanban-tags">
                              {category && (
                                <span className="o-tag o-tag-draft">
                                  {category.name}
                                </span>
                              )}
                              <span
                                className={`o-tag o-tag-${p.is_active ? "done" : "cancelled"}`}
                              >
                                {p.is_active ? "Active" : "Archived"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============= PRODUCT FORM ============= */}
              {mainView === "products" && subView === "form" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-form-view">
                    <div className="o-form-sheet">
                      <div
                        style={{
                          display: "flex",
                          gap: 24,
                          marginBottom: 24,
                          alignItems: "flex-start",
                        }}
                      >
                        {/* Product Image */}
                        <div
                          style={{
                            width: 110,
                            height: 110,
                            borderRadius: 10,
                            border: "2px dashed var(--zinc-300, #d4d4d8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            flexShrink: 0,
                            background: productImageUrl
                              ? "transparent"
                              : "var(--gray-50, #f9fafb)",
                            cursor: selectedProductId ? "pointer" : "default",
                            position: "relative",
                          }}
                          onClick={() =>
                            selectedProductId && imageInputRef.current?.click()
                          }
                          title={
                            selectedProductId
                              ? "Click to upload image"
                              : "Save product first to upload image"
                          }
                        >
                          {productImageUrl ? (
                            <>
                              <img
                                src={productImageUrl}
                                alt="Product"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                              {selectedProductId && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "rgba(0,0,0,0.4)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    opacity: 0,
                                    transition: "opacity 0.2s",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.opacity = "1")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.opacity = "0")
                                  }
                                >
                                  <button
                                    className="o-btn"
                                    style={{
                                      background: "#fff",
                                      color: "#333",
                                      fontSize: 11,
                                      padding: "4px 8px",
                                      borderRadius: 4,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      imageInputRef.current?.click();
                                    }}
                                    disabled={uploadingImage}
                                  >
                                    Change
                                  </button>
                                  <button
                                    className="o-btn"
                                    style={{
                                      background: "#ef4444",
                                      color: "#fff",
                                      fontSize: 11,
                                      padding: "4px 8px",
                                      borderRadius: 4,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProductImageDelete();
                                    }}
                                    disabled={uploadingImage}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </>
                          ) : uploadingImage ? (
                            <span
                              style={{ fontSize: 12, color: "var(--gray-400)" }}
                            >
                              Uploading…
                            </span>
                          ) : (
                            <svg
                              width="36"
                              height="36"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--zinc-300)"
                              strokeWidth="1.5"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          )}
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleProductImageUpload}
                          />
                        </div>

                        <div style={{ flex: 1 }}>
                          <input
                            type="text"
                            className="o-form-input"
                            placeholder="Product Name"
                            value={productForm.name}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                name: e.target.value,
                              })
                            }
                            style={{
                              fontSize: 24,
                              fontWeight: 600,
                              border: "none",
                              borderBottom: "2px solid var(--zinc-200)",
                              borderRadius: 0,
                              padding: "8px 0",
                            }}
                          />
                          <div
                            style={{ marginTop: 8, display: "flex", gap: 8 }}
                          >
                            <span
                              className={`o-tag ${productForm.can_be_sold ? "o-tag-done" : "o-tag-draft"}`}
                            >
                              {productForm.can_be_sold
                                ? "Can be Sold"
                                : "Not for Sale"}
                            </span>
                            <span
                              className={`o-tag ${productForm.can_be_purchased ? "o-tag-confirmed" : "o-tag-draft"}`}
                            >
                              {productForm.can_be_purchased
                                ? "Can be Purchased"
                                : "Not for Purchase"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={productForm.can_be_sold}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                can_be_sold: e.target.checked,
                              })
                            }
                          />
                          Can be Sold
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={productForm.can_be_purchased}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                can_be_purchased: e.target.checked,
                              })
                            }
                          />
                          Can be Purchased
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={productForm.is_active}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                is_active: e.target.checked,
                              })
                            }
                          />
                          Active
                        </label>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className={
                            productInfoTab === "general" ? "tab active" : "tab"
                          }
                          onClick={() => setProductInfoTab("general")}
                        >
                          General
                        </button>
                        <button
                          className={
                            productInfoTab === "inventory"
                              ? "tab active"
                              : "tab"
                          }
                          onClick={() => setProductInfoTab("inventory")}
                          disabled={productForm.product_type !== "storable"}
                          style={
                            productForm.product_type !== "storable"
                              ? { opacity: 0.5, cursor: "not-allowed" }
                              : undefined
                          }
                          title={
                            productForm.product_type !== "storable"
                              ? "Inventory is only for storable products"
                              : undefined
                          }
                        >
                          Inventory
                        </button>
                        <button
                          className={
                            productInfoTab === "description"
                              ? "tab active"
                              : "tab"
                          }
                          onClick={() => setProductInfoTab("description")}
                        >
                          Description
                        </button>
                      </div>

                      {productInfoTab === "general" && (
                        <>
                          <div className="o-group-separator">
                            <div className="o-group-separator-line" />
                            <span className="o-group-separator-text">
                              General Information
                            </span>
                            <div className="o-group-separator-line" />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 24,
                            }}
                          >
                            <div>
                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Product Type
                                </label>
                                <div className="o-form-field">
                                  <select
                                    className="o-form-select"
                                    value={productForm.product_type}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        product_type: e.target.value,
                                      })
                                    }
                                  >
                                    {PRODUCT_TYPES.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">Category</label>
                                <div className="o-form-field">
                                  <select
                                    className="o-form-select"
                                    value={productForm.category_id ?? ""}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        category_id: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      })
                                    }
                                  >
                                    <option value="">No category</option>
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Product Code
                                </label>
                                <div className="o-form-field">
                                  <input
                                    type="text"
                                    className="o-form-input"
                                    value={productForm.reference}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        reference: e.target.value,
                                      })
                                    }
                                    placeholder="e.g., PROD-001"
                                  />
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">Barcode</label>
                                <div className="o-form-field">
                                  <input
                                    type="text"
                                    className="o-form-input"
                                    value={productForm.barcode}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        barcode: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Sales Price
                                </label>
                                <div className="o-form-field">
                                  <input
                                    type="number"
                                    className="o-form-input"
                                    value={productForm.sale_price}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        sale_price: Number(e.target.value),
                                      })
                                    }
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Sales Cost
                                </label>
                                <div className="o-form-field">
                                  <input
                                    type="number"
                                    className="o-form-input"
                                    value={productForm.sales_cost}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        sales_cost: Number(e.target.value),
                                      })
                                    }
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Purchase Cost
                                </label>
                                <div className="o-form-field">
                                  <input
                                    type="number"
                                    className="o-form-input"
                                    value={productForm.purchase_cost}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        purchase_cost: Number(e.target.value),
                                      })
                                    }
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  ZIMRA Tax
                                </label>
                                <div className="o-form-field">
                                  <select
                                    className="o-form-select"
                                    value={productForm.tax_id ?? ""}
                                    onChange={(e) => {
                                      const tid = e.target.value
                                        ? Number(e.target.value)
                                        : null;
                                      const matched = taxSettings.find(
                                        (t) => t.id === tid,
                                      );
                                      setProductForm({
                                        ...productForm,
                                        tax_id: tid,
                                        tax_rate: matched
                                          ? matched.rate
                                          : productForm.tax_rate,
                                      });
                                    }}
                                  >
                                    <option value="">— Manual rate —</option>
                                    {taxSettings
                                      .filter((t) => t.is_active)
                                      .map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name} ({t.rate}%)
                                          {t.is_zimra_tax && t.zimra_tax_id
                                            ? ` [ZIMRA ID: ${t.zimra_tax_id}]`
                                            : ""}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Tax Rate (%)
                                </label>
                                <div className="o-form-field">
                                  <input
                                    type="number"
                                    className="o-form-input"
                                    value={productForm.tax_rate}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        tax_rate: Number(e.target.value),
                                      })
                                    }
                                    step="0.1"
                                    min="0"
                                    disabled={!!productForm.tax_id}
                                  />
                                </div>
                              </div>

                              <div className="o-form-group">
                                <label className="o-form-label">
                                  Unit of Measure
                                </label>
                                <div className="o-form-field">
                                  <select
                                    className="o-form-select"
                                    value={productForm.uom}
                                    onChange={(e) =>
                                      setProductForm({
                                        ...productForm,
                                        uom: e.target.value,
                                      })
                                    }
                                  >
                                    {UOMS.map((u) => (
                                      <option key={u.value} value={u.value}>
                                        {u.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {productInfoTab === "inventory" &&
                        productForm.product_type === "storable" && (
                          <>
                            <div className="o-group-separator">
                              <div className="o-group-separator-line" />
                              <span className="o-group-separator-text">
                                Inventory
                              </span>
                              <div className="o-group-separator-line" />
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 24,
                              }}
                            >
                              <div>
                                <div className="o-form-group">
                                  <label className="o-form-label">
                                    Reorder Point
                                  </label>
                                  <div className="o-form-field">
                                    <input
                                      type="number"
                                      className="o-form-input"
                                      value={productForm.reorder_point}
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          reorder_point: Number(e.target.value),
                                        })
                                      }
                                      min="0"
                                    />
                                  </div>
                                </div>
                                <div className="o-form-group">
                                  <label className="o-form-label">
                                    Maximum Stock
                                  </label>
                                  <div className="o-form-field">
                                    <input
                                      type="number"
                                      className="o-form-input"
                                      value={productForm.max_stock_quantity}
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          max_stock_quantity: Number(
                                            e.target.value,
                                          ),
                                        })
                                      }
                                      min="0"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <div className="o-form-group">
                                  <label className="o-form-label">
                                    Minimum Stock
                                  </label>
                                  <div className="o-form-field">
                                    <input
                                      type="number"
                                      className="o-form-input"
                                      value={productForm.min_stock_quantity}
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          min_stock_quantity: Number(
                                            e.target.value,
                                          ),
                                        })
                                      }
                                      min="0"
                                    />
                                  </div>
                                </div>
                                <div className="o-form-group">
                                  <label className="o-form-label">
                                    Track Inventory
                                  </label>
                                  <div className="o-form-field">
                                    <select
                                      className="o-form-select"
                                      value={
                                        productForm.track_inventory
                                          ? "yes"
                                          : "no"
                                      }
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          track_inventory:
                                            e.target.value === "yes",
                                        })
                                      }
                                    >
                                      <option value="yes">Yes</option>
                                      <option value="no">No</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 24,
                                marginTop: 16,
                              }}
                            >
                              <div>
                                <div className="o-form-group">
                                  <label className="o-form-label">Weight</label>
                                  <div className="o-form-field">
                                    <input
                                      type="number"
                                      className="o-form-input"
                                      value={productForm.weight}
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          weight: Number(e.target.value),
                                        })
                                      }
                                      step="0.01"
                                      min="0"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <div className="o-form-group">
                                  <label className="o-form-label">
                                    Weight UOM
                                  </label>
                                  <div className="o-form-field">
                                    <input
                                      type="text"
                                      className="o-form-input"
                                      value={productForm.weight_uom}
                                      onChange={(e) =>
                                        setProductForm({
                                          ...productForm,
                                          weight_uom: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                      {productInfoTab === "description" && (
                        <>
                          <div className="o-group-separator">
                            <div className="o-group-separator-line" />
                            <span className="o-group-separator-text">
                              Description
                            </span>
                            <div className="o-group-separator-line" />
                          </div>

                          <textarea
                            className="o-form-textarea"
                            rows={4}
                            value={productForm.description}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                description: e.target.value,
                              })
                            }
                            placeholder="Product description..."
                            style={{ width: "100%" }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============= WAREHOUSES LIST ============= */}
              {mainView === "warehouses" && subView === "list" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div style={{ padding: 24 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(350px, 1fr))",
                        gap: 20,
                      }}
                    >
                      {warehouses.map((w) => {
                        const locs = warehouseLocations(w.id);
                        const warehouseQuants = stockQuants.filter(
                          (q) => q.warehouse_id === w.id,
                        );
                        const totalValue = warehouseQuants.reduce(
                          (sum, q) => sum + q.total_value,
                          0,
                        );
                        const totalItems = warehouseQuants.reduce(
                          (sum, q) => sum + q.quantity,
                          0,
                        );

                        return (
                          <div
                            key={w.id}
                            className="o-form-sheet"
                            style={{ cursor: "pointer" }}
                            onClick={() => openWarehouse(w)}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 16,
                              }}
                            >
                              <div>
                                <h3 style={{ margin: 0, fontSize: 18 }}>
                                  {w.name}
                                </h3>
                                <div
                                  style={{
                                    color: "var(--muted)",
                                    fontSize: 13,
                                  }}
                                >
                                  {w.code}
                                </div>
                              </div>
                              <button
                                className="o-btn o-btn-secondary o-btn-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLocationId(null);
                                  setLocationForm({
                                    warehouse_id: w.id,
                                    name: "",
                                    code: "",
                                    is_primary: false,
                                  });
                                  setShowLocationModal(true);
                                }}
                              >
                                +
                              </button>
                            </div>

                            {w.address && (
                              <div
                                style={{
                                  color: "var(--muted)",
                                  fontSize: 13,
                                  marginBottom: 16,
                                }}
                              >
                                {w.address}
                              </div>
                            )}

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 12,
                                marginBottom: 16,
                              }}
                            >
                              <div
                                style={{
                                  background: "var(--gray-50)",
                                  padding: 12,
                                  borderRadius: 4,
                                  textAlign: "center",
                                }}
                              >
                                <div style={{ fontSize: 20, fontWeight: 600 }}>
                                  {locs.length}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--muted)",
                                  }}
                                >
                                  Locations
                                </div>
                              </div>
                              <div
                                style={{
                                  background: "var(--gray-50)",
                                  padding: 12,
                                  borderRadius: 4,
                                  textAlign: "center",
                                }}
                              >
                                <div style={{ fontSize: 20, fontWeight: 600 }}>
                                  {totalItems}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--muted)",
                                  }}
                                >
                                  Items
                                </div>
                              </div>
                              <div
                                style={{
                                  background: "var(--gray-50)",
                                  padding: 12,
                                  borderRadius: 4,
                                  textAlign: "center",
                                }}
                              >
                                <div style={{ fontSize: 20, fontWeight: 600 }}>
                                  ${totalValue.toFixed(0)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--muted)",
                                  }}
                                >
                                  Value
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                borderTop: "1px solid var(--zinc-200)",
                                paddingTop: 12,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--muted)",
                                  marginBottom: 8,
                                }}
                              >
                                LOCATIONS
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {locs.slice(0, 5).map((l) => (
                                  <span
                                    key={l.id}
                                    className={`o-tag ${l.is_primary ? "o-tag-done" : "o-tag-draft"}`}
                                  >
                                    {l.name}
                                  </span>
                                ))}
                                {locs.length > 5 && (
                                  <span className="o-tag o-tag-draft">
                                    +{locs.length - 5} more
                                  </span>
                                )}
                                {locs.length === 0 && (
                                  <span
                                    style={{
                                      color: "var(--muted)",
                                      fontSize: 13,
                                    }}
                                  >
                                    No locations
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {warehouses.length === 0 && (
                        <div
                          style={{
                            gridColumn: "1 / -1",
                            textAlign: "center",
                            padding: 60,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 700,
                              color: "var(--blue-600)",
                              marginBottom: 16,
                            }}
                          >
                            WH
                          </div>
                          <h3 style={{ margin: "0 0 8px 0" }}>
                            No Warehouses Yet
                          </h3>
                          <p
                            style={{ color: "var(--muted)", marginBottom: 16 }}
                          >
                            Create your first warehouse to start managing
                            inventory
                          </p>
                          <button
                            className="o-btn o-btn-primary"
                            onClick={startNewWarehouse}
                          >
                            + Create Warehouse
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============= WAREHOUSE FORM ============= */}
              {mainView === "warehouses" && subView === "form" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-form-view">
                    <div className="o-form-sheet">
                      <div
                        style={{ display: "flex", gap: 24, marginBottom: 24 }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            background: "var(--gray-50)",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            fontWeight: 700,
                            color: "var(--blue-600)",
                          }}
                        >
                          WH
                        </div>
                        <div style={{ flex: 1 }}>
                          <input
                            type="text"
                            className="o-form-input"
                            placeholder="Warehouse Name"
                            value={warehouseForm.name}
                            onChange={(e) =>
                              setWarehouseForm({
                                ...warehouseForm,
                                name: e.target.value,
                              })
                            }
                            style={{
                              fontSize: 24,
                              fontWeight: 600,
                              border: "none",
                              borderBottom: "2px solid var(--zinc-200)",
                              borderRadius: 0,
                              padding: "8px 0",
                            }}
                          />
                        </div>
                      </div>

                      <div className="o-form-group">
                        <label className="o-form-label">Short Code</label>
                        <div className="o-form-field">
                          <input
                            type="text"
                            className="o-form-input"
                            value={warehouseForm.code}
                            onChange={(e) =>
                              setWarehouseForm({
                                ...warehouseForm,
                                code: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="e.g., WH01"
                            style={{ maxWidth: 200 }}
                          />
                        </div>
                      </div>

                      <div className="o-form-group">
                        <label className="o-form-label">Address</label>
                        <div
                          className="o-form-field"
                          style={{ maxWidth: "100%" }}
                        >
                          <textarea
                            className="o-form-textarea"
                            value={warehouseForm.address}
                            onChange={(e) =>
                              setWarehouseForm({
                                ...warehouseForm,
                                address: e.target.value,
                              })
                            }
                            rows={3}
                            placeholder="Warehouse address..."
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>

                      {selectedWarehouseId && !isNew && (
                        <>
                          <div className="o-group-separator">
                            <div className="o-group-separator-line" />
                            <span className="o-group-separator-text">
                              Locations
                            </span>
                            <div className="o-group-separator-line" />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              Warehouse Locations
                            </span>
                            <button
                              className="o-btn o-btn-secondary"
                              onClick={() => {
                                setSelectedLocationId(null);
                                setLocationForm({
                                  warehouse_id: selectedWarehouseId,
                                  name: "",
                                  code: "",
                                  is_primary: false,
                                });
                                setShowLocationModal(true);
                              }}
                            >
                              + Add Location
                            </button>
                          </div>

                          <div className="o-inline-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Code</th>
                                  <th>Primary</th>
                                  <th style={{ width: 120 }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {warehouseLocations(selectedWarehouseId).map(
                                  (l) => (
                                    <tr key={l.id}>
                                      <td>{l.name}</td>
                                      <td>{l.code}</td>
                                      <td>{l.is_primary ? "Yes" : ""}</td>
                                      <td>
                                        <button
                                          className="o-btn o-btn-link"
                                          style={{
                                            padding: "4px 8px",
                                            fontSize: 12,
                                          }}
                                          onClick={() => openLocationModal(l)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="o-btn o-btn-link"
                                          style={{
                                            padding: "4px 8px",
                                            fontSize: 12,
                                            color: "var(--red-500)",
                                          }}
                                          onClick={() => deleteLocation(l.id)}
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  ),
                                )}
                                {warehouseLocations(selectedWarehouseId)
                                  .length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      style={{
                                        textAlign: "center",
                                        color: "var(--muted)",
                                      }}
                                    >
                                      No locations yet
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============= OPERATIONS ============= */}
              {mainView === "operations" && subView === "list" && (
                <>
                  {/* Sidebar */}
                  <div className="o-sidebar">
                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title">Status</div>
                      {["all", ...STATES.map((s) => s.value)].map((state) => (
                        <div
                          key={state}
                          className={`o-sidebar-item ${filterState === state ? "active" : ""}`}
                          onClick={() => setFilterState(state)}
                        >
                          <span>
                            {state === "all"
                              ? "All"
                              : STATES.find((s) => s.value === state)?.label}
                          </span>
                          <span className="o-sidebar-count">
                            {state === "all"
                              ? stockMoves.length
                              : stockMoves.filter((m) => m.state === state)
                                  .length}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title">Operation Type</div>
                      {MOVE_TYPES.map((t) => (
                        <div key={t.value} className="o-sidebar-item">
                          <span>{t.label}</span>
                          <span className="o-sidebar-count">
                            {
                              stockMoves.filter((m) => m.move_type === t.value)
                                .length
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="o-main">
                    {operationsTab === "moves" && (
                      <div className="o-list-view">
                        <table className="o-list-table">
                          <thead>
                            <tr>
                              <th>Reference</th>
                              <th>Product</th>
                              <th>Type</th>
                              <th>Warehouse</th>
                              <th>Quantity</th>
                              <th className="text-end">Unit Cost</th>
                              <th className="text-end">Total</th>
                              <th>Status</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMoves.map((m) => {
                              const product = products.find(
                                (p) => p.id === m.product_id,
                              );
                              const warehouse = warehouses.find(
                                (w) => w.id === m.warehouse_id,
                              );
                              const moveType = MOVE_TYPES.find(
                                (t) => t.value === m.move_type,
                              );
                              return (
                                <tr
                                  key={m.id}
                                  onDoubleClick={() => openMove(m)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <td>
                                    <span
                                      style={{
                                        color: "var(--blue-600)",
                                        fontWeight: 500,
                                        cursor: "pointer",
                                      }}
                                      onClick={() => openMove(m)}
                                    >
                                      {m.reference ||
                                        `WH/MOV/${String(m.id).padStart(5, "0")}`}
                                    </span>
                                  </td>
                                  <td>{product?.name || "-"}</td>
                                  <td>
                                    <span
                                      className={`o-tag o-tag-${m.move_type}`}
                                    >
                                      {moveType?.label}
                                    </span>
                                  </td>
                                  <td>{warehouse?.name || "-"}</td>
                                  <td style={{ fontWeight: 600 }}>
                                    {m.quantity}{" "}
                                    {(product?.uom === "PCS"
                                      ? "Units"
                                      : product?.uom) || "Units"}
                                  </td>
                                  <td className="o-monetary">
                                    ${m.unit_cost.toFixed(2)}
                                  </td>
                                  <td
                                    className="o-monetary"
                                    style={{ fontWeight: 600 }}
                                  >
                                    ${m.total_cost.toFixed(2)}
                                  </td>
                                  <td>
                                    <span className={`o-tag o-tag-${m.state}`}>
                                      {
                                        STATES.find((s) => s.value === m.state)
                                          ?.label
                                      }
                                    </span>
                                  </td>
                                  <td>
                                    {m.state === "draft" && (
                                      <div
                                        className="o-quick-actions"
                                        style={{ opacity: 1 }}
                                      >
                                        <button
                                          className="o-btn o-btn-success o-btn-icon"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            confirmMove(m.id);
                                          }}
                                          title="Validate"
                                        >
                                          OK
                                        </button>
                                        <button
                                          className="o-btn o-btn-danger o-btn-icon"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            cancelMove(m.id);
                                          }}
                                          title="Cancel"
                                        >
                                          X
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredMoves.length === 0 && (
                              <tr>
                                <td
                                  colSpan={9}
                                  style={{ textAlign: "center", padding: 40 }}
                                >
                                  <div
                                    style={{
                                      color: "var(--muted)",
                                      marginBottom: 16,
                                    }}
                                  >
                                    No stock moves found
                                  </div>
                                  <button
                                    className="o-btn o-btn-primary"
                                    onClick={() => startNewMove("in")}
                                  >
                                    + Create Stock Move
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {operationsTab === "quants" && (
                      <div className="o-list-view">
                        <table className="o-list-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Warehouse</th>
                              <th>Location</th>
                              <th>On Hand</th>
                              <th>Reserved</th>
                              <th>Available</th>
                              <th>Unit Cost</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockQuants.map((q) => {
                              const product = products.find(
                                (p) => p.id === q.product_id,
                              );
                              const warehouse = warehouses.find(
                                (w) => w.id === q.warehouse_id,
                              );
                              const location = locations.find(
                                (l) => l.id === q.location_id,
                              );
                              return (
                                <tr key={q.id}>
                                  <td style={{ fontWeight: 500 }}>
                                    {product?.name || "-"}
                                  </td>
                                  <td>{warehouse?.name || "-"}</td>
                                  <td>{location?.name || "-"}</td>
                                  <td style={{ fontWeight: 600 }}>
                                    {q.quantity}
                                  </td>
                                  <td
                                    style={{
                                      color:
                                        q.reserved_quantity > 0
                                          ? "var(--red-500)"
                                          : "inherit",
                                    }}
                                  >
                                    {q.reserved_quantity}
                                  </td>
                                  <td
                                    style={{
                                      color: "var(--green-600)",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {q.available_quantity}
                                  </td>
                                  <td className="o-monetary">
                                    ${q.unit_cost.toFixed(2)}
                                  </td>
                                  <td
                                    className="o-monetary"
                                    style={{ fontWeight: 600 }}
                                  >
                                    ${q.total_value.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                            {stockQuants.length === 0 && (
                              <tr>
                                <td
                                  colSpan={8}
                                  style={{
                                    textAlign: "center",
                                    padding: 40,
                                    color: "var(--muted)",
                                  }}
                                >
                                  No stock on hand. Validate stock moves to
                                  update quantities.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ============= STOCK MOVE FORM ============= */}
              {mainView === "operations" && subView === "form" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-form-view">
                    {/* Status Bar */}
                    {selectedMove && !isNew && (
                      <div className="o-statusbar" style={{ marginBottom: 24 }}>
                        {STATES.map((s, i) => (
                          <div
                            key={s.value}
                            className={`o-statusbar-item ${
                              selectedMove.state === s.value
                                ? "active"
                                : STATES.findIndex(
                                      (st) => st.value === selectedMove.state,
                                    ) > i
                                  ? "done"
                                  : ""
                            }`}
                          >
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {selectedMove &&
                      selectedMove.state === "draft" &&
                      !isNew && (
                        <div
                          style={{ marginBottom: 24, display: "flex", gap: 8 }}
                        >
                          <button
                            className="o-btn o-btn-success"
                            onClick={() => confirmMove(selectedMove.id)}
                          >
                            Validate
                          </button>
                          <button
                            className="o-btn o-btn-secondary"
                            onClick={() => cancelMove(selectedMove.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                    <div className="o-form-sheet">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 24,
                        }}
                      >
                        <div>
                          <div className="o-form-group">
                            <label className="o-form-label">Product</label>
                            <div className="o-form-field">
                              <select
                                className="o-form-select"
                                value={moveForm.product_id ?? ""}
                                onChange={(e) => {
                                  const prod = products.find(
                                    (p) => p.id === Number(e.target.value),
                                  );
                                  setMoveForm({
                                    ...moveForm,
                                    product_id: Number(e.target.value),
                                    unit_cost: prod?.purchase_cost || 0,
                                  });
                                }}
                                disabled={selectedMove?.state === "done"}
                              >
                                <option value="">Select a product...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">
                              Operation Type
                            </label>
                            <div className="o-form-field">
                              <select
                                className="o-form-select"
                                value={moveForm.move_type}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    move_type: e.target.value,
                                  })
                                }
                                disabled={selectedMove?.state === "done"}
                              >
                                {MOVE_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">Warehouse</label>
                            <div className="o-form-field">
                              <select
                                className="o-form-select"
                                value={moveForm.warehouse_id ?? ""}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    warehouse_id: Number(e.target.value),
                                    location_id: null,
                                  })
                                }
                                disabled={selectedMove?.state === "done"}
                              >
                                <option value="">Select a warehouse...</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">Location</label>
                            <div className="o-form-field">
                              <select
                                className="o-form-select"
                                value={moveForm.location_id ?? ""}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    location_id: Number(e.target.value),
                                  })
                                }
                                disabled={selectedMove?.state === "done"}
                              >
                                <option value="">Select a location...</option>
                                {locations
                                  .filter(
                                    (l) =>
                                      !moveForm.warehouse_id ||
                                      l.warehouse_id === moveForm.warehouse_id,
                                  )
                                  .map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="o-form-group">
                            <label className="o-form-label">Quantity</label>
                            <div className="o-form-field">
                              <input
                                type="number"
                                className="o-form-input"
                                value={moveForm.quantity}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    quantity: Number(e.target.value),
                                  })
                                }
                                min="0"
                                disabled={selectedMove?.state === "done"}
                              />
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">Unit Cost</label>
                            <div className="o-form-field">
                              <input
                                type="number"
                                className="o-form-input"
                                value={moveForm.unit_cost}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    unit_cost: Number(e.target.value),
                                  })
                                }
                                step="0.01"
                                min="0"
                                disabled={selectedMove?.state === "done"}
                              />
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">Total Cost</label>
                            <div className="o-form-field">
                              <span
                                style={{
                                  padding: "8px 0",
                                  display: "block",
                                  fontWeight: 600,
                                  fontSize: 18,
                                }}
                              >
                                $
                                {(
                                  moveForm.quantity * moveForm.unit_cost
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">Reference</label>
                            <div className="o-form-field">
                              <input
                                type="text"
                                className="o-form-input"
                                value={moveForm.reference}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    reference: e.target.value,
                                  })
                                }
                                placeholder="e.g., WH/IN/00001"
                                disabled={selectedMove?.state === "done"}
                              />
                            </div>
                          </div>

                          <div className="o-form-group">
                            <label className="o-form-label">
                              Source Document
                            </label>
                            <div className="o-form-field">
                              <input
                                type="text"
                                className="o-form-input"
                                value={moveForm.source_document}
                                onChange={(e) =>
                                  setMoveForm({
                                    ...moveForm,
                                    source_document: e.target.value,
                                  })
                                }
                                placeholder="e.g., PO-00001"
                                disabled={selectedMove?.state === "done"}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="o-group-separator"
                        style={{ marginTop: 24 }}
                      >
                        <div className="o-group-separator-line" />
                        <span className="o-group-separator-text">Notes</span>
                        <div className="o-group-separator-line" />
                      </div>

                      <textarea
                        className="o-form-textarea"
                        rows={4}
                        value={moveForm.notes}
                        onChange={(e) =>
                          setMoveForm({ ...moveForm, notes: e.target.value })
                        }
                        placeholder="Internal notes..."
                        style={{ width: "100%" }}
                        disabled={selectedMove?.state === "done"}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============= MODALS ============= */}

            {/* Category Modal */}
            {showCategoryModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    background: "var(--white-500)",
                    borderRadius: 8,
                    padding: 24,
                    width: 400,
                  }}
                >
                  <h3 style={{ margin: "0 0 16px 0" }}>
                    {selectedCategoryId ? "Edit Category" : "New Category"}
                  </h3>
                  <div className="o-form-group">
                    <label className="o-form-label">Name</label>
                    <div className="o-form-field">
                      <input
                        type="text"
                        className="o-form-input"
                        value={categoryForm.name}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            name: e.target.value,
                          })
                        }
                        autoFocus
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      marginTop: 24,
                    }}
                  >
                    <button
                      className="o-btn o-btn-secondary"
                      onClick={() => {
                        setShowCategoryModal(false);
                        setSelectedCategoryId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="o-btn o-btn-primary"
                      onClick={saveCategory}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : selectedCategoryId
                          ? "Save"
                          : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Location Modal */}
            {showLocationModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    background: "var(--white-500)",
                    borderRadius: 8,
                    padding: 24,
                    width: 400,
                  }}
                >
                  <h3 style={{ margin: "0 0 16px 0" }}>
                    {selectedLocationId ? "Edit Location" : "New Location"}
                  </h3>
                  <div className="o-form-group">
                    <label className="o-form-label">Warehouse</label>
                    <div className="o-form-field">
                      <select
                        className="o-form-select"
                        value={locationForm.warehouse_id ?? ""}
                        onChange={(e) =>
                          setLocationForm({
                            ...locationForm,
                            warehouse_id: Number(e.target.value),
                          })
                        }
                        disabled={!!selectedLocationId}
                      >
                        <option value="">Select warehouse...</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="o-form-group">
                    <label className="o-form-label">Name</label>
                    <div className="o-form-field">
                      <input
                        type="text"
                        className="o-form-input"
                        value={locationForm.name}
                        onChange={(e) =>
                          setLocationForm({
                            ...locationForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="e.g., Shelf A-1"
                      />
                    </div>
                  </div>
                  <div className="o-form-group">
                    <label className="o-form-label">Code</label>
                    <div className="o-form-field">
                      <input
                        type="text"
                        className="o-form-input"
                        value={locationForm.code}
                        onChange={(e) =>
                          setLocationForm({
                            ...locationForm,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      marginTop: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={locationForm.is_primary}
                      onChange={(e) =>
                        setLocationForm({
                          ...locationForm,
                          is_primary: e.target.checked,
                        })
                      }
                    />
                    Primary Location
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      marginTop: 24,
                    }}
                  >
                    <button
                      className="o-btn o-btn-secondary"
                      onClick={() => {
                        setShowLocationModal(false);
                        setSelectedLocationId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="o-btn o-btn-primary"
                      onClick={saveLocation}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : selectedLocationId
                          ? "Save"
                          : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
