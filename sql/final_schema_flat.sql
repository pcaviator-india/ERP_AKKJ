-- Final flattened schema (no ALTER statements) for ERP_AKKJ
-- Keys aligned as BIGINT for tenant-scoped entities; run on a new database.
-- Includes core: auth/users, products/catalog, inventory, pricing, promotions, sales, suppliers/purchasing, payments.

-- =========================
-- Foundation
-- =========================
CREATE TABLE IF NOT EXISTS Currencies (
  CurrencyID INT AUTO_INCREMENT PRIMARY KEY,
  CurrencyCode CHAR(3) NOT NULL UNIQUE,
  CurrencyName VARCHAR(100) NOT NULL,
  Symbol VARCHAR(10) NULL,
  DecimalPlaces INT DEFAULT 0,
  IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Companies (
  CompanyID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyName VARCHAR(255) NOT NULL,
  LegalName VARCHAR(255) NULL,
  TaxID VARCHAR(50) NULL,
  AddressLine1 VARCHAR(255) NULL,
  AddressLine2 VARCHAR(255) NULL,
  City VARCHAR(100) NULL,
  StateOrProvince VARCHAR(100) NULL,
  PostalCode VARCHAR(20) NULL,
  CountryCode CHAR(2) NULL,
  PhoneNumber VARCHAR(50) NULL,
  Email VARCHAR(255) NULL,
  Website VARCHAR(255) NULL,
  DefaultCurrencyID INT NULL,
  DefaultLanguageCode CHAR(2) DEFAULT 'ES',
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_Companies_DefaultCurrency FOREIGN KEY (DefaultCurrencyID) REFERENCES Currencies(CurrencyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS CompanyCurrencies (
  CompanyCurrencyID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  CurrencyID INT NOT NULL,
  IsDefaultOperatingCurrency TINYINT(1) DEFAULT 0,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_CompanyCurrencies_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_CompanyCurrencies_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
  CONSTRAINT UQ_CompanyCurrency UNIQUE (CompanyID, CurrencyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Auth / Users / Roles
-- =========================
CREATE TABLE IF NOT EXISTS Employees (
  EmployeeID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  FirstName VARCHAR(100) NOT NULL,
  LastName VARCHAR(100) NOT NULL,
  Email VARCHAR(255) NOT NULL,
  PasswordHash LONGTEXT NOT NULL,
  PinHash VARCHAR(255) NULL,
  Role VARCHAR(100) DEFAULT 'Employee',
  PhoneNumber VARCHAR(50) NULL,
  JobTitle VARCHAR(100) NULL,
  DepartmentID BIGINT NULL,
  ReportsToEmployeeID BIGINT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  LastLoginAt DATETIME NULL,
  CONSTRAINT FK_Employees_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_Employees_ReportsTo FOREIGN KEY (ReportsToEmployeeID) REFERENCES Employees(EmployeeID),
  CONSTRAINT UQ_Employee_Company_Email UNIQUE (CompanyID, Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Roles (
  RoleID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  RoleName VARCHAR(100) NOT NULL,
  Description VARCHAR(500) NULL,
  CONSTRAINT FK_Roles_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_Role_Company_Name UNIQUE (CompanyID, RoleName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS RolePermissions (
  RolePermissionID BIGINT AUTO_INCREMENT PRIMARY KEY,
  RoleID BIGINT NOT NULL,
  PermissionName VARCHAR(100) NOT NULL,
  PermissionDescription VARCHAR(500) NULL,
  CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
  CONSTRAINT UQ_Role_Permission UNIQUE (RoleID, PermissionName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS EmployeeRoles (
  EmployeeRoleID BIGINT AUTO_INCREMENT PRIMARY KEY,
  EmployeeID BIGINT NOT NULL,
  RoleID BIGINT NOT NULL,
  CONSTRAINT FK_EmployeeRoles_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE,
  CONSTRAINT FK_EmployeeRoles_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
  CONSTRAINT UQ_Employee_Role UNIQUE (EmployeeID, RoleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Catalog: Units, ProductCategories, ProductBrands, Products
-- =========================
CREATE TABLE IF NOT EXISTS UnitsOfMeasure (
  UnitID BIGINT AUTO_INCREMENT PRIMARY KEY,
  UnitName VARCHAR(50) NOT NULL UNIQUE,
  Abbreviation VARCHAR(10) NOT NULL UNIQUE,
  IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductCategories (
  ProductCategoryID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  CategoryName VARCHAR(200) NOT NULL,
  ParentCategoryID BIGINT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_ProductCategories_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_ProductCategories_Parent FOREIGN KEY (ParentCategoryID) REFERENCES ProductCategories(ProductCategoryID),
  CONSTRAINT UQ_ProductCategory UNIQUE (CompanyID, CategoryName, ParentCategoryID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductBrands (
  ProductBrandID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  BrandName VARCHAR(200) NOT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_ProductBrands_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_ProductBrand UNIQUE (CompanyID, BrandName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS TaxRates (
  TaxRateID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  Name VARCHAR(100) NOT NULL,
  RatePercentage DECIMAL(8,3) NOT NULL DEFAULT 0,
  AppliesTo ENUM('goods','services','all') NOT NULL DEFAULT 'all',
  IsDefault TINYINT(1) NOT NULL DEFAULT 0,
  EffectiveFrom DATETIME NULL,
  EffectiveTo DATETIME NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TaxRates_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_TaxRates_Company_Name UNIQUE (CompanyID, Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Products (
  ProductID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  SKU VARCHAR(100) NOT NULL,
  ProductName VARCHAR(255) NOT NULL,
  Description LONGTEXT NULL,
  ProductCategoryID BIGINT NULL,
  ProductBrandID BIGINT NULL,
  UnitID BIGINT NOT NULL,
  CostPrice DECIMAL(18,4) DEFAULT 0,
  SellingPrice DECIMAL(18,4) DEFAULT 0,
  IsTaxable TINYINT(1) DEFAULT 1,
  IsService TINYINT(1) DEFAULT 0,
  Barcode VARCHAR(100) NULL,
  TaxRateID BIGINT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_Products_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_Products_ProductCategory FOREIGN KEY (ProductCategoryID) REFERENCES ProductCategories(ProductCategoryID),
  CONSTRAINT FK_Products_ProductBrand FOREIGN KEY (ProductBrandID) REFERENCES ProductBrands(ProductBrandID),
  CONSTRAINT FK_Products_Unit FOREIGN KEY (UnitID) REFERENCES UnitsOfMeasure(UnitID),
  CONSTRAINT FK_Products_TaxRate FOREIGN KEY (TaxRateID) REFERENCES TaxRates(TaxRateID),
  CONSTRAINT UQ_Product_Company_SKU UNIQUE (CompanyID, SKU)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductImages (
  ProductImageID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ProductID BIGINT NOT NULL,
  ImageUrl VARCHAR(500) NOT NULL,
  AltText VARCHAR(255) NULL,
  SortOrder INT NOT NULL DEFAULT 0,
  IsPrimary TINYINT(1) NOT NULL DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_ProductImages_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductCustomFieldDefinitions (
  ProductCustomFieldDefinitionID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  FieldName VARCHAR(100) NOT NULL,
  DataType VARCHAR(20) NOT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_CFDefinitions_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_CFDefinitions UNIQUE (CompanyID, FieldName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductCustomFieldOptions (
  OptionID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ProductCustomFieldDefinitionID BIGINT NOT NULL,
  OptionValue VARCHAR(255) NOT NULL,
  CONSTRAINT FK_CFOptions_Def FOREIGN KEY (ProductCustomFieldDefinitionID) REFERENCES ProductCustomFieldDefinitions(ProductCustomFieldDefinitionID) ON DELETE CASCADE,
  CONSTRAINT UQ_CFOptions UNIQUE (ProductCustomFieldDefinitionID, OptionValue)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductCustomFieldValues (
  ProductCustomFieldValueID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ProductID BIGINT NOT NULL,
  ProductCustomFieldDefinitionID BIGINT NOT NULL,
  ValueText LONGTEXT NULL,
  ValueNumber DECIMAL(18,4) NULL,
  ValueBoolean TINYINT(1) NULL,
  ValueDate DATE NULL,
  ValueJSON LONGTEXT NULL,
  CONSTRAINT FK_CFValues_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
  CONSTRAINT FK_CFValues_Def FOREIGN KEY (ProductCustomFieldDefinitionID) REFERENCES ProductCustomFieldDefinitions(ProductCustomFieldDefinitionID) ON DELETE CASCADE,
  CONSTRAINT UQ_CFValues UNIQUE (ProductID, ProductCustomFieldDefinitionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Pricing & Promotions
-- =========================
CREATE TABLE IF NOT EXISTS PriceLists (
  PriceListID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  Name VARCHAR(255) NOT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_PriceLists_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_PriceLists UNIQUE (CompanyID, Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS PriceListItems (
  PriceListItemID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PriceListID BIGINT NOT NULL,
  ProductID BIGINT NOT NULL,
  MinQty DECIMAL(18,4) NOT NULL DEFAULT 1,
  Price DECIMAL(18,4) NOT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_PriceListItems_List FOREIGN KEY (PriceListID) REFERENCES PriceLists(PriceListID) ON DELETE CASCADE,
  CONSTRAINT FK_PriceListItems_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
  CONSTRAINT UQ_PriceListItem UNIQUE (PriceListID, ProductID, MinQty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotions (
  PromotionID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  Name VARCHAR(200) NOT NULL,
  Code VARCHAR(100) NULL UNIQUE,
  Description TEXT NULL,
  Type ENUM('percent','amount','bogo','bundle','shipping') NOT NULL DEFAULT 'percent',
  Value DECIMAL(18,4) NOT NULL DEFAULT 0,
  UnitPrice DECIMAL(18,4) NULL,
  Enabled TINYINT(1) NOT NULL DEFAULT 1,
  Stackable TINYINT(1) NOT NULL DEFAULT 1,
  Priority INT NOT NULL DEFAULT 100,
  MinQuantity INT NULL,
  PerOrderLimit INT NULL,
  PerCustomerLimit INT NULL,
  TotalRedemptions INT NULL,
  StartAt DATETIME NULL,
  EndAt DATETIME NULL,
  Timezone VARCHAR(100) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_Promotions_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  INDEX IX_Promotions_Company (CompanyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_scopes (
  PromotionScopeID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PromotionID BIGINT NOT NULL,
  ScopeType ENUM('product','category','brand','customer','employee','custom_field','channel','day') NOT NULL,
  ScopeValue VARCHAR(255) NOT NULL,
  FOREIGN KEY (PromotionID) REFERENCES promotions(PromotionID) ON DELETE CASCADE,
  INDEX idx_promo_scope (PromotionID, ScopeType, ScopeValue)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_usages (
  PromotionUsageID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PromotionID BIGINT NOT NULL,
  OrderID BIGINT NULL,
  CustomerID BIGINT NULL,
  UsedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  QuantityApplied INT NULL,
  FOREIGN KEY (PromotionID) REFERENCES promotions(PromotionID) ON DELETE CASCADE,
  INDEX idx_usage_promo (PromotionID),
  INDEX idx_usage_customer (CustomerID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Customers / Vendors
-- =========================
CREATE TABLE IF NOT EXISTS CustomerGroups (
  CustomerGroupID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  GroupName VARCHAR(100) NOT NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_CustomerGroups_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_CustomerGroups UNIQUE (CompanyID, GroupName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Customers (
  CustomerID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  CustomerName VARCHAR(255) NOT NULL,
  ContactPerson VARCHAR(150) NULL,
  Email VARCHAR(255) NULL,
  PhoneNumber VARCHAR(50) NULL,
  TaxID VARCHAR(50) NULL,
  BillingAddressLine1 VARCHAR(255) NULL,
  BillingCity VARCHAR(100) NULL,
  ShippingAddressLine1 VARCHAR(255) NULL,
  ShippingCity VARCHAR(100) NULL,
  CustomerGroupID BIGINT NULL,
  CreditLimit DECIMAL(18,2) DEFAULT 0,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Customers_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_Customers_Group FOREIGN KEY (CustomerGroupID) REFERENCES CustomerGroups(CustomerGroupID),
  CONSTRAINT UQ_Customer_Company_TaxID UNIQUE (CompanyID, TaxID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Suppliers (
  SupplierID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  SupplierName VARCHAR(255) NOT NULL,
  ContactPerson VARCHAR(150) NULL,
  Email VARCHAR(255) NULL,
  PhoneNumber VARCHAR(50) NULL,
  TaxID VARCHAR(50) NULL,
  AddressLine1 VARCHAR(255) NULL,
  City VARCHAR(100) NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Suppliers_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_Supplier_Company_TaxID UNIQUE (CompanyID, TaxID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Warehouses & Inventory
-- =========================
CREATE TABLE IF NOT EXISTS Warehouses (
  WarehouseID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  WarehouseName VARCHAR(100) NOT NULL,
  AddressLine1 VARCHAR(255) NULL,
  City VARCHAR(100) NULL,
  IsPrimary TINYINT(1) DEFAULT 0,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Warehouses_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_Warehouse_Company_Name UNIQUE (CompanyID, WarehouseName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ProductInventoryLevels (
  ProductInventoryLevelID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ProductID BIGINT NOT NULL,
  WarehouseID BIGINT NOT NULL,
  StockQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  ReservedQuantity DECIMAL(18,4) DEFAULT 0,
  MinStockLevel DECIMAL(18,4) NULL,
  MaxStockLevel DECIMAL(18,4) NULL,
  LastUpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_InventoryLevels_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
  CONSTRAINT FK_InventoryLevels_Warehouse FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID) ON DELETE CASCADE,
  CONSTRAINT UQ_Product_Warehouse UNIQUE (ProductID, WarehouseID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS InventoryTransactions (
  InventoryTransactionID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  ProductID BIGINT NOT NULL,
  WarehouseID BIGINT NOT NULL,
  TransactionType VARCHAR(50) NOT NULL,
  QuantityChange DECIMAL(18,4) NOT NULL,
  TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  ReferenceDocumentType VARCHAR(50) NULL,
  ReferenceDocumentID BIGINT NULL,
  Notes VARCHAR(500),
  EmployeeID BIGINT NULL,
  CONSTRAINT FK_InvTx_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_InvTx_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
  CONSTRAINT FK_InvTx_Warehouse FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID),
  CONSTRAINT FK_InvTx_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Sales & Tickets
-- =========================
CREATE TABLE IF NOT EXISTS DocumentSequences (
  DocumentSequenceID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  DocumentType VARCHAR(50) NOT NULL,
  Prefix VARCHAR(20) NULL,
  NextNumber BIGINT NOT NULL DEFAULT 1,
  Suffix VARCHAR(20) NULL,
  IsElectronic TINYINT(1) DEFAULT 1,
  RangeStart BIGINT NULL,
  RangeEnd BIGINT NULL,
  LastUsedAt DATETIME NULL,
  IsActive TINYINT(1) DEFAULT 1,
  CONSTRAINT FK_DocumentSequences_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT UQ_DocumentSequences UNIQUE (CompanyID, DocumentType, IsElectronic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Sales (
  SaleID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  CustomerID BIGINT NULL,
  EmployeeID BIGINT NOT NULL,
  SaleDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  DocumentType VARCHAR(50) NOT NULL,
  DocumentNumber VARCHAR(50) NOT NULL,
  IsExenta TINYINT(1) DEFAULT 0 NOT NULL,
  OriginalSaleID BIGINT NULL,
  GeneratedFromGuiaID BIGINT NULL,
  TotalAmount DECIMAL(18,4) NOT NULL,
  DiscountAmountTotal DECIMAL(18,4) DEFAULT 0,
  TaxAmountTotal DECIMAL(18,4) DEFAULT 0,
  FinalAmount DECIMAL(18,4) DEFAULT 0,
  AmountPaid DECIMAL(18,4) DEFAULT 0,
  PaymentStatus VARCHAR(50) DEFAULT 'Unpaid',
  CurrencyID INT NOT NULL DEFAULT 1,
  Status VARCHAR(50) DEFAULT 'Draft',
  Notes VARCHAR(1000),
  ShippingAddress VARCHAR(500),
  BillingAddress VARCHAR(500),
  MarketplaceOrderID_External VARCHAR(255) NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_Sales_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_Sales_Customer FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
  CONSTRAINT FK_Sales_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
  CONSTRAINT FK_Sales_Currency FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
  CONSTRAINT UQ_Sales UNIQUE (CompanyID, DocumentType, DocumentNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SalesItems (
  SalesItemID BIGINT AUTO_INCREMENT PRIMARY KEY,
  SaleID BIGINT NOT NULL,
  ProductID BIGINT NOT NULL,
  Description VARCHAR(500) NULL,
  Quantity DECIMAL(18,4) NOT NULL,
  UnitPrice DECIMAL(18,4) NOT NULL,
  DiscountPercentage DECIMAL(5,2) DEFAULT 0,
  DiscountAmountItem DECIMAL(18,4) DEFAULT 0,
  TaxRatePercentage DECIMAL(5,2) DEFAULT 0,
  TaxAmountItem DECIMAL(18,4) DEFAULT 0,
  LineTotal DECIMAL(18,4) DEFAULT 0,
  IsLineExenta TINYINT(1) DEFAULT 0,
  ProductLotID BIGINT NULL,
  ProductSerialID BIGINT NULL,
  TaxRateID BIGINT NULL,
  CONSTRAINT FK_SalesItems_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
  CONSTRAINT FK_SalesItems_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
  CONSTRAINT FK_SalesItems_TaxRate FOREIGN KEY (TaxRateID) REFERENCES TaxRates(TaxRateID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS PaymentMethods (
  PaymentMethodID BIGINT AUTO_INCREMENT PRIMARY KEY,
  MethodName VARCHAR(100) NOT NULL UNIQUE,
  IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SalesPayments (
  SalesPaymentID BIGINT AUTO_INCREMENT PRIMARY KEY,
  SaleID BIGINT NOT NULL,
  PaymentMethodID BIGINT NOT NULL,
  Amount DECIMAL(18,4) NOT NULL,
  PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  ReferenceNumber VARCHAR(100) NULL,
  CONSTRAINT FK_SalesPayments_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
  CONSTRAINT FK_SalesPayments_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Purchasing (minimal)
-- =========================
CREATE TABLE IF NOT EXISTS PurchaseOrders (
  PurchaseOrderID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  SupplierID BIGINT NOT NULL,
  OrderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  ExpectedDeliveryDate DATETIME NULL,
  PurchaseOrderNumber VARCHAR(50) NOT NULL,
  Status VARCHAR(50) DEFAULT 'Draft',
  TotalAmount DECIMAL(18,4) DEFAULT 0,
  Notes VARCHAR(1000),
  ShippingAddress VARCHAR(500),
  CreatedByEmployeeID BIGINT NULL,
  CONSTRAINT FK_PO_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_PO_Supplier FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
  CONSTRAINT FK_PO_Employee FOREIGN KEY (CreatedByEmployeeID) REFERENCES Employees(EmployeeID),
  CONSTRAINT UQ_PO_Number UNIQUE (CompanyID, PurchaseOrderNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS PurchaseOrderItems (
  PurchaseOrderItemID BIGINT AUTO_INCREMENT PRIMARY KEY,
  PurchaseOrderID BIGINT NOT NULL,
  ProductID BIGINT NOT NULL,
  Description VARCHAR(500),
  Quantity DECIMAL(18,4) NOT NULL,
  UnitPrice DECIMAL(18,4) NOT NULL,
  TaxAmount DECIMAL(18,4) DEFAULT 0,
  CONSTRAINT FK_POItems_PO FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID) ON DELETE CASCADE,
  CONSTRAINT FK_POItems_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS GoodsReceipts (
  GoodsReceiptID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  PurchaseOrderID BIGINT NULL,
  SupplierID BIGINT NOT NULL,
  ReceiptDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  ReceiptNumber VARCHAR(50) NOT NULL,
  Notes VARCHAR(1000),
  ReceivedByEmployeeID BIGINT NULL,
  CONSTRAINT FK_GR_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_GR_PO FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
  CONSTRAINT FK_GR_Supplier FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
  CONSTRAINT FK_GR_Employee FOREIGN KEY (ReceivedByEmployeeID) REFERENCES Employees(EmployeeID),
  CONSTRAINT UQ_GR_Number UNIQUE (CompanyID, ReceiptNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS GoodsReceiptItems (
  GoodsReceiptItemID BIGINT AUTO_INCREMENT PRIMARY KEY,
  GoodsReceiptID BIGINT NOT NULL,
  PurchaseOrderItemID BIGINT NULL,
  ProductID BIGINT NOT NULL,
  QuantityReceived DECIMAL(18,4) NOT NULL,
  UnitPrice DECIMAL(18,4) NULL,
  Notes VARCHAR(500),
  CONSTRAINT FK_GRItems_GR FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID) ON DELETE CASCADE,
  CONSTRAINT FK_GRItems_POItem FOREIGN KEY (PurchaseOrderItemID) REFERENCES PurchaseOrderItems(PurchaseOrderItemID),
  CONSTRAINT FK_GRItems_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SupplierInvoices (
  SupplierInvoiceID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  SupplierID BIGINT NOT NULL,
  DocumentType VARCHAR(50) NOT NULL,
  InvoiceNumber_Supplier VARCHAR(100) NOT NULL,
  IsSupplierDocExenta TINYINT(1) DEFAULT 0 NOT NULL,
  InvoiceDate DATE NOT NULL,
  DueDate DATE NULL,
  TotalAmount DECIMAL(18,4) NOT NULL,
  TaxAmount DECIMAL(18,4) DEFAULT 0,
  AmountPaid DECIMAL(18,4) DEFAULT 0,
  Status VARCHAR(50) DEFAULT 'Unpaid',
  PurchaseOrderID BIGINT NULL,
  GoodsReceiptID BIGINT NULL,
  OriginalSupplierInvoiceID BIGINT NULL,
  Notes VARCHAR(1000),
  CONSTRAINT FK_SI_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_SI_Supplier FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
  CONSTRAINT FK_SI_PO FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
  CONSTRAINT FK_SI_GR FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID),
  CONSTRAINT FK_SI_Original FOREIGN KEY (OriginalSupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID),
  CONSTRAINT UQ_SI UNIQUE (CompanyID, SupplierID, InvoiceNumber_Supplier, DocumentType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SupplierInvoiceItems (
  SupplierInvoiceItemID BIGINT AUTO_INCREMENT PRIMARY KEY,
  SupplierInvoiceID BIGINT NOT NULL,
  ProductID BIGINT NULL,
  Description VARCHAR(500) NOT NULL,
  Quantity DECIMAL(18,4) NOT NULL,
  UnitPrice DECIMAL(18,4) NOT NULL,
  TaxAmountItem DECIMAL(18,4) DEFAULT 0,
  LineTotal DECIMAL(18,4) DEFAULT 0,
  CONSTRAINT FK_SII_Invoice FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
  CONSTRAINT FK_SII_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SupplierPayments (
  SupplierPaymentID BIGINT AUTO_INCREMENT PRIMARY KEY,
  CompanyID BIGINT NOT NULL,
  SupplierID BIGINT NOT NULL,
  PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  AmountPaid DECIMAL(18,4) NOT NULL,
  PaymentMethodID BIGINT NOT NULL,
  ReferenceNumber VARCHAR(100) NULL,
  Notes VARCHAR(500),
  ProcessedByEmployeeID BIGINT NULL,
  CONSTRAINT FK_SP_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
  CONSTRAINT FK_SP_Supplier FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
  CONSTRAINT FK_SP_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
  CONSTRAINT FK_SP_Employee FOREIGN KEY (ProcessedByEmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SupplierPaymentAllocations (
  SupplierPaymentAllocationID BIGINT AUTO_INCREMENT PRIMARY KEY,
  SupplierPaymentID BIGINT NOT NULL,
  SupplierInvoiceID BIGINT NOT NULL,
  AmountAllocated DECIMAL(18,4) NOT NULL,
  AllocationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_SPA_Payment FOREIGN KEY (SupplierPaymentID) REFERENCES SupplierPayments(SupplierPaymentID) ON DELETE CASCADE,
  CONSTRAINT FK_SPA_Invoice FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
  CONSTRAINT UQ_SPA UNIQUE (SupplierPaymentID, SupplierInvoiceID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
