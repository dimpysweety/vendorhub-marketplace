/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { dbPool, PostgresDatabaseError } from "./src/db/pg-sim.ts";
import { DecodedToken, UserRole } from "./src/types.js";

const JWT_SECRET = process.env.JWT_SECRET || "PRODUCTION_STABLE_E_COMMERCE_KEY_2026_JWT";
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API MIDDLEWARES ---

  // Request logs with DB state connection checks
  app.use((req, res, next) => {
    console.log(`[HTTP REQ] ${req.method} ${req.url} - Connection: Active DB pool client`);
    next();
  });

  // Authentication Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access Denied: No session token provided" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      req.user = decoded;
      next();
    } catch (err: any) {
      // Log using console.log to avoid tripping platform server-crash detection for expected auth expirations
      console.log("[Auth] Session validation failed (token may be expired or invalid):", err?.message || err);
      return res.status(403).json({ error: "Access Forbidden: Session token has expired or is invalid" });
    }
  };

  // Role verification middleware helper
  const requireRoles = (allowedRoles: UserRole[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: "Permission Denied: Insufficient authorization",
          required: allowedRoles,
          yourRole: req.user?.role || "none"
        });
      }
      next();
    };
  };

  // --- AUTH ENDPOINTS ---

  // Password Strength Validator Helpers
  const validatePasswordStrength = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  app.post("/api/auth/register", async (req, res) => {
    const {
      role,
      email,
      password,
      confirmPassword,
      // Customer specific
      fullName,
      phone, // mobile
      shippingAddress,
      // Vendor specific
      vendorName,
      businessName,
      businessEmail,
      businessDescription,
      whatDoYouSell,
      gstNumber,
      shopAddress,
      branchLocations,
      // Admin specific
      adminId,
      adminPasscode,
      
      otpVerified
    } = req.body;

    try {
      if (!role) {
        return res.status(400).json({ success: false, error: "Validation failure", message: "User role is required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, error: "Validation failure", message: "Passwords do not match" });
      }

      const strengthErr = validatePasswordStrength(password);
      if (strengthErr) {
        return res.status(400).json({ success: false, error: "Validation failure", message: strengthErr });
      }

      let finalEmail = email;
      let finalFullName = fullName || "";
      const extraProfile: any = {};

      if (role === "customer") {
        if (!email || !email.includes("@")) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "A valid email is required" });
        }
        if (!fullName) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Full Name is required" });
        }
        // Indian Mobile validation
        const cleanMobile = (phone || "").replace(/[\s\-]/g, "");
        if (!/^(?:\+91|0)?[6-9]\d{9}$/.test(cleanMobile)) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "A valid 10-digit Indian mobile number is required (starting with 6-9)" });
        }
        if (!shippingAddress) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Shipping Address is required" });
        }
        if (otpVerified !== true) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "OTP Verification is mandatory before account creation" });
        }

        extraProfile.phone = cleanMobile;
        extraProfile.shippingAddress = shippingAddress;

      } else if (role === "vendor") {
        finalEmail = businessEmail;
        if (!finalEmail || !finalEmail.includes("@")) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Business Email is required and must be valid" });
        }
        if (!vendorName) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Vendor Name is required" });
        }
        if (!businessName) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Business Name is required" });
        }
        const cleanMobile = (phone || "").replace(/[\s\-]/g, "");
        if (!/^(?:\+91|0)?[6-9]\d{9}$/.test(cleanMobile)) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "A valid 10-digit Indian mobile number is required for vendors (starting with 6-9)" });
        }

        // GST validation (regex-based)
        const cleanGST = (gstNumber || "").trim().toUpperCase();
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGST)) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "A valid 15-character official Indian GSTIN number is required (e.g. 22AAAAA0000A1Z5)" });
        }

        if (!shopAddress) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Primary Shop Address is required" });
        }

        if (otpVerified !== true) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "OTP Verification is mandatory" });
        }

        finalFullName = vendorName;
        extraProfile.phone = cleanMobile;
        extraProfile.businessName = businessName;
        extraProfile.businessDescription = businessDescription || "";
        extraProfile.whatDoYouSell = whatDoYouSell || "";
        extraProfile.gstNumber = cleanGST;
        extraProfile.shopAddress = shopAddress;
        extraProfile.branchLocations = branchLocations || [];

      } else if (role === "admin") {
        if (!email || !email.includes("@")) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Company Email is required" });
        }
        // Company email only check: Fail if domain is a known public provider
        const isPublicEmail = /@(gmail|yahoo|outlook|hotmail|live|mail|proton|aol|icloud|yandex)\.com$/i.test(email);
        if (isPublicEmail) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Admin registration requires a corporate company email (no public domains permitted like @gmail.com)" });
        }

        if (!adminId) {
          return res.status(400).json({ success: false, error: "Validation failure", message: "Admin ID is required" });
        }

        finalFullName = "Administrator " + adminId;
        extraProfile.adminId = adminId;
      }

      // register in virtual db
      const user = await dbPool.registerUser(finalEmail, password, role, finalFullName, extraProfile);

      // Auto register/login and return token (set to 30d lifespan to prevent frequent user logout)
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role } as DecodedToken,
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      });
    } catch (error: any) {
      console.error("[REST API] Post Registration Error Handler invoked.");
      
      // Return highly structured DB and SQL error payload if it is a simulated PostgresDatabaseError
      if (error instanceof PostgresDatabaseError) {
        console.error("[PostgreSQL DB Error Stack]:", {
          message: error.message,
          code: error.code,
          detail: error.detail,
          table: error.table,
          constraint: error.constraint,
          query: error.query,
          severity: error.severity
        });

        return res.status(400).json({
          success: false,
          error: "Database constraint failure",
          message: error.message,
          postgresError: {
            code: error.code,
            detail: error.detail,
            table: error.table,
            constraint: error.constraint,
            query: error.query,
            severity: error.severity
          }
        });
      }

      // Other generic backend errors
      console.error("[Backend validation failure]:", error);
      res.status(500).json({
        success: false,
        error: "Server validation failure",
        message: error.message || "An unexpected registration error occurred on the backend"
      });
    }
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    const { email, password, adminPasscode } = req.body;
    try {
      if (!email || !password) {
        return res.status(400).json({ error: "Missing identity credentials or password" });
      }

      // Can login using email or phone
      const user = await dbPool.findUserByEmailOrPhone(email);
      if (!user) {
        return res.status(401).json({ error: "Authentication failed: User account not found" });
      }

      if (user.isBlocked) {
        return res.status(401).json({ error: "Authentication failed: This account is blocked by the system administrator" });
      }

      // Hash comparison validation
      const bcrypt = await import("bcryptjs");
      const isValid = bcrypt.default.compareSync(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Authentication failed: Invalid credentials entered" });
      }

      // If role is admin, passcode checks are bypassed without disturbing any other logic
      if (user.role === "admin") {
        // Admin passcode check removed per user request
      }

      // Login session token signed with 30d lifespan to prevent interruptions
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role } as DecodedToken,
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } catch (err: any) {
      console.error("[Login API Error]:", err);
      res.status(500).json({ error: "Internal Server Auth Error", message: err.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
    try {
      const user = await dbPool.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "Active user record not found" });
      }
      const profile = await dbPool.getProfile(user.id);
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: profile?.fullName || user.email.split("@")[0]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PRODUCTS ---

  app.get("/api/products", async (req: any, res: any) => {
    const { q, category } = req.query;
    try {
      const list = await dbPool.getProducts(q as string, category as string);
      res.json(list);
    } catch (err: any) {
      console.error("[Products API Error]:", err);
      res.status(500).json({ error: "Failed to load catalog", message: err.message });
    }
  });

  app.post("/api/products", authenticateToken, requireRoles(["vendor", "admin"]), async (req: any, res: any) => {
    const { title, description, price, category, inventory, imageUrl } = req.body;
    try {
      if (!title || price === undefined || inventory === undefined) {
        return res.status(400).json({ error: "Missing required core product information" });
      }
      const newProduct = await dbPool.storeProduct(
        req.user.id,
        title,
        description,
        Number(price),
        category || "General",
        Number(inventory),
        imageUrl
      );
      res.status(201).json(newProduct);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to store product", message: err.message });
    }
  });

  app.put("/api/products/:id", authenticateToken, requireRoles(["vendor", "admin"]), async (req: any, res: any) => {
    const { title, description, price, category, inventory, imageUrl } = req.body;
    const productId = Number(req.params.id);
    try {
      const vendorId = req.user.role === "admin" ? 0 : req.user.id;
      const updatedProduct = await dbPool.editProduct(productId, vendorId, {
        title, description, price, category, inventory, imageUrl
      });
      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found or unauthorized to edit" });
      }
      res.json(updatedProduct);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update product", message: err.message });
    }
  });

  app.delete("/api/products/:id", authenticateToken, requireRoles(["vendor", "admin"]), async (req: any, res: any) => {
    const productId = Number(req.params.id);
    try {
      const vendorId = req.user.role === "admin" ? 0 : req.user.id;
      const deleted = await dbPool.deleteProduct(productId, vendorId);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found or unauthorized to delete" });
      }
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete product", message: err.message });
    }
  });

  // --- REVIEWS ---

  app.get("/api/reviews/:productId", async (req: any, res: any) => {
    const productId = Number(req.params.productId);
    try {
      const list = await dbPool.getReviews(productId);
      res.json(list);
    } catch (err: any) {
      console.error("[Reviews API Error]:", err);
      res.status(500).json({ error: "Failed to load reviews", message: err.message });
    }
  });

  app.post("/api/reviews", authenticateToken, async (req: any, res: any) => {
    const { productId, rating, comment } = req.body;
    try {
      if (!productId || rating === undefined) {
        return res.status(400).json({ error: "Product ID and rating (1-5) are required to submit a review" });
      }
      const ratingNum = Number(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
      }
      const newReview = await dbPool.addReview(
        req.user.id,
        Number(productId),
        ratingNum,
        comment
      );
      res.status(201).json(newReview);
    } catch (err: any) {
      console.error("[Reviews Submit Error]:", err);
      res.status(500).json({ error: "Failed to submit review", message: err.message });
    }
  });

  // --- USER PROFILE, ADDRESS, PAYMENTS ---

  app.get("/api/profile", authenticateToken, async (req: any, res: any) => {
    try {
      const profile = await dbPool.getProfile(req.user.id);
      res.json({
        userId: req.user.id,
        fullName: profile?.fullName || "",
        phone: profile?.phone || "",
        profilePicture: profile?.profilePicture || "",
        shippingAddress: profile?.shippingAddress || "",
        email: req.user.email
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/profile", authenticateToken, async (req: any, res: any) => {
    const { fullName, phone, profilePicture, shippingAddress } = req.body;
    try {
      const profile = await dbPool.updateProfile(req.user.id, fullName, phone, profilePicture, shippingAddress);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/addresses", authenticateToken, async (req: any, res: any) => {
    try {
      const list = await dbPool.getAddresses(req.user.id);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/addresses", authenticateToken, async (req: any, res: any) => {
    const { street, city, state, zipCode, country, isDefault } = req.body;
    try {
      if (!street || !city || !zipCode) {
        return res.status(400).json({ error: "Missing key parts of address" });
      }
      const addr = await dbPool.addAddress(req.user.id, street, city, state, zipCode, country, !!isDefault);
      res.status(201).json(addr);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/payment-methods", authenticateToken, async (req: any, res: any) => {
    try {
      const list = await dbPool.getPaymentMethods(req.user.id);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/payment-methods", authenticateToken, async (req: any, res: any) => {
    const { cardHolder, cardNumber, expiry, isDefault } = req.body;
    try {
      if (!cardHolder || !cardNumber || !expiry) {
        return res.status(400).json({ error: "Missing key payment credit card details" });
      }
      const pay = await dbPool.addPaymentMethod(req.user.id, cardHolder, cardNumber, expiry, !!isDefault);
      res.status(201).json(pay);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ORDERS ---

  app.get("/api/orders", authenticateToken, async (req: any, res: any) => {
    try {
      const role = req.user.role;
      if (role === "admin") {
        const list = await dbPool.getAllOrdersAdmin();
        return res.json(list);
      } else if (role === "vendor") {
        const list = await dbPool.getVendorOrders(req.user.id);
        return res.json(list);
      } else {
        const list = await dbPool.getCustomerOrders(req.user.id);
        return res.json(list);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", authenticateToken, requireRoles(["customer", "admin"]), async (req: any, res: any) => {
    const { totalAmount, items, addressId, paymentMethodId, paymentMethod, shippingAddressText, estimatedDeliveryDate } = req.body;
    try {
      if (!items || !items.length || totalAmount === undefined) {
        return res.status(400).json({ error: "Purchase cart is empty or missing amount total" });
      }
      const order = await dbPool.createOrder(
        req.user.id,
        Number(totalAmount),
        items,
        addressId,
        paymentMethodId,
        paymentMethod,
        shippingAddressText,
        estimatedDeliveryDate
      );
      res.status(201).json(order);
    } catch (err: any) {
      if (err instanceof PostgresDatabaseError) {
        return res.status(400).json({
          error: "Database constraint warning",
          message: err.message,
          postgresError: {
            code: err.code,
            detail: err.detail,
            table: err.table,
            constraint: err.constraint
          }
        });
      }
      res.status(500).json({ error: "Transaction failed", message: err.message });
    }
  });

  // --- VENDOR INSIGHTS ---

  app.get("/api/vendor/stats", authenticateToken, requireRoles(["vendor"]), async (req: any, res: any) => {
    try {
      const stats = await dbPool.getVendorDashboardStats(req.user.id);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ORDER STATUS UPDATES ---

  app.patch("/api/orders/:id/status", authenticateToken, requireRoles(["vendor", "admin"]), async (req: any, res: any) => {
    const orderId = Number(req.params.id);
    const { status } = req.body;
    try {
      if (!status) {
        return res.status(400).json({ error: "status property is required in request body" });
      }
      const updatedOrder = await dbPool.updateOrderStatus(orderId, status);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(updatedOrder);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update order status", message: err.message });
    }
  });

  // --- ADMIN SYSTEMS ---

  app.get("/api/admin/users", authenticateToken, requireRoles(["admin"]), async (req: any, res: any) => {
    try {
      const usersList = await dbPool.getAllUsersAdmin();
      res.json(usersList);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch platform users", message: err.message });
    }
  });

  app.post("/api/admin/vendors/:id/block", authenticateToken, requireRoles(["admin"]), async (req: any, res: any) => {
    const vendorId = Number(req.params.id);
    const { isBlocked } = req.body;
    try {
      if (isBlocked === undefined) {
        return res.status(400).json({ error: "isBlocked property is required" });
      }
      const success = await dbPool.setVendorBlockStatus(vendorId, isBlocked);
      if (!success) {
        return res.status(404).json({ error: "Vendor user account not found" });
      }
      res.json({ success: true, isBlocked });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update block status", message: err.message });
    }
  });

  // --- VITE MIDDLEWARE CONFIGURATION ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Full-stack application proxy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
