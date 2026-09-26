export type UserRole = "customer" | "vendor" | "admin";

export interface DecodedToken {
  id: number;
  email: string;
  role: UserRole;
}

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  isBlocked?: boolean;
}

export interface Profile {
  userId: number;
  fullName: string;
  phone?: string;
  profilePicture?: string;
  shippingAddress?: string;
  businessName?: string;
  businessDescription?: string;
  whatDoYouSell?: string;
  gstNumber?: string;
  shopAddress?: string;
  branchLocations?: string[];
  adminId?: string;
}

export interface Address {
  id: number;
  userId: number;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: number;
  userId: number;
  cardHolder: string;
  cardNumberMasked: string;
  expiry: string;
  isDefault: boolean;
}

export interface Product {
  id: number;
  vendorId: number;
  title: string;
  description: string;
  price: number;
  category: string;
  inventory: number;
  imageUrl: string;
  createdAt: string;
  brand?: string;
  discount?: number;
  vendorName?: string;
  rating?: number;
}

export interface Review {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewerName?: string;
}

export interface OrderItem {
  productId: number;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  vendorId?: number;
}

export interface Order {
  id: number;
  userId: number;
  totalAmount: number;
  items: OrderItem[];
  addressId?: number;
  paymentMethodId?: number;
  paymentMethod?: string;
  shippingAddressText?: string;
  estimatedDeliveryDate?: string;
  status: "Placed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  createdAt: string;
}

export interface VendorStats {
  totalSales: number;
  itemsSold: number;
  activeInventoryCount: number;
  recentOrders: Order[];
}

export interface AdminOverview {
  totalUsers: number;
  totalVendors: number;
  totalCustomers: number;
  platformRevenue: number;
  pendingApprovals: number;
}
