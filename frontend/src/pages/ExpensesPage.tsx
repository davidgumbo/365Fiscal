import { useMe } from "../hooks/useMe";

export default function ExpensesPage() {
  const { me } = useMe();
  const isAdmin = Boolean(me?.is_admin);

  return (
    <div className="content-area">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">
            {isAdmin
              ? "Manage company expenses"
              : "View and manage your expenses"}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        Expenses app has been added to the menu.
      </div>
    </div>
  );
}
