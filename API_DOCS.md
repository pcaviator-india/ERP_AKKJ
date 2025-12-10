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
