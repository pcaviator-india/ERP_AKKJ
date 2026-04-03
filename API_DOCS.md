# ERP / POS API Catalog

> Base URL: http://localhost:4000 (replace with the appropriate environment hostname).

All endpoints are JSON over HTTPS unless stated. Every request (except onboarding and login) must supply an Authorization header:

```
Authorization: Bearer <access-token>
```

Tokens are issued by POST /api/auth/login or POST /api/auth/refresh. Company scoping is enforced automatically from the authenticated user.

---

## Authentication & Session

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/auth/login | Exchange email/password for access and refresh tokens. |
| POST | /api/auth/refresh | Refresh access token using a refresh token. |
| POST | /api/auth/register | Register an employee (CompanyAdmin/SuperAdmin only). |
| POST | /api/auth/set-pin | Set or reset employee POS PIN. |
| POST | /api/auth/verify-pin | Validate POS override PIN. |
| GET | /api/auth/me | Return current employee profile and permissions. |

**Login example**

```
POST /api/auth/login
{
  "Email": "cashier@demo.cl",
  "Password": "demo1234"
}

Response 200
{
  "token": "<JWT>",
  "refreshToken": "<JWT>"
}
```

---

## Onboarding

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/onboarding/register | Self-service tenant + admin creation. |

**Payload sample**

```
{
  "CompanyName": "Comercial Ejemplo",
  "AdminFirstName": "Ana",
  "AdminLastName": "Soto",
  "AdminEmail": "ana@example.com",
  "Password": "DemoPass!123"
}
```

---

## Company Configuration

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/companies | List company records (admin only). |
| GET | /api/companies/:id | Retrieve company profile. |
| POST | /api/companies | Create company (SuperAdmin). |
| PUT | /api/companies/:id | Update company fields. |
| DELETE | /api/companies/:id | Deactivate company. |
| GET | /api/config | Fetch tenant configuration bundle. |
| PATCH | /api/config | Update POS/config store settings. |

**Config update example**

```
PATCH /api/config
{
  "updates": {
    "pos": {
      "documentType": "BOLETA",
      "receiptFooter": "Gracias por su compra"
    }
  }
}
```

---

## Users, Roles & Permissions

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/employees | List employees for the company. |
| PUT | /api/employees/:id | Update employee profile or password. |
| DELETE | /api/employees/:id | Archive employee (IsActive = 0). |
| GET | /api/roles | List available roles. |
| POST | /api/roles | Create a role (requires roles.manage). |
| PUT | /api/roles/:id | Update role fields. |
| DELETE | /api/roles/:id | Delete role. |
| GET | /api/roles/:id/permissions | Get role permissions. |
| PUT | /api/roles/:id/permissions | Replace role permissions. |

**Role payload example**

```
POST /api/roles
{
  "RoleName": "StoreManager",
  "Description": "POS supervisor"
}
```

---

## Catalog Management

### Products

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/products | List products (supports filters via query string). |
| POST | /api/products | Create product. |
| GET | /api/products/:id | Retrieve product with pricing and stock. |
| PUT | /api/products/:id | Update product. |
| DELETE | /api/products/:id | Delete product. |
| POST | /api/products/import/images | Bulk image upload (multipart). |
| POST | /api/products/import/preview | Validate import manifest. |
| POST | /api/products/import/commit | Commit preview import. |
| GET | /api/products/export | Export catalog (CSV/XLSX). |
| GET | /api/products/:id/images | List images. |
| POST | /api/products/:id/images | Add images. |
| PUT | /api/products/:id/images/:imageId | Update image metadata. |
| DELETE | /api/products/:id/images/:imageId | Remove image. |

**Create product example**

```
{
  "SKU": "SKU-1001",
  "ProductName": "Cafe Grano 1kg",
  "UnitID": 1,
  "ProductCategoryID": 3,
  "SellingPrice": 9990,
  "CostPrice": 6500,
  "IsTaxable": 1,
  "TaxRateID": 1,
  "UsesLots": 0,
  "UsesSerials": 0,
  "Barcode": "7800000000010"
}
```

### Categories, Brands, Units

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/categories | List categories. |
| POST | /api/categories | Create category. |
| PUT | /api/categories/:id | Update category. |
| DELETE | /api/categories/:id | Delete category. |
| GET | /api/brands | List brands. |
| POST | /api/brands | Create brand. |
| PUT | /api/brands/:id | Update brand. |
| DELETE | /api/brands/:id | Soft-delete brand. |
| GET | /api/units | List units of measure. |
| POST | /api/units | Create unit. |

### Custom Fields & Metadata

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/custom-fields/product | List product custom field definitions. |
| POST | /api/custom-fields/product/bulk | Bulk upsert definitions. |
| DELETE | /api/custom-fields/product/:id | Delete definition. |
| GET | /api/custom-fields/product/values | Get values for a product (requires productId query). |
| POST | /api/custom-fields/product/values | Upsert values for a product. |
| POST | /api/custom-fields/product/stage-values | Stage values before product exists. |
| GET | /api/custom-fields/product/stage-values | List staged values (token query). |
| POST | /api/custom-fields/product/attach-staged | Attach staged values to product. |

### Pricing Tools

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/price-lists | List price lists. |
| POST | /api/price-lists | Create price list. |
| PUT | /api/price-lists/:id | Update price list header. |
| GET | /api/price-lists/:id/items | Fetch price overrides. |
| PUT | /api/price-lists/:id/items | Replace price override list. |
| GET | /api/tax-rates | List tax rates. |
| POST | /api/tax-rates | Create tax rate. |
| PUT | /api/tax-rates/:id | Update tax rate. |
| PUT | /api/tax-rates/:id/default | Mark default tax rate. |

**Price list example**

```
{
  "Name": "Mayoristas",
  "Currency": "CLP",
  "Items": [
    { "ProductID": 10, "Price": 5500 },
    { "ProductID": 12, "Price": 3200 }
  ]
}
```

### Promotions

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/promotions | List promotions. |
| POST | /api/promotions | Create promotion. |
| PATCH | /api/promotions/:id | Update promotion. |
| DELETE | /api/promotions/:id | Delete promotion. |

**Promotion payload**

```
{
  "name": "Navidad 10",
  "code": "NAV10",
  "type": "percent",
  "value": 10,
  "unitPrice": null,
  "priority": 100,
  "enabled": true,
  "stackable": true,
  "scopes": {
    "products": ["Cafe Grano 1kg"],
    "channels": ["POS"]
  }
}
```

### Packs, Lots, Serials

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/product-packs | List pack definitions. |
| GET | /api/product-packs/:packProductId | Retrieve pack detail. |
| POST | /api/product-packs | Create pack. |
| PUT | /api/product-packs/:packProductId | Update pack. |
| DELETE | /api/product-packs/:packProductId | Delete pack. |
| GET | /api/product-lots | List lots (filter by productId, warehouseId). |
| GET | /api/product-lots/fefo | Fetch FEFO lot recommendation. |
| POST | /api/product-lots | Create or update lot inventory. |
| PUT | /api/product-lots/:lotId | Update lot details/inventory. |
| GET | /api/product-serials | List serial numbers (filterable). |
| POST | /api/product-serials/intake | Intake serial numbers and adjust inventory. |

---

## Warehouses & Inventory

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/warehouses | List warehouses. |
| POST | /api/warehouses | Create warehouse. |
| PUT | /api/warehouses/:id | Update warehouse. |
| DELETE | /api/warehouses/:id | Delete warehouse. |
| GET | /api/inventory/levels | Query inventory levels (supports productId, warehouseId). |
| POST | /api/inventory/levels/bulk-save | Bulk override inventory levels. |
| POST | /api/inventory/transfer | Transfer stock between warehouses. |
| POST | /api/inventory/adjust | Manual adjustment (+/-). |

**Transfer example**

```
{
  "ProductID": 10,
  "FromWarehouseID": 1,
  "ToWarehouseID": 2,
  "Quantity": 5,
  "Reason": "Replenish store",
  "ProductLotID": null
}
```

### Inbound Logistics

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/goods-receipts | List goods receipts. |
| GET | /api/goods-receipts/:id | View receipt. |
| POST | /api/goods-receipts | Create goods receipt. |
| GET | /api/purchase-orders | List purchase orders. |
| GET | /api/purchase-orders/:id | Retrieve purchase order. |
| POST | /api/purchase-orders | Create purchase order. |
| PUT | /api/purchase-orders/:id | Update purchase order. |
| DELETE | /api/purchase-orders/:id | Cancel purchase order. |
| GET | /api/direct-purchases | List direct purchases. |
| GET | /api/direct-purchases/:id | Retrieve direct purchase. |
| POST | /api/direct-purchases | Create direct purchase. |
| PUT | /api/direct-purchases/:id | Update direct purchase. |
| DELETE | /api/direct-purchases/:id | Delete direct purchase. |

---

## Suppliers & Purchasing

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/suppliers | List suppliers. |
| GET | /api/suppliers/:id | Supplier detail. |
| POST | /api/suppliers | Create supplier. |
| PUT | /api/suppliers/:id | Update supplier. |
| DELETE | /api/suppliers/:id | Archive supplier. |
| GET | /api/supplier-invoices | List supplier invoices. |
| GET | /api/supplier-invoices/:id | Supplier invoice detail. |
| GET | /api/supplier-invoices/by-supplier/:supplierId | Invoices per supplier. |
| GET | /api/supplier-invoices/summary | Invoice summary. |
| POST | /api/supplier-invoices | Create supplier invoice. |
| GET | /api/supplier-payments | List supplier payments. |
| GET | /api/supplier-payments/:id | Supplier payment detail. |
| POST | /api/supplier-payments | Create supplier payment. |

**Supplier payment example**

```
{
  "SupplierID": 5,
  "Amount": 120000,
  "PaymentMethodID": 2,
  "Reference": "TRANSFER-123",
  "PaymentDate": "2026-01-15"
}
```

---

## Sales & POS

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/sales | List sales documents. |
| GET | /api/sales/:id | Retrieve sale header/items/payments. |
| POST | /api/sales | Create sale/invoice (inventory out). |
| POST | /api/sales/tickets | Create or update POS ticket (stored as COTIZACION). |
| GET | /api/sales/tickets | List tickets (filters: status, intendedDoc). |
| GET | /api/sales/tickets/:id | Ticket detail. |
| GET | /api/sales/tickets/by-number/:docNumber | Ticket lookup by number. |
| POST | /api/sales/tickets/:id/convert | Convert ticket to legal document. |
| POST | /api/sales/tickets/:id/mark-billed | Mark ticket as billed externally. |
| DELETE | /api/sales/tickets/:id | Delete ticket. |
| POST | /api/customer-screen/broadcast | Push POS cart to customer display channel. |

**Sale payload (BOLETA)**

```
{
  "CustomerID": 123,
  "WarehouseID": 1,
  "DocumentType": "BOLETA",
  "Items": [
    {
      "ProductID": 10,
      "Quantity": 2,
      "UnitPrice": 4990,
      "DiscountPercentage": 0,
      "TaxRateID": 1,
      "TaxRatePercentage": 19,
      "IsLineExenta": 0
    }
  ],
  "Payments": [
    { "PaymentMethodID": 1, "Amount": 9980 }
  ]
}
```

### Accounts Receivable

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/ar/customers/summary | Outstanding balance per customer. |
| GET | /api/ar/customers/:customerId/invoices | Customer invoice list. |
| GET | /api/ar/invoices/:saleId | Invoice detail with items/payments. |
| POST | /api/ar/invoices/:saleId/pay | Record payment against invoice. |

**AR payment example**

```
POST /api/ar/invoices/250/pay
{
  "Amount": 150000,
  "PaymentMethodID": 3,
  "ReferenceNumber": "DEP-456",
  "PaymentDate": "2026-01-15"
}
```

### Credits, Debits, Guia de Despacho

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/sales/credit-note | Create credit note (NOTA_CREDITO). |
| GET | /api/sales/credit-note/:ncId | Credit note detail. |
| GET | /api/sales/:saleId/credit-notes | Credit notes linked to sale. |
| POST | /api/sales/debit-note | Create debit note (NOTA_DEBITO). |
| GET | /api/sales/debit-note/:ndId | Debit note detail. |
| GET | /api/sales/:saleId/debit-notes | Debit notes linked to sale. |
| POST | /api/sales/guia-despacho | Create Guia de Despacho (inventory out). |

**Credit note sample**

```
{
  "OriginalSaleID": 2001,
  "WarehouseID": 1,
  "DocumentNumber": "NC-1001",
  "Items": [
    {
      "ProductID": 10,
      "Quantity": 1,
      "UnitPrice": 4990,
      "ProductLotID": null
    }
  ],
  "Notes": "Devolucion producto defectuoso"
}
```

### Document Sequences

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/document-sequences | List document sequences. |
| GET | /api/document-sequences/:id | Sequence detail. |
| POST | /api/document-sequences | Create sequence. |
| PUT | /api/document-sequences/:id | Update sequence. |
| DELETE | /api/document-sequences/:id | Delete sequence. |

---

## Payments & Banking

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/payment-methods | List payment methods. |
| GET | /api/payment-methods/:id | Payment method detail. |
| POST | /api/payment-methods | Create payment method. |
| PUT | /api/payment-methods/:id | Update payment method. |
| DELETE | /api/payment-methods/:id | Delete payment method. |
| GET | /api/bank-accounts | List bank accounts. |
| GET | /api/bank-accounts/:id | Bank account detail. |
| POST | /api/bank-accounts | Create bank account. |
| PUT | /api/bank-accounts/:id | Update account. |
| DELETE | /api/bank-accounts/:id | Deactivate account. |

**Bank account example**

```
{
  "GLAccountID": 5101,
  "AccountName": "Banco Estado Corriente",
  "AccountNumber": "123-456-789",
  "CurrencyID": 1,
  "BankName": "Banco Estado",
  "IsActive": 1
}
```

---

## Reporting & Analytics

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/reports/sources | List available data sources. |
| GET | /api/reports/templates | List report templates. |
| GET | /api/reports/recent | Recent report runs. |
| GET | /api/reports/schedules | Scheduled reports. |
| POST | /api/reports/schedules | Create schedule. |
| PUT | /api/reports/schedules/:id | Replace schedule. |
| PATCH | /api/reports/schedules/:id | Partial update schedule. |
| DELETE | /api/reports/schedules/:id | Remove schedule. |
| POST | /api/reports/export | Export dataset (csv, xlsx, json, pdf). |
| POST | /api/reports/preview | Build dataset preview (internal use). |

**Export example**

```
POST /api/reports/export
{
  "source": "sales-summary",
  "exportFormat": "xlsx",
  "filters": [
    { "column": "CompanyID", "operator": "=", "value": 5 }
  ],
  "pageSize": 500
}
```

---

## OCR & Document Parsing

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/ocr/parse-invoice | OCR parse invoice image (base64 or URL). |
| POST | /api/ocr/parse-invoice-with-products | OCR plus product matching. |
| POST | /api/ocr/parse-invoice-xml | Parse SII XML invoice. |

**Invoice OCR example**

```
POST /api/ocr/parse-invoice
{
  "image": "data:image/png;base64,iVBORw0KG..."
}
```

---

## Upload Services

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/uploads/products | Upload product image (PNG/JPG, 5 MB max). |
| POST | /api/uploads/purchases | Upload purchase attachment (image/PDF, 10 MB max). |

---

## Miscellaneous Utilities

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/ar | Accounts receivable (see AR section). |
| GET | /api/customer-groups | List customer groups. |
| POST | /api/customer-groups | Create group. |
| PUT | /api/customer-groups/:id | Update group. |
| DELETE | /api/customer-groups/:id | Delete group. |
| GET | /api/customers | List customers. |
| GET | /api/customers/:id | Customer detail. |
| POST | /api/customers | Create customer. |
| PUT | /api/customers/:id | Update customer. |
| DELETE | /api/customers/:id | Delete customer. |
| GET | /api/customer-screen/broadcast | (see POS section) |
| GET | /api/onboarding/register | See onboarding section. |

**Customer example**

```
{
  "CustomerName": "Acme SA",
  "Email": "ventas@acme.cl",
  "Phone": "+56 9 1234 5678",
  "TaxID": "76.543.210-9",
  "Address": "Av. Central 123, Santiago",
  "GroupIDs": [1]
}
```

---

## Error & Pagination Conventions

* Validation failures return 400 with `{ "error": "message" }`.
* Authentication failures return 401; authorization failures return 403.
* Record not found returns 404 with `{ "error": "..." }`.
* Many listing endpoints accept `page`, `limit`, or filter query parameters (refer to individual route implementations for specifics).

---

## Change Log

| Date | Description |
| --- | --- |
| 2026-01-21 | Initial comprehensive catalog for tenant distribution. |

# API Reference (ERP / POS / Promotions)

Base URL: `http://localhost:4000` (adjust per environment). All endpoints require authentication and return JSON unless noted. Field names follow backend models (e.g., `ProductID`, `ProductName`).

---
## Auth & PIN
- **POST** `/api/auth/login` — Login with credentials (response includes token/user).  
- **POST** `/api/auth/verify-pin` — Verify PIN (used for manual overrides).  
  ```json
  { "EmployeeID": "123", "Pin": "4321" }
  ```
  **Response (200):** `{ "ok": true }`
  **Response (4xx):** `{ "error": "Invalid PIN" }`

---
## Promotions
- **GET** `/api/promotions` — List promotions for the company.  
- **POST** `/api/promotions` — Create promotion.  
  ```json
  {
    "name": "Holiday 10",
    "code": "HOLIDAY10",
    "type": "percent",          // percent | amount | (use unitPrice for override)
    "value": 10,
    "unitPrice": null,          // set number for unit-price override
    "enabled": true,
    "stackable": true,
    "priority": 100,
    "minQuantity": 0,
    "perOrderLimit": null,
    "perCustomerLimit": null,
    "totalRedemptions": null,
    "startAt": null,
    "endAt": null,
    "timezone": "America/Santiago",
    "scopes": {
      "products": ["Almizcle Incense Sticks"],
      "categories": ["Incense"],
      "customers": [],
      "brands": [],
      "employees": [],
      "customFields": [],
      "channels": ["POS"],
      "days": []
    }
  }
```
- **PATCH** `/api/promotions/:id` — Partial update (same shape as POST; send only changes).  
- **DELETE** `/api/promotions/:id` — Delete promotion.

**GET response sample**  
```json
[
  {
    "id": 1,
    "name": "Wholesale Coffee",
    "code": "COFFEE50",
    "type": "percent",
    "value": 50,
    "unitPrice": null,
    "enabled": true,
    "stackable": true,
    "priority": 100,
    "minQuantity": 6,
    "startAt": null,
    "endAt": null,
    "timezone": "America/Santiago",
    "scopes": { "products": ["Coffee Beans"], "channels": ["POS"], "days": [] }
  }
]
```

---
## Products & Catalog
- **GET** `/api/products` — List products.  
- **POST** `/api/products` — Create product.  
- **PUT/PATCH** `/api/products/:id` — Update product.  
- **DELETE** `/api/products/:id` — Delete product.  
- **GET** `/api/categories` — List categories.  
- **POST** `/api/categories` — Create category.  
- **PATCH** `/api/categories/:id` — Update category.  
- **DELETE** `/api/categories/:id` — Delete category.  
- **GET** `/api/brands` — List brands.  
- **POST** `/api/brands` — Create brand.  
- **PATCH** `/api/brands/:id` — Update brand.  
- **DELETE** `/api/brands/:id` — Delete brand.  
- **GET** `/api/units` — List units of measure.  

Custom fields (products)
- **GET** `/api/product-custom-fields` — List custom fields.  
- **POST** `/api/product-custom-fields` — Create custom field.  
- **PATCH** `/api/product-custom-fields/:id` — Update.  
- **DELETE** `/api/product-custom-fields/:id` — Delete.

Price lists
- **GET** `/api/price-lists` — List price lists.  
- **POST** `/api/price-lists` — Create.  
- **PATCH** `/api/price-lists/:id` — Update.  
- **DELETE** `/api/price-lists/:id` — Delete.
  ```json
  {
    "Name": "Wholesale",
    "Currency": "CLP",
    "Items": [{ "ProductID": 10, "Price": 500 }]
  }
  ```

Tax rates
- **GET** `/api/tax-rates` — List tax rates.  
- **POST** `/api/tax-rates` — Create.  
- **PATCH** `/api/tax-rates/:id` — Update.  
- **DELETE** `/api/tax-rates/:id` — Delete.
  ```json
  { "Name": "IVA 19%", "Percentage": 19, "IsDefault": true }
  ```

---
## Customers & Customer Groups
- **GET** `/api/customers` — List customers.  
- **POST** `/api/customers` — Create customer.  
- **PATCH** `/api/customers/:id` — Update.  
- **DELETE** `/api/customers/:id` — Delete.  
- **GET** `/api/customer-groups` — List groups.  
- **POST** `/api/customer-groups` — Create group.  
- **PATCH** `/api/customer-groups/:id` — Update.  
- **DELETE** `/api/customer-groups/:id` — Delete.
  ```json
  {
    "CustomerName": "Acme SA",
    "Email": "contact@acme.cl",
    "Group": "Wholesale",
    "TaxID": "12345678-9"
  }
  ```

---
## Employees & Roles
- **GET** `/api/employees` — List employees.  
- **POST** `/api/employees` — Create.  
- **PATCH** `/api/employees/:id` — Update.  
- **DELETE** `/api/employees/:id` — Delete.  
- **GET** `/api/roles` — List roles.  
- **POST** `/api/roles` — Create role.  
- **PATCH** `/api/roles/:id` — Update.  
- **DELETE** `/api/roles/:id` — Delete.

---
## Warehouses & Inventory
- **GET** `/api/warehouses` — List warehouses.  
- **POST** `/api/warehouses` — Create.  
- **PATCH** `/api/warehouses/:id` — Update.  
- **DELETE** `/api/warehouses/:id` — Delete.  
- **GET** `/api/inventory` — Inventory listing/adjustment endpoints (per warehouse).  
- **POST** `/api/inventory/adjust` — Adjust stock.  
- **GET** `/api/goods-receipts` — List receipts.  
- **POST** `/api/goods-receipts` — Create goods receipt.  
- **GET** `/api/purchase-orders` — List POs.  
- **POST** `/api/purchase-orders` — Create PO.  
- **PATCH** `/api/purchase-orders/:id` — Update PO.
  ```json
  {
    "WarehouseID": 1,
    "Lines": [
      { "ProductID": 10, "Quantity": 5, "UnitCost": 400 }
    ],
    "Reference": "GR-001"
  }
  ```

---
## Sales & POS
- **POST** `/api/sales` — Create sale/invoice.  
- **GET** `/api/sales` — List sales.  
- **GET** `/api/sales/:id` — Sale details.  
- **POST** `/api/sales/tickets` — Park or save a ticket.  
  ```json
  {
    "CustomerID": 123,
    "Items": [
      {
        "ProductID": 10,
        "Description": "Almizcle Incense Sticks",
        "Quantity": 2,
        "UnitPrice": 500,
        "DiscountPercentage": 0,
        "DiscountAmountItem": 0,
        "TaxRatePercentage": 19,
        "TaxRateID": 1,
        "IsLineExenta": 0,
        "ProductLotID": null,
        "ProductSerialID": null
      }
    ],
    "Notes": "POS Ticket",
    "ReadyForBilling": true,
    "IntendedDocumentType": "TICKET"
  }
  ```
- **GET** `/api/sales/tickets?status=draft` — List parked tickets.  
- **GET** `/api/sales/tickets/:id` — Ticket details (items).  
- **POST** `/api/customer-screen/broadcast` — Push cart/total to customer screen.  
  ```json
  { "channel": "company-5", "payload": { "cart": [], "total": 12345 } }
  ```

Manual price override (POS, non-admin)
- Uses **POST** `/api/auth/verify-pin` with `{ EmployeeID, Pin }` for approval; override is applied client-side.

**Sales POST example (simplified)**  
```json
{
  "CustomerID": 123,
  "WarehouseID": 1,
  "DocumentType": "BOLETA",
  "Items": [
    { "ProductID": 10, "Description": "Almizcle", "Quantity": 2, "UnitPrice": 500, "TaxRateID": 1 }
  ],
  "Payments": [{ "PaymentMethodID": 1, "Amount": 1000 }]
}
```

---
## Suppliers & Purchasing
- **GET** `/api/suppliers` — List suppliers.  
- **POST** `/api/suppliers` — Create supplier.  
- **PATCH** `/api/suppliers/:id` — Update.  
- **DELETE** `/api/suppliers/:id` — Delete.  
- **GET** `/api/supplier-invoices` — List supplier invoices.  
- **POST** `/api/supplier-invoices` — Create invoice.  
- **GET** `/api/supplier-payments` — List supplier payments.  
- **POST** `/api/supplier-payments` — Create payment.
  ```json
  {
    "SupplierID": 5,
    "Amount": 200000,
    "PaymentMethodID": 2,
    "Reference": "TRX-123"
  }
  ```

---
## Payments, Banks, Methods
- **GET** `/api/payment-methods` — List methods.  
- **POST** `/api/payment-methods` — Create.  
- **PATCH** `/api/payment-methods/:id` — Update.  
- **DELETE** `/api/payment-methods/:id` — Delete.  
- **GET** `/api/bank-accounts` — List accounts.  
- **POST** `/api/bank-accounts` — Create.  
- **PATCH** `/api/bank-accounts/:id` — Update.  
- **DELETE** `/api/bank-accounts/:id` — Delete.
  ```json
  { "MethodName": "Credit Card", "IsActive": true }
  ```

---
## Documents & Sequences
- **GET** `/api/document-sequences` — List sequences.  
- **POST** `/api/document-sequences` — Create/update sequence per document type.  
- **GET** `/api/guia-despacho` — Guia Despacho operations (list/create/update).  
- **GET** `/api/credit-notes` / **POST** `/api/credit-notes` — Credit notes.  
- **GET** `/api/debit-notes` / **POST** `/api/debit-notes` — Debit notes.
  ```json
  { "DocumentType": "BOLETA", "Prefix": "BOL", "NextNumber": 1201 }
  ```

---
## Uploads
- **POST** `/api/uploads` — File upload (multipart/form-data). Returns file URL/path.
  **Response example:** `{ "url": "/uploads/file123.png" }`

---
## Config & Companies
- **GET** `/api/config` — Company configuration.  
- **PATCH** `/api/config` — Update config.  
- **GET** `/api/companies` — Company info.  
- **PATCH** `/api/companies/:id` — Update company.
  ```json
  { "CompanyName": "Comercial Ejemplo", "Locale": "es-CL", "Timezone": "America/Santiago" }
  ```

---
## Examples: Promotion (percent vs unit price)
- Percent promo creation (10% off POS on Incense): see Promotions POST example above.  
- Unit-price promo creation (set unit price to 500 for Incense):  
  ```json
  {
    "name": "Incense Wholesale",
    "type": "amount",        // any type; unitPrice drives override
    "value": 0,
    "unitPrice": 500,
    "priority": 100,
    "enabled": true,
    "stackable": false,
    "scopes": { "categories": ["Incense"], "channels": ["POS"], "customers": [] }
  }
  ```

---
## Notes
- All list endpoints accept standard pagination/filters where applicable (see route implementation for specifics).  
- Scopes for promotions are case-insensitive string matches.  
- Company scoping is enforced via auth (`CompanyID`).  
- POS applies promotions client-side; unitPrice overrides set the effective line price; manual overrides require PIN (non-admin).  
- Document endpoints (sales/credit/debit/guia) expect line items with tax info (see sales payload patterns).  
