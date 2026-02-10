import { useEffect, useState } from "react";
import { apiFetch } from "../api";
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
  sale_price: number;
  tax_rate: number;
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

type MainView = "overview" | "products" | "warehouses" | "operations" | "reporting";
type SubView = "list" | "kanban" | "form";

export default function InventoryPage() {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [mainView, setMainView] = useState<MainView>("overview");
  const [subView, setSubView] = useState<SubView>("list");

  // Data states
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [stockQuants, setStockQuants] = useState<StockQuant[]>([]);

  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "" });

  // Operations sub-tab
  const [operationsTab, setOperationsTab] = useState<"moves" | "quants">("moves");
  const [filterState, setFilterState] = useState<string>("all");

  // ============= EFFECTS =============
  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

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
      const [prods, cats, whs, moves, quants] = await Promise.all([
        apiFetch<ProductWithStock[]>(`/products/with-stock?company_id=${companyId}`),
        apiFetch<Category[]>(`/categories?company_id=${companyId}`),
        apiFetch<Warehouse[]>(`/warehouses?company_id=${companyId}`),
        apiFetch<StockMove[]>(`/stock/moves?company_id=${companyId}`),
        apiFetch<StockQuant[]>(`/stock/quants?company_id=${companyId}`),
      ]);
      console.log("loadAllData results:", { prods: prods.length, cats: cats.length, whs: whs.length, moves: moves.length, quants: quants.length });
      console.log("Warehouses loaded:", whs);
      setProducts(prods);
      setCategories(cats);
      setWarehouses(whs);
      setStockMoves(moves);
      setStockQuants(quants);
      
      // Load locations for all warehouses
      if (whs.length) {
        const allLocs = await Promise.all(
          whs.map(w => apiFetch<Location[]>(`/locations?warehouse_id=${w.id}`))
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
    console.log("saveWarehouse called", { companyId, warehouseForm, selectedWarehouseId, isNew });
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
      alert("Error saving warehouse: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (warehouseId: number) => {
    if (!confirm("Are you sure you want to delete this warehouse? This will also delete all its locations.")) return;
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
      setLocationForm({ warehouse_id: warehouses[0]?.id ?? null, name: "", code: "", is_primary: false });
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
      setLocationForm({ warehouse_id: null, name: "", code: "", is_primary: false });
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
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);
  const selectedMove = stockMoves.find(m => m.id === selectedMoveId);

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || 
           p.reference?.toLowerCase().includes(q) ||
           p.barcode?.toLowerCase().includes(q);
  });

  const filteredMoves = stockMoves.filter(m => {
    if (filterState !== "all" && m.state !== filterState) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const product = products.find(p => p.id === m.product_id);
    return m.reference?.toLowerCase().includes(q) ||
           product?.name.toLowerCase().includes(q);
  });

  // Stats
  const stats = {
    totalProducts: products.length,
    lowStock: products.filter(p => p.quantity_on_hand <= p.reorder_point && p.track_inventory).length,
    totalWarehouses: warehouses.length,
    totalLocations: locations.length,
    pendingMoves: stockMoves.filter(m => m.state === "draft").length,
    totalStockValue: stockQuants.reduce((sum, q) => sum + q.total_value, 0),
  };

  const warehouseLocations = (warehouseId: number) => 
    locations.filter(l => l.warehouse_id === warehouseId);

  // ============= RENDER =============
  return (
    <div className="page-container">
      {/* Top Navigation Bar - Odoo Style */}
      <div className="o-control-panel">
        <div className="o-control-panel-left">
          <div className="o-breadcrumb">
            <span className="o-breadcrumb-current" style={{ fontSize: 18, fontWeight: 600 }}>
              Inventory
            </span>
          </div>
          
          {/* Main Menu Tabs */}
          <div style={{ display: "flex", gap: 4, marginLeft: 24 }}>
            {[
              { key: "overview", label: "Overview" },
              { key: "products", label: "Products" },
              { key: "warehouses", label: "Warehouses" },
              { key: "operations", label: "Operations" },
            ].map(tab => (
              <button
                key={tab.key}
                className={`o-btn ${mainView === tab.key ? "o-btn-primary" : "o-btn-secondary"}`}
                onClick={() => { setMainView(tab.key as MainView); setSubView("list"); setSearchQuery(""); }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="o-control-panel-right">
          <select
            className="o-form-select"
            style={{ width: 180 }}
            value={companyId ?? ""}
            onChange={(e) => setCompanyId(Number(e.target.value))}
          >
            {companies.map((c: Company) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub Control Panel */}
      {subView !== "form" && mainView !== "overview" && (
        <div className="o-control-panel" style={{ background: "#f8f9fa", marginTop: -8 }}>
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
              <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
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

            {mainView === "products" && (
              <>
                <button className="o-btn o-btn-secondary" onClick={() => openCategoryModal()}>
                  + Category
                </button>
                <button className="o-btn o-btn-primary" onClick={startNewProduct}>
                  + New Product
                </button>
              </>
            )}

            {mainView === "warehouses" && (
              <button className="o-btn o-btn-primary" onClick={startNewWarehouse}>
                + New Warehouse
              </button>
            )}

            {mainView === "operations" && operationsTab === "moves" && (
              <div style={{ display: "flex", gap: 8 }}>
                {MOVE_TYPES.map(t => (
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

      {/* Form Sub Control Panel */}
      {subView === "form" && (
        <div className="o-control-panel" style={{ background: "#f8f9fa", marginTop: -8 }}>
          <div className="o-control-panel-left">
            <button className="o-btn o-btn-link" onClick={goBack}>
              ← Back to List
            </button>
            <span style={{ fontWeight: 600, marginLeft: 16 }}>
              {mainView === "products" && (isNew ? "New Product" : selectedProduct?.name)}
              {mainView === "warehouses" && (isNew ? "New Warehouse" : selectedWarehouse?.name)}
              {mainView === "operations" && (isNew ? "New Stock Move" : selectedMove?.reference || `Move #${selectedMoveId}`)}
            </span>
          </div>
          <div className="o-control-panel-right">
            <button className="o-btn o-btn-primary" onClick={() => {
              if (mainView === "products") saveProduct();
              else if (mainView === "warehouses") saveWarehouse();
              else if (mainView === "operations") saveMove();
            }} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            {!isNew && (
              <button 
                className="o-btn" 
                style={{ background: "#dc3545", color: "#fff" }}
                onClick={() => {
                  if (mainView === "products" && selectedProductId) deleteProduct(selectedProductId);
                  else if (mainView === "warehouses" && selectedWarehouseId) deleteWarehouse(selectedWarehouseId);
                }} 
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button className="o-btn o-btn-secondary" onClick={goBack}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="o-content">
        
        {/* ============= OVERVIEW ============= */}
        {mainView === "overview" && (
          <div style={{ padding: 20, width: "100%", overflow: "auto" }}>
            {/* Stats Row */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(5, 1fr)", 
              gap: 1, 
              background: "#dee2e6", 
              borderRadius: 8, 
              overflow: "hidden",
              marginBottom: 20 
            }}>
              <div style={{ background: "#fff", padding: "16px 20px", cursor: "pointer", textAlign: "center" }} onClick={() => setMainView("products")}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>{stats.totalProducts}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>Products</div>
              </div>
              <div style={{ background: stats.lowStock > 0 ? "#fff3cd" : "#fff", padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: stats.lowStock > 0 ? "#856404" : "#2563eb" }}>{stats.lowStock}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>Low Stock</div>
              </div>
              <div style={{ background: "#fff", padding: "16px 20px", cursor: "pointer", textAlign: "center" }} onClick={() => setMainView("warehouses")}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>{stats.totalWarehouses}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>Warehouses</div>
              </div>
              <div style={{ background: "#fff", padding: "16px 20px", cursor: "pointer", textAlign: "center" }} onClick={() => setMainView("operations")}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>{stats.pendingMoves}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>Pending Moves</div>
              </div>
              <div style={{ background: "#fff", padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>${stats.totalStockValue.toFixed(2)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>Stock Value</div>
              </div>
            </div>

            {/* Three Column Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Quick Actions */}
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8, padding: 20 }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>Quick Actions</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {MOVE_TYPES.map(t => (
                    <button
                      key={t.value}
                      className="o-btn o-btn-secondary"
                      style={{ justifyContent: "flex-start", padding: "12px 16px", fontSize: 13 }}
                      onClick={() => { setMainView("operations"); startNewMove(t.value); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8, padding: 20 }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>Recent Stock Moves</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stockMoves.slice(0, 5).map(m => {
                    const product = products.find(p => p.id === m.product_id);
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8f9fa", borderRadius: 4, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{m.reference || `MOV/${String(m.id).padStart(5, "0")}`}</span>
                          <span style={{ color: "#6c757d", marginLeft: 8 }}>{product?.name}</span>
                        </div>
                        <span className={`o-tag o-tag-${m.state}`}>
                          {STATES.find(s => s.value === m.state)?.label}
                        </span>
                      </div>
                    );
                  })}
                  {stockMoves.length === 0 && (
                    <div style={{ color: "#6c757d", textAlign: "center", padding: 20, fontSize: 13 }}>
                      No stock moves yet
                    </div>
                  )}
                </div>
              </div>

              {/* Low Stock Alert */}
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8, padding: 20 }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "#856404" }}>Low Stock Products</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {products.filter(p => p.quantity_on_hand <= p.reorder_point && p.track_inventory).slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fff3cd", borderRadius: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: "#856404" }}>
                        {p.quantity_on_hand} / {p.reorder_point} {p.uom}
                      </span>
                    </div>
                  ))}
                  {stats.lowStock === 0 && (
                    <div style={{ color: "#6c757d", textAlign: "center", padding: 20, fontSize: 13 }}>
                      All products have sufficient stock
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Warehouses Summary - Full Width */}
            <div style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8, padding: 20 }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>Warehouses</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {warehouses.map(w => (
                  <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8f9fa", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                    onClick={() => { setMainView("warehouses"); openWarehouse(w); }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{w.name}</span>
                      <span style={{ color: "#6c757d", marginLeft: 8 }}>({w.code})</span>
                    </div>
                    <span style={{ color: "#6c757d" }}>
                      {warehouseLocations(w.id).length} locations
                    </span>
                  </div>
                ))}
                {warehouses.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20 }}>
                    <button className="o-btn o-btn-primary" onClick={() => { setMainView("warehouses"); startNewWarehouse(); }}>
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
                <div className="o-sidebar-title">Categories</div>
                <div className="o-sidebar-item active">
                  <span>All Products</span>
                  <span className="o-sidebar-count">{products.length}</span>
                </div>
                {categories.map(c => (
                  <div key={c.id} className="o-sidebar-item">
                    <span>{c.name}</span>
                    <span className="o-sidebar-count">
                      {products.filter(p => p.category_id === c.id).length}
                    </span>
                  </div>
                ))}
              </div>

              <div className="o-sidebar-section">
                <div className="o-sidebar-title">Product Type</div>
                {PRODUCT_TYPES.map(t => (
                  <div key={t.value} className="o-sidebar-item">
                    <span>{t.label}</span>
                    <span className="o-sidebar-count">
                      {products.filter(p => p.product_type === t.value).length}
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
                      <th>Sale Price</th>
                      <th>Cost</th>
                      <th>Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => {
                      const category = categories.find(c => c.id === p.category_id);
                      return (
                        <tr key={p.id} onDoubleClick={() => openProduct(p)} style={{ cursor: "pointer" }}>
                          <td>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>P</span>
                          </td>
                          <td>
                            <span style={{ color: "#2563eb", fontWeight: 500, cursor: "pointer" }} onClick={() => openProduct(p)}>
                              {p.name}
                            </span>
                            {p.barcode && <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.barcode}</div>}
                          </td>
                          <td>{p.reference || "-"}</td>
                          <td>{category?.name || "-"}</td>
                          <td>
                            <span className={`o-tag o-tag-${p.product_type === "storable" ? "in" : p.product_type === "service" ? "internal" : "out"}`}>
                              {PRODUCT_TYPES.find(t => t.value === p.product_type)?.label}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{p.quantity_on_hand} {p.uom}</td>
                          <td style={{ color: "#28a745" }}>{p.quantity_available} {p.uom}</td>
                          <td className="o-monetary">${p.sale_price.toFixed(2)}</td>
                          <td className="o-monetary">${p.purchase_cost.toFixed(2)}</td>
                          <td className="o-monetary" style={{ fontWeight: 600 }}>${p.stock_value.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: 40 }}>
                          <button className="o-btn o-btn-primary" onClick={startNewProduct}>
                            + Create Product
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ============= PRODUCTS KANBAN ============= */}
        {mainView === "products" && subView === "kanban" && (
          <div className="o-main" style={{ width: "100%" }}>
            <div className="o-kanban">
              {filteredProducts.map(p => {
                const category = categories.find(c => c.id === p.category_id);
                return (
                  <div key={p.id} className="o-kanban-card" onClick={() => openProduct(p)}>
                    <div className="o-kanban-header">
                      <div>
                        <div className="o-kanban-title">{p.name}</div>
                        <div className="o-kanban-subtitle">{p.reference || p.barcode || "No reference"}</div>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 700 }}>P</span>
                    </div>
                    <div className="o-kanban-body">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ color: "var(--muted)" }}>On Hand</span>
                        <span style={{ fontWeight: 600 }}>{p.quantity_on_hand} {p.uom}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ color: "var(--muted)" }}>Sale Price</span>
                        <span>${p.sale_price.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>Stock Value</span>
                        <span style={{ fontWeight: 600 }}>${p.stock_value.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="o-kanban-footer">
                      <div className="o-kanban-tags">
                        {category && <span className="o-tag o-tag-draft">{category.name}</span>}
                        <span className={`o-tag o-tag-${p.is_active ? "done" : "cancelled"}`}>
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
                <div style={{ display: "flex", gap: 24, marginBottom: 24, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="o-form-input"
                      placeholder="Product Name"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      style={{ fontSize: 24, fontWeight: 600, border: "none", borderBottom: "2px solid #dee2e6", borderRadius: 0, padding: "8px 0" }}
                    />
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <span className={`o-tag ${productForm.can_be_sold ? "o-tag-done" : "o-tag-draft"}`}>
                        {productForm.can_be_sold ? "Can be Sold" : "Not for Sale"}
                      </span>
                      <span className={`o-tag ${productForm.can_be_purchased ? "o-tag-confirmed" : "o-tag-draft"}`}>
                        {productForm.can_be_purchased ? "Can be Purchased" : "Not for Purchase"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="o-group-separator">
                  <div className="o-group-separator-line" />
                  <span className="o-group-separator-text">General Information</span>
                  <div className="o-group-separator-line" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <div className="o-form-group">
                      <label className="o-form-label">Product Type</label>
                      <div className="o-form-field">
                        <select
                          className="o-form-select"
                          value={productForm.product_type}
                          onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}
                        >
                          {PRODUCT_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
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
                          onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value ? Number(e.target.value) : null })}
                        >
                          <option value="">No category</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Internal Reference</label>
                      <div className="o-form-field">
                        <input
                          type="text"
                          className="o-form-input"
                          value={productForm.reference}
                          onChange={(e) => setProductForm({ ...productForm, reference: e.target.value })}
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
                          onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="o-form-group">
                      <label className="o-form-label">Sales Price</label>
                      <div className="o-form-field">
                        <input
                          type="number"
                          className="o-form-input"
                          value={productForm.sale_price}
                          onChange={(e) => setProductForm({ ...productForm, sale_price: Number(e.target.value) })}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Sales Cost</label>
                      <div className="o-form-field">
                        <input
                          type="number"
                          className="o-form-input"
                          value={productForm.sales_cost}
                          onChange={(e) => setProductForm({ ...productForm, sales_cost: Number(e.target.value) })}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Purchase Cost</label>
                      <div className="o-form-field">
                        <input
                          type="number"
                          className="o-form-input"
                          value={productForm.purchase_cost}
                          onChange={(e) => setProductForm({ ...productForm, purchase_cost: Number(e.target.value) })}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Tax Rate (%)</label>
                      <div className="o-form-field">
                        <input
                          type="number"
                          className="o-form-input"
                          value={productForm.tax_rate}
                          onChange={(e) => setProductForm({ ...productForm, tax_rate: Number(e.target.value) })}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Unit of Measure</label>
                      <div className="o-form-field">
                        <select
                          className="o-form-select"
                          value={productForm.uom}
                          onChange={(e) => setProductForm({ ...productForm, uom: e.target.value })}
                        >
                          {UOMS.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {productForm.product_type === "storable" && (
                  <>
                    <div className="o-group-separator">
                      <div className="o-group-separator-line" />
                      <span className="o-group-separator-text">Inventory</span>
                      <div className="o-group-separator-line" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <div className="o-form-group">
                          <label className="o-form-label">Reorder Point</label>
                          <div className="o-form-field">
                            <input
                              type="number"
                              className="o-form-input"
                              value={productForm.reorder_point}
                              onChange={(e) => setProductForm({ ...productForm, reorder_point: Number(e.target.value) })}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="o-form-group">
                          <label className="o-form-label">Maximum Stock</label>
                          <div className="o-form-field">
                            <input
                              type="number"
                              className="o-form-input"
                              value={productForm.max_stock_quantity}
                              onChange={(e) => setProductForm({ ...productForm, max_stock_quantity: Number(e.target.value) })}
                              min="0"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="o-form-group">
                          <label className="o-form-label">Minimum Stock</label>
                          <div className="o-form-field">
                            <input
                              type="number"
                              className="o-form-input"
                              value={productForm.min_stock_quantity}
                              onChange={(e) => setProductForm({ ...productForm, min_stock_quantity: Number(e.target.value) })}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="o-form-group">
                          <label className="o-form-label">Track Inventory</label>
                          <div className="o-form-field">
                            <select
                              className="o-form-select"
                              value={productForm.track_inventory ? "yes" : "no"}
                              onChange={(e) => setProductForm({ ...productForm, track_inventory: e.target.value === "yes" })}
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }}>
                      <div>
                        <div className="o-form-group">
                          <label className="o-form-label">Weight</label>
                          <div className="o-form-field">
                            <input
                              type="number"
                              className="o-form-input"
                              value={productForm.weight}
                              onChange={(e) => setProductForm({ ...productForm, weight: Number(e.target.value) })}
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="o-form-group">
                          <label className="o-form-label">Weight UOM</label>
                          <div className="o-form-field">
                            <input
                              type="text"
                              className="o-form-input"
                              value={productForm.weight_uom}
                              onChange={(e) => setProductForm({ ...productForm, weight_uom: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="o-group-separator">
                  <div className="o-group-separator-line" />
                  <span className="o-group-separator-text">Description</span>
                  <div className="o-group-separator-line" />
                </div>

                <textarea
                  className="o-form-textarea"
                  rows={4}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product description..."
                  style={{ width: "100%" }}
                />

                <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={productForm.can_be_sold}
                      onChange={(e) => setProductForm({ ...productForm, can_be_sold: e.target.checked })}
                    />
                    Can be Sold
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={productForm.can_be_purchased}
                      onChange={(e) => setProductForm({ ...productForm, can_be_purchased: e.target.checked })}
                    />
                    Can be Purchased
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============= WAREHOUSES LIST ============= */}
        {mainView === "warehouses" && subView === "list" && (
          <div className="o-main" style={{ width: "100%" }}>
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
                {warehouses.map(w => {
                  const locs = warehouseLocations(w.id);
                  const warehouseQuants = stockQuants.filter(q => q.warehouse_id === w.id);
                  const totalValue = warehouseQuants.reduce((sum, q) => sum + q.total_value, 0);
                  const totalItems = warehouseQuants.reduce((sum, q) => sum + q.quantity, 0);
                  
                  return (
                    <div key={w.id} className="o-form-sheet" style={{ cursor: "pointer" }} onClick={() => openWarehouse(w)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 18 }}>{w.name}</h3>
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>{w.code}</div>
                        </div>
                        <button className="o-btn o-btn-secondary o-btn-icon" onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelectedLocationId(null);
                          setLocationForm({ warehouse_id: w.id, name: "", code: "", is_primary: false }); 
                          setShowLocationModal(true); 
                        }}>
                          +
                        </button>
                      </div>
                      
                      {w.address && <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>{w.address}</div>}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>{locs.length}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Locations</div>
                        </div>
                        <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>{totalItems}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Items</div>
                        </div>
                        <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>${totalValue.toFixed(0)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Value</div>
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid #dee2e6", paddingTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>LOCATIONS</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {locs.slice(0, 5).map(l => (
                            <span key={l.id} className={`o-tag ${l.is_primary ? "o-tag-done" : "o-tag-draft"}`}>
                              {l.name}
                            </span>
                          ))}
                          {locs.length > 5 && (
                            <span className="o-tag o-tag-draft">+{locs.length - 5} more</span>
                          )}
                          {locs.length === 0 && (
                            <span style={{ color: "var(--muted)", fontSize: 13 }}>No locations</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {warehouses.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb", marginBottom: 16 }}>WH</div>
                    <h3 style={{ margin: "0 0 8px 0" }}>No Warehouses Yet</h3>
                    <p style={{ color: "var(--muted)", marginBottom: 16 }}>Create your first warehouse to start managing inventory</p>
                    <button className="o-btn o-btn-primary" onClick={startNewWarehouse}>
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
                <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
                  <div style={{ width: 64, height: 64, background: "#f8f9fa", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#2563eb" }}>WH</div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="o-form-input"
                      placeholder="Warehouse Name"
                      value={warehouseForm.name}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                      style={{ fontSize: 24, fontWeight: 600, border: "none", borderBottom: "2px solid #dee2e6", borderRadius: 0, padding: "8px 0" }}
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
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., WH01"
                      style={{ maxWidth: 200 }}
                    />
                  </div>
                </div>

                <div className="o-form-group">
                  <label className="o-form-label">Address</label>
                  <div className="o-form-field" style={{ maxWidth: "100%" }}>
                    <textarea
                      className="o-form-textarea"
                      value={warehouseForm.address}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
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
                      <span className="o-group-separator-text">Locations</span>
                      <div className="o-group-separator-line" />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <span style={{ fontWeight: 600 }}>Warehouse Locations</span>
                      <button className="o-btn o-btn-secondary" onClick={() => {
                        setSelectedLocationId(null);
                        setLocationForm({ warehouse_id: selectedWarehouseId, name: "", code: "", is_primary: false });
                        setShowLocationModal(true);
                      }}>
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
                          {warehouseLocations(selectedWarehouseId).map(l => (
                            <tr key={l.id}>
                              <td>{l.name}</td>
                              <td>{l.code}</td>
                              <td>{l.is_primary ? "Yes" : ""}</td>
                              <td>
                                <button 
                                  className="o-btn o-btn-link" 
                                  style={{ padding: "4px 8px", fontSize: 12 }}
                                  onClick={() => openLocationModal(l)}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="o-btn o-btn-link" 
                                  style={{ padding: "4px 8px", fontSize: 12, color: "#dc3545" }}
                                  onClick={() => deleteLocation(l.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {warehouseLocations(selectedWarehouseId).length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
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
                {["all", ...STATES.map(s => s.value)].map(state => (
                  <div
                    key={state}
                    className={`o-sidebar-item ${filterState === state ? "active" : ""}`}
                    onClick={() => setFilterState(state)}
                  >
                    <span>{state === "all" ? "All" : STATES.find(s => s.value === state)?.label}</span>
                    <span className="o-sidebar-count">
                      {state === "all" ? stockMoves.length : stockMoves.filter(m => m.state === state).length}
                    </span>
                  </div>
                ))}
              </div>

              <div className="o-sidebar-section">
                <div className="o-sidebar-title">Operation Type</div>
                {MOVE_TYPES.map(t => (
                  <div key={t.value} className="o-sidebar-item">
                    <span>{t.label}</span>
                    <span className="o-sidebar-count">
                      {stockMoves.filter(m => m.move_type === t.value).length}
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
                        <th>Unit Cost</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMoves.map(m => {
                        const product = products.find(p => p.id === m.product_id);
                        const warehouse = warehouses.find(w => w.id === m.warehouse_id);
                        const moveType = MOVE_TYPES.find(t => t.value === m.move_type);
                        return (
                          <tr key={m.id} onDoubleClick={() => openMove(m)} style={{ cursor: "pointer" }}>
                            <td>
                              <span style={{ color: "#2563eb", fontWeight: 500, cursor: "pointer" }} onClick={() => openMove(m)}>
                                {m.reference || `WH/MOV/${String(m.id).padStart(5, "0")}`}
                              </span>
                            </td>
                            <td>{product?.name || "-"}</td>
                            <td>
                              <span className={`o-tag o-tag-${m.move_type}`}>
                                {moveType?.label}
                              </span>
                            </td>
                            <td>{warehouse?.name || "-"}</td>
                            <td style={{ fontWeight: 600 }}>{m.quantity} {(product?.uom === "PCS" ? "Units" : product?.uom) || "Units"}</td>
                            <td className="o-monetary">${m.unit_cost.toFixed(2)}</td>
                            <td className="o-monetary" style={{ fontWeight: 600 }}>${m.total_cost.toFixed(2)}</td>
                            <td>
                              <span className={`o-tag o-tag-${m.state}`}>
                                {STATES.find(s => s.value === m.state)?.label}
                              </span>
                            </td>
                            <td>
                              {m.state === "draft" && (
                                <div className="o-quick-actions" style={{ opacity: 1 }}>
                                  <button
                                    className="o-btn o-btn-success o-btn-icon"
                                    onClick={(e) => { e.stopPropagation(); confirmMove(m.id); }}
                                    title="Validate"
                                  >
                                    OK
                                  </button>
                                  <button
                                    className="o-btn o-btn-danger o-btn-icon"
                                    onClick={(e) => { e.stopPropagation(); cancelMove(m.id); }}
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
                          <td colSpan={9} style={{ textAlign: "center", padding: 40 }}>
                            <div style={{ color: "var(--muted)", marginBottom: 16 }}>No stock moves found</div>
                            <button className="o-btn o-btn-primary" onClick={() => startNewMove("in")}>
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
                      {stockQuants.map(q => {
                        const product = products.find(p => p.id === q.product_id);
                        const warehouse = warehouses.find(w => w.id === q.warehouse_id);
                        const location = locations.find(l => l.id === q.location_id);
                        return (
                          <tr key={q.id}>
                            <td style={{ fontWeight: 500 }}>{product?.name || "-"}</td>
                            <td>{warehouse?.name || "-"}</td>
                            <td>{location?.name || "-"}</td>
                            <td style={{ fontWeight: 600 }}>{q.quantity}</td>
                            <td style={{ color: q.reserved_quantity > 0 ? "#dc3545" : "inherit" }}>{q.reserved_quantity}</td>
                            <td style={{ color: "#28a745", fontWeight: 600 }}>{q.available_quantity}</td>
                            <td className="o-monetary">${q.unit_cost.toFixed(2)}</td>
                            <td className="o-monetary" style={{ fontWeight: 600 }}>${q.total_value.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      {stockQuants.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                            No stock on hand. Validate stock moves to update quantities.
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
                    <div key={s.value} className={`o-statusbar-item ${
                      selectedMove.state === s.value ? "active" : 
                      STATES.findIndex(st => st.value === selectedMove.state) > i ? "done" : ""
                    }`}>
                      {s.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {selectedMove && selectedMove.state === "draft" && !isNew && (
                <div style={{ marginBottom: 24, display: "flex", gap: 8 }}>
                  <button className="o-btn o-btn-success" onClick={() => confirmMove(selectedMove.id)}>
                    Validate
                  </button>
                  <button className="o-btn o-btn-secondary" onClick={() => cancelMove(selectedMove.id)}>
                    Cancel
                  </button>
                </div>
              )}

              <div className="o-form-sheet">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <div className="o-form-group">
                      <label className="o-form-label">Product</label>
                      <div className="o-form-field">
                        <select
                          className="o-form-select"
                          value={moveForm.product_id ?? ""}
                          onChange={(e) => {
                            const prod = products.find(p => p.id === Number(e.target.value));
                            setMoveForm({
                              ...moveForm,
                              product_id: Number(e.target.value),
                              unit_cost: prod?.purchase_cost || 0,
                            });
                          }}
                          disabled={selectedMove?.state === "done"}
                        >
                          <option value="">Select a product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Operation Type</label>
                      <div className="o-form-field">
                        <select
                          className="o-form-select"
                          value={moveForm.move_type}
                          onChange={(e) => setMoveForm({ ...moveForm, move_type: e.target.value })}
                          disabled={selectedMove?.state === "done"}
                        >
                          {MOVE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
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
                          onChange={(e) => setMoveForm({ ...moveForm, warehouse_id: Number(e.target.value), location_id: null })}
                          disabled={selectedMove?.state === "done"}
                        >
                          <option value="">Select a warehouse...</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
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
                          onChange={(e) => setMoveForm({ ...moveForm, location_id: Number(e.target.value) })}
                          disabled={selectedMove?.state === "done"}
                        >
                          <option value="">Select a location...</option>
                          {locations.filter(l => !moveForm.warehouse_id || l.warehouse_id === moveForm.warehouse_id).map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
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
                          onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
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
                          onChange={(e) => setMoveForm({ ...moveForm, unit_cost: Number(e.target.value) })}
                          step="0.01"
                          min="0"
                          disabled={selectedMove?.state === "done"}
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Total Cost</label>
                      <div className="o-form-field">
                        <span style={{ padding: "8px 0", display: "block", fontWeight: 600, fontSize: 18 }}>
                          ${(moveForm.quantity * moveForm.unit_cost).toFixed(2)}
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
                          onChange={(e) => setMoveForm({ ...moveForm, reference: e.target.value })}
                          placeholder="e.g., WH/IN/00001"
                          disabled={selectedMove?.state === "done"}
                        />
                      </div>
                    </div>

                    <div className="o-form-group">
                      <label className="o-form-label">Source Document</label>
                      <div className="o-form-field">
                        <input
                          type="text"
                          className="o-form-input"
                          value={moveForm.source_document}
                          onChange={(e) => setMoveForm({ ...moveForm, source_document: e.target.value })}
                          placeholder="e.g., PO-00001"
                          disabled={selectedMove?.state === "done"}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="o-group-separator" style={{ marginTop: 24 }}>
                  <div className="o-group-separator-line" />
                  <span className="o-group-separator-text">Notes</span>
                  <div className="o-group-separator-line" />
                </div>

                <textarea
                  className="o-form-textarea"
                  rows={4}
                  value={moveForm.notes}
                  onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, width: 400 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>{selectedCategoryId ? "Edit Category" : "New Category"}</h3>
            <div className="o-form-group">
              <label className="o-form-label">Name</label>
              <div className="o-form-field">
                <input
                  type="text"
                  className="o-form-input"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  autoFocus
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="o-btn o-btn-secondary" onClick={() => { setShowCategoryModal(false); setSelectedCategoryId(null); }}>Cancel</button>
              <button className="o-btn o-btn-primary" onClick={saveCategory} disabled={saving}>
                {saving ? "Saving..." : (selectedCategoryId ? "Save" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, width: 400 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>{selectedLocationId ? "Edit Location" : "New Location"}</h3>
            <div className="o-form-group">
              <label className="o-form-label">Warehouse</label>
              <div className="o-form-field">
                <select
                  className="o-form-select"
                  value={locationForm.warehouse_id ?? ""}
                  onChange={(e) => setLocationForm({ ...locationForm, warehouse_id: Number(e.target.value) })}
                  disabled={!!selectedLocationId}
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
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
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
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
                  onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 12 }}>
              <input
                type="checkbox"
                checked={locationForm.is_primary}
                onChange={(e) => setLocationForm({ ...locationForm, is_primary: e.target.checked })}
              />
              Primary Location
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="o-btn o-btn-secondary" onClick={() => { setShowLocationModal(false); setSelectedLocationId(null); }}>Cancel</button>
              <button className="o-btn o-btn-primary" onClick={saveLocation} disabled={saving}>
                {saving ? "Saving..." : (selectedLocationId ? "Save" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
