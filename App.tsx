import { useEffect, useState } from "react";
import type { Product, UserRole } from "./types";
import { api, clearToken, getToken } from "./api";
import Navbar from "./components/Navbar";
import CartDrawer, { CartLine } from "./components/CartDrawer";
import AuthPage from "./pages/AuthPage";
import CustomerHome from "./pages/CustomerHome";
import VendorDashboard from "./pages/VendorDashboard";
import AdminConsole from "./pages/AdminConsole";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [search, setSearch] = useState("");
  const [customerView, setCustomerView] = useState<"catalog" | "orders">("catalog");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .get("/auth/me")
      .then((me) => {
        setRole(me.role);
        setFullName(me.fullName);
      })
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  const handleAuthed = (r: UserRole, name: string) => {
    setRole(r);
    setFullName(name);
  };

  const logout = () => {
    clearToken();
    setRole(null);
    setFullName("");
    setCart([]);
  };

  const addToCart = (p: Product) => {
    setCart((lines) => {
      const existing = lines.find((l) => l.productId === p.id);
      if (existing) {
        return lines.map((l) =>
          l.productId === p.id ? { ...l, quantity: Math.min(l.maxInventory, l.quantity + 1) } : l
        );
      }
      return [
        ...lines,
        { productId: p.id, title: p.title, price: p.price, quantity: 1, imageUrl: p.imageUrl, maxInventory: p.inventory },
      ];
    });
    setCartOpen(true);
  };

  const updateQty = (productId: number, quantity: number) => {
    setCart((lines) => lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  };

  const removeLine = (productId: number) => {
    setCart((lines) => lines.filter((l) => l.productId !== productId));
  };

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!role) {
    return <AuthPage onAuthed={handleAuthed} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        role={role}
        fullName={fullName}
        cartCount={cart.reduce((s, l) => s + l.quantity, 0)}
        search={search}
        onSearchChange={setSearch}
        onCartClick={() => setCartOpen(true)}
        onLogout={logout}
        onLogoClick={() => setCustomerView("catalog")}
      />

      {role === "customer" && (
        <div className="max-w-7xl mx-auto px-4 pt-3 flex gap-2">
          {(["catalog", "orders"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCustomerView(v)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg capitalize ${
                customerView === v ? "bg-indigo-600 text-white" : "text-gray-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {role === "customer" && <CustomerHome search={search} view={customerView} onAddToCart={addToCart} />}
      {role === "vendor" && <VendorDashboard />}
      {role === "admin" && <AdminConsole />}

      {role === "customer" && (
        <CartDrawer
          open={cartOpen}
          lines={cart}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeLine}
          onOrderPlaced={() => setCart([])}
        />
      )}
    </div>
  );
}
