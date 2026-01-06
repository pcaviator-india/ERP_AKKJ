const { pool } = require("../db");

const VIEW_DEFINITIONS = [
  {
    name: "fact_sales_orders",
    sql: `
      CREATE OR REPLACE VIEW fact_sales_orders AS
      SELECT
        s.CompanyID AS company_id,
        s.SaleID AS sale_id,
        DATE(s.SaleDate) AS order_date,
        s.SaleDate AS order_timestamp,
        s.DocumentType AS document_type,
        s.DocumentNumber AS document_number,
        COALESCE(NULLIF(TRIM(s.MarketplaceOrderID_External), ''), 'POS') AS channel,
        s.PaymentStatus AS payment_status,
        s.Status AS status,
        s.EmployeeID AS employee_id,
        s.CustomerID AS customer_id,
        s.CurrencyID AS currency_id,
        s.TotalAmount AS gross_total,
        s.SubTotal AS net_total,
        s.TaxAmountTotal AS tax_total,
        s.DiscountAmountTotal AS discount_total,
        s.FinalAmount AS final_total,
        item_agg.line_count,
        item_agg.distinct_products,
        item_agg.total_quantity,
        product_dim.product_ids,
        product_dim.product_skus,
        product_dim.product_names,
        product_dim.product_brand_ids,
        product_dim.product_brand_names,
        product_dim.product_category_ids,
        product_dim.product_category_names,
        c.CustomerName AS customer_name,
        c.TaxID AS customer_tax_id,
        c.Email AS customer_email,
        c.PhoneNumber AS customer_phone,
        c.BillingAddressLine1 AS customer_billing_address,
        c.BillingCity AS customer_billing_city,
        c.ShippingAddressLine1 AS customer_shipping_address,
        c.ShippingCity AS customer_shipping_city,
        c.CustomerGroupID AS customer_group_id,
        cg.GroupName AS customer_group_name,
        e.FirstName AS employee_first_name,
        e.LastName AS employee_last_name,
        CONCAT_WS(' ', e.FirstName, e.LastName) AS employee_full_name,
        e.Email AS employee_email,
        e.PhoneNumber AS employee_phone,
        curr.CurrencyCode AS currency_code,
        curr.Symbol AS currency_symbol,
        s.CreatedAt AS created_at,
        s.UpdatedAt AS updated_at
      FROM Sales s
      LEFT JOIN (
        SELECT
          si.SaleID,
          COUNT(*) AS line_count,
          COUNT(DISTINCT si.ProductID) AS distinct_products,
          SUM(si.Quantity) AS total_quantity
        FROM SalesItems si
        GROUP BY si.SaleID
      ) item_agg ON item_agg.SaleID = s.SaleID
      LEFT JOIN (
        SELECT
          si.SaleID,
          GROUP_CONCAT(DISTINCT si.ProductID ORDER BY si.ProductID SEPARATOR ',') AS product_ids,
          GROUP_CONCAT(DISTINCT p.SKU ORDER BY p.SKU SEPARATOR ',') AS product_skus,
          GROUP_CONCAT(DISTINCT p.ProductName ORDER BY p.ProductName SEPARATOR ',') AS product_names,
          GROUP_CONCAT(DISTINCT p.ProductBrandID ORDER BY p.ProductBrandID SEPARATOR ',') AS product_brand_ids,
          GROUP_CONCAT(DISTINCT brand.BrandName ORDER BY brand.BrandName SEPARATOR ',') AS product_brand_names,
          GROUP_CONCAT(DISTINCT p.ProductCategoryID ORDER BY p.ProductCategoryID SEPARATOR ',') AS product_category_ids,
          GROUP_CONCAT(DISTINCT cat.CategoryName ORDER BY cat.CategoryName SEPARATOR ',') AS product_category_names
        FROM SalesItems si
        LEFT JOIN Products p ON p.ProductID = si.ProductID
        LEFT JOIN ProductBrands brand ON brand.ProductBrandID = p.ProductBrandID
        LEFT JOIN ProductCategories cat ON cat.ProductCategoryID = p.ProductCategoryID
        GROUP BY si.SaleID
      ) product_dim ON product_dim.SaleID = s.SaleID
      LEFT JOIN Customers c ON c.CustomerID = s.CustomerID
      LEFT JOIN CustomerGroups cg ON cg.CustomerGroupID = c.CustomerGroupID
      LEFT JOIN Employees e ON e.EmployeeID = s.EmployeeID
      LEFT JOIN Currencies curr ON curr.CurrencyID = s.CurrencyID;
    `,
  },
  {
    name: "fact_payments",
    sql: `
      CREATE OR REPLACE VIEW fact_payments AS
      SELECT
        s.CompanyID AS company_id,
        sp.SalesPaymentID AS payment_id,
        sp.SaleID AS sale_id,
        DATE(sp.PaymentDate) AS payment_date,
        sp.PaymentDate AS payment_timestamp,
        sp.Amount AS amount,
        pm.MethodName AS method,
        s.PaymentStatus AS status,
        s.PaymentStatus AS sale_payment_status,
        s.Status AS sale_status,
        s.CustomerID AS customer_id,
        s.EmployeeID AS employee_id,
        s.CurrencyID AS currency_id,
        curr.CurrencyCode AS currency_code,
        curr.Symbol AS currency_symbol,
        sp.ReferenceNumber AS reference_number,
        sp.BankTransactionID AS bank_transaction_id,
        s.DocumentType AS document_type,
        s.DocumentNumber AS document_number,
        c.CustomerName AS customer_name,
        c.TaxID AS customer_tax_id,
        c.Email AS customer_email,
        c.PhoneNumber AS customer_phone,
        c.BillingAddressLine1 AS customer_billing_address,
        c.BillingCity AS customer_billing_city,
        c.ShippingAddressLine1 AS customer_shipping_address,
        c.ShippingCity AS customer_shipping_city,
        c.CustomerGroupID AS customer_group_id,
        cg.GroupName AS customer_group_name,
        e.FirstName AS employee_first_name,
        e.LastName AS employee_last_name,
        CONCAT_WS(' ', e.FirstName, e.LastName) AS employee_full_name,
        e.Email AS employee_email,
        e.PhoneNumber AS employee_phone
      FROM SalesPayments sp
      INNER JOIN Sales s ON s.SaleID = sp.SaleID
      LEFT JOIN PaymentMethods pm ON pm.PaymentMethodID = sp.PaymentMethodID
      LEFT JOIN Currencies curr ON curr.CurrencyID = s.CurrencyID
      LEFT JOIN Customers c ON c.CustomerID = s.CustomerID
      LEFT JOIN CustomerGroups cg ON cg.CustomerGroupID = c.CustomerGroupID
      LEFT JOIN Employees e ON e.EmployeeID = s.EmployeeID;
    `,
  },
  {
    name: "fact_inventory_balances",
    sql: `
      CREATE OR REPLACE VIEW fact_inventory_balances AS
      WITH ordered AS (
        SELECT
          t.CompanyID AS company_id,
          t.ProductID AS product_id,
          t.WarehouseID AS warehouse_id,
          p.ProductCategoryID AS category_id,
          t.ProductLotID AS product_lot_id,
          t.ProductSerialID AS product_serial_id,
          DATE(t.TransactionDate) AS snapshot_date,
          SUM(t.QuantityChange) OVER (
            PARTITION BY t.CompanyID, t.ProductID, t.WarehouseID, COALESCE(t.ProductLotID, 0), COALESCE(t.ProductSerialID, 0)
            ORDER BY t.TransactionDate, t.InventoryTransactionID
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS stock_on_hand,
          pl.ExpirationDate AS lot_expiry
        FROM InventoryTransactions t
        LEFT JOIN Products p ON p.ProductID = t.ProductID
        LEFT JOIN ProductLots pl ON pl.ProductLotID = t.ProductLotID
      ), summarized AS (
        SELECT
          company_id,
          product_id,
          warehouse_id,
          category_id,
          snapshot_date,
          product_lot_id,
          product_serial_id,
          MAX(stock_on_hand) AS stock_on_hand,
          MAX(lot_expiry) AS lot_expiry
        FROM ordered
        GROUP BY
          company_id,
          product_id,
          warehouse_id,
          category_id,
          snapshot_date,
          product_lot_id,
          product_serial_id
      )
      SELECT
        s.company_id,
        s.product_id,
        s.warehouse_id,
        s.category_id,
        s.snapshot_date,
        s.product_lot_id,
        s.product_serial_id,
        s.stock_on_hand,
        0 AS stock_reserved,
        s.lot_expiry,
        p.SKU AS product_sku,
        p.ProductName AS product_name,
        p.ProductBrandID AS brand_id,
        brand.BrandName AS brand_name,
        cat.CategoryName AS category_name,
        w.WarehouseName AS warehouse_name,
        w.AddressLine1 AS warehouse_address,
        w.City AS warehouse_city
      FROM summarized s
      LEFT JOIN Products p ON p.ProductID = s.product_id
      LEFT JOIN ProductBrands brand ON brand.ProductBrandID = p.ProductBrandID
      LEFT JOIN ProductCategories cat ON cat.ProductCategoryID = s.category_id
      LEFT JOIN Warehouses w ON w.WarehouseID = s.warehouse_id;
    `,
  },
];

let ensurePromise = null;

async function ensureReportingViews() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    for (const definition of VIEW_DEFINITIONS) {
      try {
        await pool.query(definition.sql);
      } catch (error) {
        console.error(`Failed to create view ${definition.name}`, error);
        throw error;
      }
    }
  })()
    .catch((error) => {
      ensurePromise = null;
      throw error;
    });

  return ensurePromise;
}

module.exports = { ensureReportingViews, VIEW_DEFINITIONS };
