# ERP_AKKJ – POS, Promotions, and ERP Services

## Overview
Modern ERP/POS stack with promotions, inventory, sales tickets, customers, products, price lists, and supporting master data. Frontend is Vite/React; backend is Node/Express with MySQL. POS supports percent/amount promos, unit-price overrides, manual price overrides (with PIN), and customer-facing screen broadcast.

## Key Features
- **Promotions**: percent/amount and unit-price overrides; scopes by products, categories, customers, brands, employees, custom fields, channels, and days; priority/stackable/min-qty/limits.
- **POS**: live cart, tax-inclusive/exclusive handling, promotions applied client-side, promo lines shown, manual price override with manager PIN (non-admin), printable receipts, parked tickets.
- **Catalog**: products, categories, brands, units, tax rates, price lists, custom fields.
- **Customers & Groups**: customer master with grouping for promo scope.
- **Employees & Roles**: employee list, PIN verification endpoint for overrides.
- **Inventory & Warehouses**: warehouses, inventory adjustments, goods receipts, purchase orders.
- **Sales & Documents**: sales, tickets (park/save), document sequences, credit/debit notes, guía despacho.
- **Payments**: payment methods, bank accounts; supplier invoices/payments.
- **Customer Screen**: broadcast endpoint to mirror cart/total.

## Tech Stack
- **Frontend**: React (Vite), React Router, Context for auth/config/language, i18n (en/es).
- **Backend**: Node.js/Express, MySQL (using `mysql2` pool), JWT auth, REST routes per domain.
- **Printing**: QZ Tray support with fallback to browser print.

## Setup
1) Install dependencies  
   ```bash
   npm install
   cd client && npm install
   ```
2) Environment (`.env`) example  
   ```env
   DB_TYPE=mysql
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=yourpass
   MYSQL_DATABASE=erp_akkj
   PORT=4000
   JWT_SECRET=changeme
   ```
3) Database  
   - Use the provided schema SQL files (e.g., `final AKKJ_POS_ERP_Complete_Schema_Chile_MySQL_v2_if_not_exists.sql`).  
   - Promotions table requires `UnitPrice DECIMAL(18,4) NULL` column (manual alter if missing).  
4) Run backend & frontend  
   ```bash
   npm run dev         # backend (nodemon)
   cd client && npm run dev   # frontend at http://localhost:5173
   ```

## Core Workflows
- **Create Promotion**: `/promotions/new` page supports percent/amount/unit-price; scopes; limits; schedule. Unit-price sets effective unit price for matching lines.
- **Manual Override (POS)**: “Override” button per line; admin can set directly; non-admin must enter manager EmployeeID + PIN (verified via `/api/auth/verify-pin`). Line/global discounts disabled when override or promo price is active. Original price is shown struck-through; “Manual” tag displayed.
- **Promos in POS**: Applies eligible promos (percent/amount) and unit-price overrides; shows “Promo: name” child lines and adjusts totals/receipt; supports days/timezone/min-qty/channels/customer/employee scopes.
- **Tickets**: Park/save via `/api/sales/tickets`; load/list drafts; intended document type ticket.
- **Customer Screen**: Broadcast via `/api/customer-screen/broadcast` with channel `company-<CompanyID>`.

## API Reference
See `API_DOCS.md` for full endpoints and examples (auth/PIN, promotions, products, categories, brands, custom fields, price lists, tax rates, customers/groups, employees/roles, warehouses/inventory/POs/receipts, sales/tickets/customer screen, suppliers/purchasing, payments/banks, documents/sequences, uploads, config/companies).

## Notable Frontend Screens
- `client/src/pages/PromotionsPage.jsx`: list, filter, icon actions; unit-price aware.
- `client/src/pages/PromotionCreate.jsx`: create/edit with scopes, schedule, limits, unit-price.
- `client/src/pages/Pos.jsx`: POS cart, promotions, manual override modal, receipts, tickets, customer screen.

## Printing
- QZ Tray supported; fallback to browser print via `printWithFallback`. See `PRINTING_SETUP.md` for certs/setup (if applicable).

## License
Recommend MIT or Apache-2.0 for permissive public use; choose per your policy.

## Next Steps / TODO
- Finalize park/load ticket UI (currently placeholder buttons in POS header).
- Add full audit trail for overrides/promotions applied per line.
- Expand tests (API + POS promo application edge cases).  
