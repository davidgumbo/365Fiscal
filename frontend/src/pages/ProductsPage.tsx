import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";

type Product = {
  id: number;
  company_id: number;
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
  category_id: number | null;
};

type Category = {
  id: number;
  company_id: number;
  name: string;
};

const PRODUCT_TYPES = [
  { value: "storable", label: "Storable Product" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
];

export default function ProductsPage() {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "inventory" | "sales">("general");
  const [form, setForm] = useState({
    name: "",
    category_id: null as number | null,
    description: "",
    sale_price: 0,
    tax_rate: 0,
    sales_cost: 0,
    purchase_cost: 0,
    hs_code: "",
    reference: "",
    barcode: "",
    product_type: "storable",
    uom: "PCS",
    track_inventory: true,
    min_stock_quantity: 0,
    max_stock_quantity: 0,
    reorder_point: 0,
    weight: 0,
    weight_uom: "kg",
    is_active: true,
    can_be_sold: true,
    can_be_purchased: true
  });

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadProducts = async (cid: number) => {
    const data = await apiFetch<Product[]>(`/products?company_id=${cid}`);
    setProducts(data);
    if (data.length && selectedProductId === null) {
      const first = data[0];
      setSelectedProductId(first.id);
      setForm({
        name: first.name,
        category_id: first.category_id ?? null,
        description: first.description || "",
        sale_price: first.sale_price,
        tax_rate: first.tax_rate,
        sales_cost: first.sales_cost || 0,
        purchase_cost: first.purchase_cost || 0,
        hs_code: first.hs_code || "",
        reference: first.reference || "",
        barcode: first.barcode || "",
        product_type: first.product_type || "storable",
        uom: first.uom || "PCS",
        track_inventory: first.track_inventory ?? true,
        min_stock_quantity: first.min_stock_quantity || 0,
        max_stock_quantity: first.max_stock_quantity || 0,
        reorder_point: first.reorder_point || 0,
        weight: first.weight || 0,
        weight_uom: first.weight_uom || "kg",
        is_active: first.is_active ?? true,
        can_be_sold: first.can_be_sold ?? true,
        can_be_purchased: first.can_be_purchased ?? true
      });
    }
  };

  const loadCategories = async (cid: number) => {
    const data = await apiFetch<Category[]>(`/categories?company_id=${cid}`);
    setCategories(data);
  };

  useEffect(() => {
    if (companyId) {
      loadProducts(companyId);
      loadCategories(companyId);
    }
  }, [companyId]);

  const emptyForm = () => ({
    name: "",
    category_id: null as number | null,
    description: "",
    sale_price: 0,
    tax_rate: 0,
    sales_cost: 0,
    purchase_cost: 0,
    hs_code: "",
    reference: "",
    barcode: "",
    product_type: "storable",
    uom: "PCS",
    track_inventory: true,
    min_stock_quantity: 0,
    max_stock_quantity: 0,
    reorder_point: 0,
    weight: 0,
    weight_uom: "kg",
    is_active: true,
    can_be_sold: true,
    can_be_purchased: true
  });

  const createProduct = async () => {
    if (!companyId) return;
    await apiFetch<Product>("/products", {
      method: "POST",
      body: JSON.stringify({ ...form, company_id: companyId })
    });
    setForm(emptyForm());
    loadProducts(companyId);
  };

  const updateProduct = async () => {
    if (!selectedProductId) return;
    await apiFetch<Product>(`/products/${selectedProductId}`, {
      method: "PATCH",
      body: JSON.stringify(form)
    });
    loadProducts(companyId!);
    setIsEditing(false);
  };

  const startNew = () => {
    setSelectedProductId(null);
    setForm(emptyForm());
    setIsEditing(true);
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setForm({
      name: product.name,
      category_id: product.category_id ?? null,
      description: product.description || "",
      sale_price: product.sale_price,
      tax_rate: product.tax_rate,
      sales_cost: product.sales_cost || 0,
      purchase_cost: product.purchase_cost || 0,
      hs_code: product.hs_code || "",
      reference: product.reference || "",
      barcode: product.barcode || "",
      product_type: product.product_type || "storable",
      uom: product.uom || "PCS",
      track_inventory: product.track_inventory ?? true,
      min_stock_quantity: product.min_stock_quantity || 0,
      max_stock_quantity: product.max_stock_quantity || 0,
      reorder_point: product.reorder_point || 0,
      weight: product.weight || 0,
      weight_uom: product.weight_uom || "kg",
      is_active: product.is_active ?? true,
      can_be_sold: product.can_be_sold ?? true,
      can_be_purchased: product.can_be_purchased ?? true
    });
    setIsEditing(false);
  };

  return (
    <div className="page-container">
      <div className="two-panel">
        <div className="form-shell-pro">
          <div className="section-header">
            <div className="section-title">
              <h3>{selectedProductId ? form.name || "Product" : "New Product"}</h3>
              <p>{selectedProductId ? `ID: ${selectedProductId}` : "Create a new product"}</p>
            </div>
            <div className="toolbar-right">
              <div className="statusbar">
                <span className={`badge ${form.is_active ? "badge-success" : "badge-secondary"}`}>
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <button className="btn btn-secondary" onClick={startNew}>+ New</button>
              {isEditing ? (
                <>
                  <button className="btn btn-primary" onClick={selectedProductId ? updateProduct : createProduct}>Save</button>
                  <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Discard</button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Edit</button>
              )}
            </div>
          </div>
          
          <div className="tabs-nav">
            <button className={`tab-btn ${activeTab === "general" ? "active" : ""}`} onClick={() => setActiveTab("general")}>General Info</button>
            <button className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>Inventory</button>
            <button className={`tab-btn ${activeTab === "sales" ? "active" : ""}`} onClick={() => setActiveTab("sales")}>Sales & Purchases</button>
          </div>

          {activeTab === "general" && (
            <div className="form-grid-pro">
              <div className="input-group">
                <label className="input-label">Company</label>
                <select
                  className="input-field dropdown-select"
                  value={companyId ?? ""}
                  onChange={(e) => setCompanyId(Number(e.target.value))}
                  disabled={!isEditing}
                >
                  {companies.map((c: Company) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Product Name</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Enter product name"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Category</label>
                <select
                  className="input-field dropdown-select"
                  value={form.category_id ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, category_id: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  disabled={!isEditing}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Product Type</label>
                <select
                  className="input-field dropdown-select"
                  value={form.product_type}
                  onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                  disabled={!isEditing}
                >
                  {PRODUCT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Reference / SKU</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g., SKU-001"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Barcode</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g., 1234567890123"
                />
              </div>
              <div className="input-group">
                <label className="input-label">HS Code</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.hs_code}
                  onChange={(e) => setForm({ ...form, hs_code: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Harmonized System code"
                />
              </div>
              <div className="input-group" style={{ gridColumn: "span 2" }}>
                <label className="input-label">Description</label>
                <textarea
                  className="input-field"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="Product description..."
                />
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  disabled={!isEditing}
                />
                <label htmlFor="is_active">Product is Active</label>
              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="form-grid-pro">
              <div className="input-group">
                <label className="input-label">Unit of Measure</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.uom}
                  onChange={(e) => setForm({ ...form, uom: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g., PCS, KG, L"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Weight</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Weight UOM</label>
                <input
                  className="input-field"
                  type="text"
                  value={form.weight_uom}
                  onChange={(e) => setForm({ ...form, weight_uom: e.target.value })}
                  disabled={!isEditing}
                  placeholder="kg"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Minimum Stock Quantity</label>
                <input
                  className="input-field"
                  type="number"
                  value={form.min_stock_quantity}
                  onChange={(e) => setForm({ ...form, min_stock_quantity: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Maximum Stock Quantity</label>
                <input
                  className="input-field"
                  type="number"
                  value={form.max_stock_quantity}
                  onChange={(e) => setForm({ ...form, max_stock_quantity: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Reorder Point</label>
                <input
                  className="input-field"
                  type="number"
                  value={form.reorder_point}
                  onChange={(e) => setForm({ ...form, reorder_point: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="track_inventory"
                  checked={form.track_inventory}
                  onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })}
                  disabled={!isEditing}
                />
                <label htmlFor="track_inventory">Track Inventory Levels</label>
              </div>
            </div>
          )}

          {activeTab === "sales" && (
            <div className="form-grid-pro">
              <div className="input-group">
                <label className="input-label">Sale Price</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Tax Rate (%)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Sales Cost</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={form.sales_cost}
                  onChange={(e) => setForm({ ...form, sales_cost: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Purchase Cost</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={form.purchase_cost}
                  onChange={(e) => setForm({ ...form, purchase_cost: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="can_be_sold"
                  checked={form.can_be_sold}
                  onChange={(e) => setForm({ ...form, can_be_sold: e.target.checked })}
                  disabled={!isEditing}
                />
                <label htmlFor="can_be_sold">Can be Sold</label>
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="can_be_purchased"
                  checked={form.can_be_purchased}
                  onChange={(e) => setForm({ ...form, can_be_purchased: e.target.checked })}
                  disabled={!isEditing}
                />
                <label htmlFor="can_be_purchased">Can be Purchased</label>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-panel">
          <h4>Products List</h4>
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {products.length === 0 ? (
              <div className="empty-state-pro">
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className={`list-item ${selectedProductId === p.id ? "active" : ""}`}
                  onClick={() => selectProduct(p)}
                >
                  <div>
                    <div className="list-item-title">{p.name}</div>
                    <div className="list-item-sub">${p.sale_price.toFixed(2)} • {p.tax_rate}%</div>
                  </div>
                  <span className={`badge ${p.is_active ? "badge-success" : "badge-secondary"}`}>
                    {p.is_active ? "Active" : "Off"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
