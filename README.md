# VendorHub - Multi-Vendor Marketplace Platform

A modern, high-performance, and responsive multi-vendor e-commerce marketplace. Built with a full-stack architecture using **React**, **TypeScript**, **Tailwind CSS**, and **Express**. VendorHub provides a seamless shopping experience alongside comprehensive dashboards for both product vendors and platform administrators.

---

## 🚀 Features

### 🛍️ Customer Experience
- **Interactive Product Catalog**: Dynamic search, multi-category filtering, and detailed product modal views.
- **Persistent Shopping Cart**: Real-time sliding drawer cart with quantity adjusters, instant price calculations, and checkout flows.
- **User Profiles**: Quick identity switching to test different platform roles (Customer, Vendor, Admin).

### 🏪 Vendor Portal
- **Inventory Management**: Create, edit, and archive product listings with customizable descriptions, pricing, and tags.
- **Analytics Dashboard**: Tracking metrics for total sales, items sold, active inventory count, and recent orders.
- **Storefront Customs**: Easily edit store descriptions and manage listings directly from a unified panel.

### 🛡️ Administration Console
- **Platform Overview**: High-level platform health metrics including total active users, platform revenue, and vendor populations.
- **Moderation Workflow**: Approve or reject pending product listings to maintain quality control across the marketplace.
- **Vendor Approvals**: Manage onboarding queues for new business entities applying to sell on VendorHub.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: React 18 with Vite.
- **Programming Language**: TypeScript (Strict Typings) for solid type-safety.
- **Styling Layout**: Tailwind CSS for fully responsive desktop and mobile-first layout design.
- **Component Animations**: Framer Motion for smooth structural drawers, catalogs, and transitions.
- **Server Environment**: Node.js & Express hosting RESTful API endpoints.
- **Icons**: Lucide React SVGs for lightweight and elegant graphics.

---

## 📦 Getting Started

Follow these instructions to run the project locally on your machine.

### Prerequisites

Ensure you have **Node.js** (v18 or higher) and **npm** installed.

### Installation

1. Clone or download the repository files.
2. In the root directory, install all required dependencies:
   ```bash
   npm install
   ```

### Running the Application

To launch both the Node.js API backend and the Vite frontend dev server concurrently:

```bash
npm run dev
```

The application will start, and the console will print the local hosting URL (typically `http://localhost:3000`).

### Production Build

To compile a production-ready bundle maximizing asset performance:

```bash
npm run build
```

The compiled assets will be bundled into the `/dist` directory.

---

## 📝 License

This project is licensed under the MIT License.
