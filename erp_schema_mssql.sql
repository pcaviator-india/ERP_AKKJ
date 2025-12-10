
-- =======================================================================
-- Author: Jitendra Khatri & ChatGPT
-- Date: 2025-10-30
-- Notes:
-- - This script is a full schema (not a patch). Run on a new database.
-- - Includes: Multi-tenant core, DTE/SII, POS, Inventory, Purchasing,
--   Accounting, HR, Manufacturing (basic), Marketplaces, Payments,
--   E-commerce gateways, Books (Libros), Background Jobs, and API logging.
-- =======================================================================

SET NOCOUNT ON;

-- =======================================================================
-- 0. UTILITY TYPES
-- =======================================================================
-- (Add user-defined table types or enums if needed later)

-- =======================================================================
-- I. FOUNDATION & CORE TABLES
-- =======================================================================

CREATE TABLE Currencies (
    CurrencyID INT IDENTITY(1,1) PRIMARY KEY,
    CurrencyCode CHAR(3) NOT NULL UNIQUE, -- ISO 4217 ('CLP', 'USD')
    CurrencyName NVARCHAR(100) NOT NULL,
    Symbol NVARCHAR(10) NULL,
    DecimalPlaces INT DEFAULT 0,
    IsActive BIT DEFAULT 1
);

CREATE TABLE ExchangeRates (
    ExchangeRateID INT IDENTITY(1,1) PRIMARY KEY,
    BaseCurrencyID INT NOT NULL,         -- e.g., CLP
    QuoteCurrencyID INT NOT NULL,        -- e.g., USD
    Rate DECIMAL(18,8) NOT NULL,
    RateDate DATE NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ExchangeRates_Base FOREIGN KEY (BaseCurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT FK_ExchangeRates_Quote FOREIGN KEY (QuoteCurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_ExchangeRates UNIQUE (BaseCurrencyID, QuoteCurrencyID, RateDate)
);

CREATE TABLE Companies (
    CompanyID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyName NVARCHAR(255) NOT NULL,
    LegalName NVARCHAR(255) NULL,
    TaxID NVARCHAR(50) NULL, -- RUT for Chile
    AddressLine1 NVARCHAR(255) NULL,
    AddressLine2 NVARCHAR(255) NULL,
    City NVARCHAR(100) NULL,
    StateOrProvince NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    CountryCode CHAR(2) NULL, -- ISO 3166-1 Alpha-2
    PhoneNumber NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    Website NVARCHAR(255) NULL,
    LogoURL NVARCHAR(500) NULL,
    DefaultCurrencyID INT NULL, -- FK to Currencies
    DefaultLanguageCode CHAR(2) DEFAULT 'ES', -- ISO 639-1
    SiiEnvironment NVARCHAR(20) DEFAULT 'Certificacion' CHECK (SiiEnvironment IN ('Certificacion','Produccion')),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Companies_DefaultCurrency FOREIGN KEY (DefaultCurrencyID) REFERENCES Currencies(CurrencyID)
);

CREATE TABLE CompanyCurrencies (
    CompanyCurrencyID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CurrencyID INT NOT NULL,
    IsDefaultOperatingCurrency BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_CompanyCurrencies_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyCurrencies_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_CompanyCurrency UNIQUE (CompanyID, CurrencyID)
);

CREATE TABLE UnitsOfMeasure (
    UnitID INT IDENTITY(1,1) PRIMARY KEY,
    UnitName NVARCHAR(50) NOT NULL UNIQUE, -- 'Piece', 'Kg', 'Box', 'Pack'
    Abbreviation NVARCHAR(10) NOT NULL UNIQUE,
    IsActive BIT DEFAULT 1
);

CREATE TABLE PaymentMethods (
    PaymentMethodID INT IDENTITY(1,1) PRIMARY KEY,
    MethodName NVARCHAR(100) NOT NULL UNIQUE, -- 'Cash','Bank Transfer','Credit Card','Transbank','MercadoPago','Flow'
    IsActive BIT DEFAULT 1
);

CREATE TABLE Employees ( -- Can also serve as Users
    EmployeeID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL, -- Used for login
    PasswordHash NVARCHAR(MAX) NOT NULL,
    PhoneNumber NVARCHAR(50) NULL,
    JobTitle NVARCHAR(100) NULL,
    DepartmentID INT NULL,
    ReportsToEmployeeID INT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    LastLoginAt DATETIME2 NULL,
    CONSTRAINT FK_Employees_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Employees_ReportsTo FOREIGN KEY (ReportsToEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_Employee_Company_Email UNIQUE (CompanyID, Email)
);

CREATE TABLE Roles (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    RoleName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    CONSTRAINT FK_Roles_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Role_Company_Name UNIQUE (CompanyID, RoleName)
);

CREATE TABLE RolePermissions (
    RolePermissionID INT IDENTITY(1,1) PRIMARY KEY,
    RoleID INT NOT NULL,
    PermissionName NVARCHAR(100) NOT NULL,
    PermissionDescription NVARCHAR(500),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
    CONSTRAINT UQ_Role_Permission UNIQUE (RoleID, PermissionName)
);

CREATE TABLE EmployeeRoles (
    EmployeeRoleID INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeID INT NOT NULL,
    RoleID INT NOT NULL,
    CONSTRAINT FK_EmployeeRoles_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE,
    CONSTRAINT FK_EmployeeRoles_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
    CONSTRAINT UQ_Employee_Role UNIQUE (EmployeeID, RoleID)
);

-- =======================================================================
-- II. SYSTEM, ADMINISTRATION & SECURITY
-- =======================================================================

CREATE TABLE SystemSettings (
    SystemSettingID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL,
    SettingKey NVARCHAR(100) NOT NULL,
    SettingValue NVARCHAR(MAX) NOT NULL,
    Description NVARCHAR(500),
    DataType NVARCHAR(50) DEFAULT 'String' CHECK (DataType IN ('String', 'Integer', 'Boolean', 'JSON', 'Decimal')),
    IsEditableByTenant BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SystemSettings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_SystemSettings_Key UNIQUE (CompanyID, SettingKey)
);

CREATE TABLE AuditLogs (
    AuditLogID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL,
    UserID INT NULL, -- FK to Employees.EmployeeID
    Timestamp DATETIME2 DEFAULT GETDATE(),
    EntityType NVARCHAR(100) NOT NULL,
    EntityID NVARCHAR(255) NULL,
    Action NVARCHAR(50) NOT NULL, -- 'Create','Update','Delete','Login','ViewDTE'
    OldValues NVARCHAR(MAX) NULL,
    NewValues NVARCHAR(MAX) NULL,
    IPAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    Notes NVARCHAR(1000),
    CONSTRAINT FK_AuditLogs_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE POSUserSettings (
    POSUserSettingID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    UserID INT NOT NULL,
    WorkstationIdentifier NVARCHAR(255) NULL,
    SettingName NVARCHAR(100) NOT NULL,
    SettingValue NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_POSUserSettings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_POSUserSettings_Users FOREIGN KEY (UserID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE,
    CONSTRAINT UQ_POSUser_Setting UNIQUE (CompanyID, UserID, WorkstationIdentifier, SettingName)
);

CREATE TABLE DigitalCertificates ( -- For DTE signing
    DigitalCertificateID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CertSerial NVARCHAR(200) NOT NULL,
    ValidFrom DATETIME2 NOT NULL,
    ValidTo DATETIME2 NOT NULL,
    CertFileEncrypted VARBINARY(MAX) NOT NULL,
    CertPasswordEncrypted VARBINARY(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_DigitalCertificates_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_DigitalCertificates UNIQUE (CompanyID, CertSerial)
);

CREATE TABLE LoginSessions (
    LoginSessionID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    EmployeeID INT NOT NULL,
    SessionToken VARBINARY(MAX) NOT NULL,
    IssuedAt DATETIME2 DEFAULT GETDATE(),
    ExpiresAt DATETIME2 NULL,
    RevokedAt DATETIME2 NULL,
    IPAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    CONSTRAINT FK_LoginSessions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_LoginSessions_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
);

-- =======================================================================
-- III. SUBSCRIPTION, MODULE & USAGE MANAGEMENT
-- =======================================================================

CREATE TABLE SubscriptionPlans (
    PlanID INT IDENTITY(1,1) PRIMARY KEY,
    PlanName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(1000),
    BasePrice DECIMAL(10,2) NOT NULL,
    PlanCurrencyID INT NOT NULL,
    BillingCycle NVARCHAR(20) NOT NULL CHECK (BillingCycle IN ('Monthly', 'Annually', 'OneTime')),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SubscriptionPlans_Currency FOREIGN KEY (PlanCurrencyID) REFERENCES Currencies(CurrencyID)
);

CREATE TABLE Modules (
    ModuleID INT IDENTITY(1,1) PRIMARY KEY,
    ModuleCode NVARCHAR(50) NOT NULL UNIQUE,
    ModuleName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(1000),
    IsStandAloneAddon BIT DEFAULT 0,
    AddonPrice DECIMAL(10,2) NULL,
    DefaultBillingCycle NVARCHAR(20) NULL CHECK (DefaultBillingCycle IN ('Monthly', 'Annually', 'OneTime')),
    CreatedAt DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE PlanModules (
    PlanModuleID INT IDENTITY(1,1) PRIMARY KEY,
    PlanID INT NOT NULL,
    ModuleID INT NOT NULL,
    CONSTRAINT FK_PlanModules_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID) ON DELETE CASCADE,
    CONSTRAINT FK_PlanModules_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID) ON DELETE CASCADE,
    CONSTRAINT UQ_PlanModule UNIQUE (PlanID, ModuleID)
);

CREATE TABLE CompanySubscriptions (
    CompanySubscriptionID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL UNIQUE,
    PlanID INT NOT NULL,
    StartDate DATETIME2 NOT NULL,
    EndDate DATETIME2 NULL,
    NextBillingDate DATE NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Active' CHECK (Status IN ('Active', 'Trial', 'PastDue', 'Cancelled', 'Expired')),
    TrialEndDate DATE NULL,
    AutoRenew BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_CompanySubscriptions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanySubscriptions_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID)
);

CREATE TABLE CompanySubscribedAddons (
    CompanySubscribedAddonID INT IDENTITY(1,1) PRIMARY KEY,
    CompanySubscriptionID INT NOT NULL,
    ModuleID INT NOT NULL,
    SubscribedDate DATETIME2 DEFAULT GETDATE(),
    PriceAtSubscription DECIMAL(10,2) NOT NULL,
    BillingCycle NVARCHAR(20) NOT NULL,
    NextBillingDateForAddon DATE NULL,
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_CompanySubscribedAddons_Subscriptions FOREIGN KEY (CompanySubscriptionID) REFERENCES CompanySubscriptions(CompanySubscriptionID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanySubscribedAddons_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID),
    CONSTRAINT UQ_CompanySubscription_ModuleAddon UNIQUE (CompanySubscriptionID, ModuleID)
);

CREATE TABLE FeatureLimits (
    FeatureLimitID INT IDENTITY(1,1) PRIMARY KEY,
    LimitName NVARCHAR(100) NOT NULL UNIQUE, -- 'MaxProducts','MaxWarehouses','MaxUsers','MaxMarketplaceConnections'
    Description NVARCHAR(500),
    UnitOfMeasure NVARCHAR(50), -- 'Count','GB'
    DefaultValue BIGINT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE PlanFeatureLimits (
    PlanFeatureLimitID INT IDENTITY(1,1) PRIMARY KEY,
    PlanID INT NOT NULL,
    FeatureLimitID INT NOT NULL,
    LimitValue BIGINT NOT NULL,
    OverageCharge DECIMAL(10,4) NULL,
    OverageUnit BIGINT NULL,
    EnforcementType NVARCHAR(20) DEFAULT 'Soft' CHECK (EnforcementType IN ('Soft', 'Hard', 'Notify')),
    CONSTRAINT FK_PlanFeatureLimits_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID) ON DELETE CASCADE,
    CONSTRAINT FK_PlanFeatureLimits_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID),
    CONSTRAINT UQ_Plan_FeatureLimit UNIQUE (PlanID, FeatureLimitID)
);

CREATE TABLE CompanyCustomFeatureLimits (
    CompanyCustomFeatureLimitID INT IDENTITY(1,1) PRIMARY KEY,
    CompanySubscriptionID INT NOT NULL,
    ModuleID INT NULL,
    FeatureLimitID INT NOT NULL,
    CustomLimitValue BIGINT NOT NULL,
    CustomOverageCharge DECIMAL(10,4) NULL,
    CustomOverageUnit BIGINT NULL,
    CustomEnforcementType NVARCHAR(20) NULL CHECK (CustomEnforcementType IN ('Soft', 'Hard', 'Notify')),
    EffectiveDate DATE DEFAULT GETDATE(),
    ExpiryDate DATE NULL,
    CONSTRAINT FK_CompanyCustomFeatureLimits_Subscriptions FOREIGN KEY (CompanySubscriptionID) REFERENCES CompanySubscriptions(CompanySubscriptionID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyCustomFeatureLimits_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID),
    CONSTRAINT FK_CompanyCustomFeatureLimits_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID),
    CONSTRAINT UQ_CompanySubscription_Feature_Module_Limit UNIQUE (CompanySubscriptionID, FeatureLimitID, ModuleID)
);

CREATE TABLE CompanyUsageRecords (
    CompanyUsageRecordID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    FeatureLimitID INT NOT NULL,
    BillingPeriodStartDate DATE NOT NULL,
    BillingPeriodEndDate DATE NOT NULL,
    CurrentUsage BIGINT NOT NULL,
    PeakUsage BIGINT NULL,
    RecordedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_CompanyUsageRecords_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyUsageRecords_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID)
);

-- =======================================================================
-- IV. PRODUCT & INVENTORY MANAGEMENT
-- =======================================================================

CREATE TABLE ProductCategories (
    ProductCategoryID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CategoryName NVARCHAR(100) NOT NULL,
    ParentCategoryID INT NULL,
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_ProductCategories_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductCategories_Parent FOREIGN KEY (ParentCategoryID) REFERENCES ProductCategories(ProductCategoryID),
    CONSTRAINT UQ_ProductCategory_Company_Name UNIQUE (CompanyID, CategoryName, ParentCategoryID)
);

CREATE TABLE ProductBrands (
    ProductBrandID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    BrandName NVARCHAR(100) NOT NULL,
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_ProductBrands_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductBrand_Company_Name UNIQUE (CompanyID, BrandName)
);

CREATE TABLE Products (
    ProductID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SKU NVARCHAR(100) NOT NULL,
    ProductName NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    ProductCategoryID INT NULL,
    ProductBrandID INT NULL,
    UnitID INT NOT NULL,
    CostPrice DECIMAL(18,4) DEFAULT 0,
    SellingPrice DECIMAL(18,4) DEFAULT 0,
    IsTaxable BIT DEFAULT 1,
    IsService BIT DEFAULT 0,
    Weight DECIMAL(10,3) NULL,
    WeightUnitID INT NULL,
    Length DECIMAL(10,3) NULL,
    Width DECIMAL(10,3) NULL,
    Height DECIMAL(10,3) NULL,
    DimensionUnitID INT NULL,
    ImageURL NVARCHAR(500) NULL,
    Barcode NVARCHAR(100) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Products_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Products_Categories FOREIGN KEY (ProductCategoryID) REFERENCES ProductCategories(ProductCategoryID),
    CONSTRAINT FK_Products_Brands FOREIGN KEY (ProductBrandID) REFERENCES ProductBrands(ProductBrandID),
    CONSTRAINT FK_Products_Unit FOREIGN KEY (UnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT FK_Products_WeightUnit FOREIGN KEY (WeightUnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT FK_Products_DimensionUnit FOREIGN KEY (DimensionUnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT UQ_Product_Company_SKU UNIQUE (CompanyID, SKU)
);

-- Custom fields (dynamic attributes)
CREATE TABLE ProductCustomFieldDefinitions (
    ProductCustomFieldDefinitionID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    FieldName NVARCHAR(100) NOT NULL,
    DataType NVARCHAR(20) NOT NULL CHECK (DataType IN ('Text','Number','Boolean','Date','JSON')),
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_ProductCFD_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductCFD UNIQUE (CompanyID, FieldName)
);

CREATE TABLE ProductCustomFieldValues (
    ProductCustomFieldValueID INT IDENTITY(1,1) PRIMARY KEY,
    ProductID INT NOT NULL,
    ProductCustomFieldDefinitionID INT NOT NULL,
    ValueText NVARCHAR(MAX) NULL,
    ValueNumber DECIMAL(18,4) NULL,
    ValueBoolean BIT NULL,
    ValueDate DATE NULL,
    ValueJSON NVARCHAR(MAX) NULL,
    CONSTRAINT FK_ProductCFV_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductCFV_Def FOREIGN KEY (ProductCustomFieldDefinitionID) REFERENCES ProductCustomFieldDefinitions(ProductCustomFieldDefinitionID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductCFV UNIQUE (ProductID, ProductCustomFieldDefinitionID)
);

-- Packs/kits
CREATE TABLE ProductPacks (
    ProductPackID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PackProductID INT NOT NULL,         -- The pack SKU
    ComponentProductID INT NOT NULL,    -- Component SKU
    ComponentQuantity DECIMAL(18,4) NOT NULL,
    CONSTRAINT FK_ProductPacks_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductPacks_PackProduct FOREIGN KEY (PackProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_ProductPacks_ComponentProduct FOREIGN KEY (ComponentProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductPacks UNIQUE (PackProductID, ComponentProductID)
);

-- Lots & Serial tracking
CREATE TABLE ProductLots (
    ProductLotID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    LotNumber NVARCHAR(100) NOT NULL,
    ExpirationDate DATE NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ProductLots_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductLots_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductLots UNIQUE (CompanyID, ProductID, LotNumber)
);

CREATE TABLE ProductSerials (
    ProductSerialID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    SerialNumber NVARCHAR(100) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'InStock' CHECK (Status IN ('InStock','Reserved','Sold','Returned','Scrapped')),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ProductSerials_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductSerials_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductSerials UNIQUE (CompanyID, ProductID, SerialNumber)
);

CREATE TABLE Warehouses (
    WarehouseID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    WarehouseName NVARCHAR(100) NOT NULL,
    AddressLine1 NVARCHAR(255) NULL,
    City NVARCHAR(100) NULL,
    IsDefault BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Warehouses_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Warehouse_Company_Name UNIQUE (CompanyID, WarehouseName)
);

CREATE TABLE ProductInventoryLevels (
    ProductInventoryLevelID INT IDENTITY(1,1) PRIMARY KEY,
    ProductID INT NOT NULL,
    WarehouseID INT NOT NULL,
    StockQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    ReservedQuantity DECIMAL(18,4) DEFAULT 0,
    AvailableQuantity AS (StockQuantity - ReservedQuantity) PERSISTED,
    MinStockLevel DECIMAL(18,4) NULL,
    MaxStockLevel DECIMAL(18,4) NULL,
    LastUpdatedAt DATETIME2 DEFAULT GETDATE(),
    ProductLotID INT NULL,
    CONSTRAINT FK_ProductInventoryLevels_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductInventoryLevels_Warehouses FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductInventoryLevels_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT UQ_Product_Warehouse_Inventory UNIQUE (ProductID, WarehouseID, ProductLotID)
);

CREATE TABLE InventoryTransactions (
    InventoryTransactionID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    WarehouseID INT NOT NULL,
    TransactionType NVARCHAR(50) NOT NULL, -- 'PurchaseReceipt','SaleShipment','AdjustmentIn','AdjustmentOut','TransferOut','TransferIn','ManufacturingConsumption','ManufacturingOutput'
    QuantityChange DECIMAL(18,4) NOT NULL,
    TransactionDate DATETIME2 DEFAULT GETDATE(),
    ReferenceDocumentType NVARCHAR(50) NULL,
    ReferenceDocumentID INT NULL,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    Notes NVARCHAR(500),
    EmployeeID INT NULL,
    CONSTRAINT FK_InventoryTransactions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_InventoryTransactions_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_InventoryTransactions_Warehouses FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID),
    CONSTRAINT FK_InventoryTransactions_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT FK_InventoryTransactions_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_InventoryTransactions_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID)
);

-- =======================================================================
-- V. CONTACTS MANAGEMENT (CUSTOMERS & SUPPLIERS)
-- =======================================================================

CREATE TABLE CustomerGroups (
    CustomerGroupID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    GroupName NVARCHAR(100) NOT NULL, -- Retail, Horeca, Distributor
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_CustomerGroups_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_CustomerGroups UNIQUE (CompanyID, GroupName)
);

CREATE TABLE Customers (
    CustomerID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerName NVARCHAR(255) NOT NULL,
    ContactPerson NVARCHAR(150) NULL,
    Email NVARCHAR(255) NULL,
    PhoneNumber NVARCHAR(50) NULL,
    TaxID NVARCHAR(50) NULL, -- RUT
    BillingAddressLine1 NVARCHAR(255) NULL,
    BillingCity NVARCHAR(100) NULL,
    ShippingAddressLine1 NVARCHAR(255) NULL,
    ShippingCity NVARCHAR(100) NULL,
    CustomerGroupID INT NULL,
    CreditLimit DECIMAL(18,2) DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Customers_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Customers_Group FOREIGN KEY (CustomerGroupID) REFERENCES CustomerGroups(CustomerGroupID),
    CONSTRAINT UQ_Customer_Company_TaxID UNIQUE (CompanyID, TaxID)
);

CREATE TABLE LoyaltyPoints (
    LoyaltyPointID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NOT NULL,
    PointsEarned INT DEFAULT 0,
    PointsRedeemed INT DEFAULT 0,
    Event NVARCHAR(100) NOT NULL, -- 'Purchase','Return','Adjustment'
    EventDate DATETIME2 DEFAULT GETDATE(),
    Notes NVARCHAR(500),
    CONSTRAINT FK_LoyaltyPoints_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_LoyaltyPoints_Customer FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);

CREATE TABLE Suppliers (
    SupplierID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierName NVARCHAR(255) NOT NULL,
    ContactPerson NVARCHAR(150) NULL,
    Email NVARCHAR(255) NULL,
    PhoneNumber NVARCHAR(50) NULL,
    TaxID NVARCHAR(50) NULL, -- RUT
    AddressLine1 NVARCHAR(255) NULL,
    City NVARCHAR(100) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Suppliers_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Supplier_Company_TaxID UNIQUE (CompanyID, TaxID)
);

-- =======================================================================
-- VI. SALES MODULE (CHILEAN LOCALIZATION)
-- =======================================================================

CREATE TABLE DocumentSequences ( -- Folios
    DocumentSequenceID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    DocumentType NVARCHAR(50) NOT NULL, -- 'FACTURA','BOLETA','GUIA_DESPACHO','NOTA_CREDITO','NOTA_DEBITO','FACTURA_EXENTA','BOLETA_EXENTA','COTIZACION'
    Prefix NVARCHAR(20) NULL,
    NextNumber BIGINT NOT NULL DEFAULT 1,
    Suffix NVARCHAR(20) NULL,
    FormatString NVARCHAR(100) NULL, -- e.g., '{YYYY}-{NNNNNN}'
    IsElectronic BIT DEFAULT 1,
    RangeStart BIGINT NULL,
    RangeEnd BIGINT NULL,
    LastUsedAt DATETIME2 NULL,
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_DocumentSequences_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_DocumentSequences_Company_Type_Electronic UNIQUE (CompanyID, DocumentType, IsElectronic)
);

-- CAF storage
CREATE TABLE SiiCAF (
    SiiCAFID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    DocumentType NVARCHAR(50) NOT NULL,
    RangeStart BIGINT NOT NULL,
    RangeEnd BIGINT NOT NULL,
    CAFXml XML NOT NULL,
    LoadedAt DATETIME2 DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_SiiCAF_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE
);

CREATE TABLE Sales (
    SaleID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NULL,
    EmployeeID INT NOT NULL,
    SaleDate DATETIME2 DEFAULT GETDATE(),
    DocumentType NVARCHAR(50) NOT NULL,
    DocumentNumber NVARCHAR(50) NOT NULL, -- Folio
    IsExenta BIT DEFAULT 0 NOT NULL,
    OriginalSaleID INT NULL,      -- For NC/ND
    GeneratedFromGuiaID INT NULL, -- Factura from Guia
    TotalAmount DECIMAL(18, 4) NOT NULL,
    DiscountAmountTotal DECIMAL(18,4) DEFAULT 0,
    SubTotal AS (TotalAmount - DiscountAmountTotal) PERSISTED,
    TaxAmountTotal DECIMAL(18, 4) DEFAULT 0,
    FinalAmount AS (TotalAmount - DiscountAmountTotal + TaxAmountTotal) PERSISTED,
    AmountPaid DECIMAL(18,4) DEFAULT 0,
    PaymentStatus NVARCHAR(50) DEFAULT 'Unpaid' CHECK (PaymentStatus IN ('Unpaid','PartiallyPaid','Paid','Overdue')),
    CurrencyID INT NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Draft', -- 'Draft','GuiaEmitida','Facturada','BoletaEmitida','Completada','Cancelada'
    Notes NVARCHAR(1000),
    ShippingAddress NVARCHAR(500),
    BillingAddress NVARCHAR(500),
    MarketplaceOrderID_External NVARCHAR(255) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Sales_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Sales_Customers FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT FK_Sales_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT FK_Sales_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT FK_Sales_OriginalSale FOREIGN KEY (OriginalSaleID) REFERENCES Sales(SaleID),
    CONSTRAINT FK_Sales_GeneratedFromGuia FOREIGN KEY (GeneratedFromGuiaID) REFERENCES Sales(SaleID),
    CONSTRAINT UQ_Sales_Company_DocType_DocNumber UNIQUE (CompanyID, DocumentType, DocumentNumber),
    CONSTRAINT CK_Sales_DocumentType CHECK (DocumentType IN ('FACTURA','BOLETA','GUIA_DESPACHO','NOTA_CREDITO','NOTA_DEBITO','FACTURA_EXENTA','BOLETA_EXENTA','COTIZACION')),
    CONSTRAINT CK_Sales_TaxAmount_Exenta CHECK ((IsExenta = 1 AND TaxAmountTotal = 0) OR (IsExenta = 0))
);

CREATE TABLE SalesItems (
    SalesItemID INT IDENTITY(1,1) PRIMARY KEY,
    SaleID INT NOT NULL,
    ProductID INT NOT NULL,
    Description NVARCHAR(500) NULL,
    Quantity DECIMAL(18, 4) NOT NULL,
    UnitPrice DECIMAL(18, 4) NOT NULL,
    DiscountPercentage DECIMAL(5,2) DEFAULT 0,
    DiscountAmountItem DECIMAL(18,4) DEFAULT 0,
    SubTotalItem AS (Quantity * UnitPrice - DiscountAmountItem) PERSISTED,
    TaxRatePercentage DECIMAL(5,2) DEFAULT 0,
    TaxAmountItem DECIMAL(18,4) DEFAULT 0,
    LineTotal AS (Quantity * UnitPrice - DiscountAmountItem + TaxAmountItem) PERSISTED,
    IsLineExenta BIT DEFAULT 0,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    CONSTRAINT FK_SalesItems_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_SalesItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_SalesItems_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_SalesItems_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID),
    CONSTRAINT CK_SalesItems_Tax_Exenta CHECK ((IsLineExenta = 1 AND TaxAmountItem = 0) OR (IsLineExenta = 0))
);

-- Payments per sale (split tender supported)
CREATE TABLE SalesPayments (
    SalesPaymentID INT IDENTITY(1,1) PRIMARY KEY,
    SaleID INT NOT NULL,
    PaymentMethodID INT NOT NULL,
    Amount DECIMAL(18,4) NOT NULL,
    PaymentDate DATETIME2 DEFAULT GETDATE(),
    ReferenceNumber NVARCHAR(100) NULL,
    BankTransactionID INT NULL,
    CONSTRAINT FK_SalesPayments_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_SalesPayments_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID)
);

-- DTE logs and queues
CREATE TABLE SiiDteLogs (
    SiiDteLogID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    Timestamp DATETIME2 DEFAULT GETDATE(),
    DocumentTypeGenerated NVARCHAR(50) NOT NULL,
    DocumentNumberGenerated NVARCHAR(50) NOT NULL,
    StatusSii NVARCHAR(100) NOT NULL, -- 'PendingGeneration','XMLGenerated','Signed','SentToSii','AcceptedBySii','RejectedBySii','AcceptedWithReparo'
    SiiTrackID NVARCHAR(100) NULL,
    SiiResponseMessage NVARCHAR(MAX) NULL,
    RequestXMLSent XML NULL,
    ResponseXMLReceived XML NULL,
    PdfTimbre VARBINARY(MAX) NULL,
    CONSTRAINT FK_SiiDteLogs_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiDteLogs_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
);

CREATE TABLE SiiSendQueue (
    SiiSendQueueID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    DocumentType NVARCHAR(50) NOT NULL,
    DocumentNumber NVARCHAR(50) NOT NULL,
    EnqueuedAt DATETIME2 DEFAULT GETDATE(),
    DequeuedAt DATETIME2 NULL,
    Status NVARCHAR(50) DEFAULT 'Pending' CHECK (Status IN ('Pending','Processing','Sent','Failed','Retried','Completed')),
    RetryCount INT DEFAULT 0,
    LastError NVARCHAR(MAX) NULL,
    CONSTRAINT FK_SiiSendQueue_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiSendQueue_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
);

CREATE TABLE SiiRejectedDocs (
    SiiRejectedDocID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    DocumentType NVARCHAR(50) NOT NULL,
    DocumentNumber NVARCHAR(50) NOT NULL,
    Reason NVARCHAR(1000) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SiiRejectedDocs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiRejectedDocs_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
);

-- =======================================================================
-- VII. PURCHASING MODULE
-- =======================================================================

CREATE TABLE PurchaseOrders (
    PurchaseOrderID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    OrderDate DATETIME2 DEFAULT GETDATE(),
    ExpectedDeliveryDate DATETIME2 NULL,
    PurchaseOrderNumber NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Draft' CHECK (Status IN ('Draft','Submitted','Approved','PartiallyReceived','Received','Cancelled')),
    TotalAmount DECIMAL(18,4) DEFAULT 0,
    Notes NVARCHAR(1000),
    ShippingAddress NVARCHAR(500),
    CreatedByEmployeeID INT NULL,
    CONSTRAINT FK_PurchaseOrders_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseOrders_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_PurchaseOrders_CreatedBy FOREIGN KEY (CreatedByEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_PurchaseOrder_Company_Number UNIQUE (CompanyID, PurchaseOrderNumber)
);

CREATE TABLE PurchaseOrderItems (
    PurchaseOrderItemID INT IDENTITY(1,1) PRIMARY KEY,
    PurchaseOrderID INT NOT NULL,
    ProductID INT NOT NULL,
    Description NVARCHAR(500),
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    TaxAmount DECIMAL(18,4) DEFAULT 0,
    LineTotal AS (Quantity * UnitPrice + TaxAmount) PERSISTED,
    ReceivedQuantity DECIMAL(18,4) DEFAULT 0,
    CONSTRAINT FK_PurchaseOrderItems_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseOrderItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
);

CREATE TABLE GoodsReceipts (
    GoodsReceiptID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PurchaseOrderID INT NULL,
    SupplierID INT NOT NULL,
    ReceiptDate DATETIME2 DEFAULT GETDATE(),
    ReceiptNumber NVARCHAR(50) NOT NULL,
    SupplierGuiaDespachoNumber NVARCHAR(50) NULL,
    Notes NVARCHAR(1000),
    ReceivedByEmployeeID INT NULL,
    CONSTRAINT FK_GoodsReceipts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_GoodsReceipts_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
    CONSTRAINT FK_GoodsReceipts_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_GoodsReceipts_Employees FOREIGN KEY (ReceivedByEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_GoodsReceipt_Company_Number UNIQUE (CompanyID, ReceiptNumber)
);

CREATE TABLE GoodsReceiptItems (
    GoodsReceiptItemID INT IDENTITY(1,1) PRIMARY KEY,
    GoodsReceiptID INT NOT NULL,
    PurchaseOrderItemID INT NULL,
    ProductID INT NOT NULL,
    QuantityReceived DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NULL,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    Notes NVARCHAR(500),
    CONSTRAINT FK_GoodsReceiptItems_GoodsReceipts FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID) ON DELETE CASCADE,
    CONSTRAINT FK_GoodsReceiptItems_PurchaseOrderItems FOREIGN KEY (PurchaseOrderItemID) REFERENCES PurchaseOrderItems(PurchaseOrderItemID),
    CONSTRAINT FK_GoodsReceiptItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_GoodsReceiptItems_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_GoodsReceiptItems_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID)
);

CREATE TABLE SupplierInvoices (
    SupplierInvoiceID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    DocumentType NVARCHAR(50) NOT NULL, -- 'FACTURA_PROVEEDOR','NOTA_CREDITO_PROVEEDOR','GUIA_DESPACHO_PROVEEDOR'
    InvoiceNumber_Supplier NVARCHAR(100) NOT NULL,
    IsSupplierDocExenta BIT DEFAULT 0 NOT NULL,
    InvoiceDate DATE NOT NULL,
    DueDate DATE NULL,
    TotalAmount DECIMAL(18,4) NOT NULL,
    TaxAmount DECIMAL(18,4) DEFAULT 0,
    AmountPaid DECIMAL(18,4) DEFAULT 0,
    Status NVARCHAR(50) DEFAULT 'Unpaid' CHECK (Status IN ('Unpaid','PartiallyPaid','Paid','Void')),
    PurchaseOrderID INT NULL,
    GoodsReceiptID INT NULL,
    OriginalSupplierInvoiceID INT NULL,
    SiiTrackID NVARCHAR(100) NULL, -- inbound DTE ref
    Notes NVARCHAR(1000),
    CONSTRAINT FK_SupplierInvoices_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierInvoices_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_SupplierInvoices_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
    CONSTRAINT FK_SupplierInvoices_GoodsReceipts FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID),
    CONSTRAINT FK_SupplierInvoices_Original FOREIGN KEY (OriginalSupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID),
    CONSTRAINT UQ_SupplierInvoice_Company_Supplier_InvNum_DocType UNIQUE (CompanyID, SupplierID, InvoiceNumber_Supplier, DocumentType)
);

CREATE TABLE SupplierInvoiceItems (
    SupplierInvoiceItemID INT IDENTITY(1,1) PRIMARY KEY,
    SupplierInvoiceID INT NOT NULL,
    ProductID INT NULL,
    Description NVARCHAR(500) NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    TaxAmountItem DECIMAL(18,4) DEFAULT 0,
    GLAccountID INT NULL,
    LineTotal AS (Quantity * UnitPrice + TaxAmountItem) PERSISTED,
    CONSTRAINT FK_SupplierInvoiceItems_SupplierInvoices FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierInvoiceItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
);

-- =======================================================================
-- VIII. FINANCIAL ACCOUNTING
-- =======================================================================

CREATE TABLE ChartOfAccounts (
    AccountID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    AccountNumber NVARCHAR(20) NOT NULL,
    AccountName NVARCHAR(255) NOT NULL,
    AccountType NVARCHAR(50) NOT NULL CHECK (AccountType IN ('Asset','Liability','Equity','Revenue','Expense','CostOfGoodsSold')),
    ParentAccountID INT NULL,
    IsActive BIT DEFAULT 1,
    NormalBalance NVARCHAR(10) CHECK (NormalBalance IN ('Debit','Credit')),
    Description NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ChartOfAccounts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ChartOfAccounts_Parent FOREIGN KEY (ParentAccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT UQ_ChartOfAccounts_Company_AccountNumber UNIQUE (CompanyID, AccountNumber)
);

ALTER TABLE SupplierInvoiceItems
ADD CONSTRAINT FK_SupplierInvoiceItems_GLAccount FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID);

CREATE TABLE FinancialPeriods (
    FinancialPeriodID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodName NVARCHAR(100) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Open' CHECK (Status IN ('Open','Closed','Archived')),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_FinancialPeriods_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_FinancialPeriods_Company_PeriodName UNIQUE (CompanyID, PeriodName),
    CONSTRAINT UQ_FinancialPeriods_Company_Dates UNIQUE (CompanyID, StartDate, EndDate)
);

CREATE TABLE JournalEntries (
    JournalEntryID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    EntryDate DATETIME2 DEFAULT GETDATE(),
    FinancialPeriodID INT NOT NULL,
    ReferenceNumber NVARCHAR(100) NULL,
    Description NVARCHAR(1000),
    SourceDocumentType NVARCHAR(50) NULL, -- 'Sale','Purchase','Payment','Manual'
    SourceDocumentID INT NULL,
    IsPosted BIT DEFAULT 0,
    PostedByEmployeeID INT NULL,
    PostedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_JournalEntries_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_JournalEntries_FinancialPeriods FOREIGN KEY (FinancialPeriodID) REFERENCES FinancialPeriods(FinancialPeriodID),
    CONSTRAINT FK_JournalEntries_PostedBy FOREIGN KEY (PostedByEmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE JournalEntryItems (
    JournalEntryItemID INT IDENTITY(1,1) PRIMARY KEY,
    JournalEntryID INT NOT NULL,
    AccountID INT NOT NULL,
    DebitAmount DECIMAL(18,4) DEFAULT 0,
    CreditAmount DECIMAL(18,4) DEFAULT 0,
    Description NVARCHAR(500),
    ContactType NVARCHAR(50) NULL CHECK (ContactType IN ('Customer','Supplier','Employee')),
    ContactID INT NULL,
    CONSTRAINT FK_JournalEntryItems_JournalEntries FOREIGN KEY (JournalEntryID) REFERENCES JournalEntries(JournalEntryID) ON DELETE CASCADE,
    CONSTRAINT FK_JournalEntryItems_ChartOfAccounts FOREIGN KEY (AccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT CK_JournalEntryItems_DebitOrCredit CHECK ((DebitAmount <> 0 AND CreditAmount = 0) OR (CreditAmount <> 0 AND DebitAmount = 0))
);

CREATE TABLE BankAccounts (
    BankAccountID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    GLAccountID INT NOT NULL UNIQUE,
    AccountName NVARCHAR(100) NOT NULL,
    AccountNumber NVARCHAR(50) NOT NULL,
    BankName NVARCHAR(100),
    BranchName NVARCHAR(100),
    CurrencyID INT NOT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_BankAccounts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_BankAccounts_ChartOfAccounts FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT FK_BankAccounts_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_BankAccount_Company_AccountNumber UNIQUE (CompanyID, AccountNumber)
);

-- Receivables (AR) - customer receipts
CREATE TABLE CustomerReceipts (
    CustomerReceiptID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NOT NULL,
    ReceiptDate DATETIME2 DEFAULT GETDATE(),
    Amount DECIMAL(18,4) NOT NULL,
    PaymentMethodID INT NOT NULL,
    BankAccountID INT NULL,
    ReferenceNumber NVARCHAR(100) NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_CustomerReceipts_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerReceipts_Customer FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT FK_CustomerReceipts_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_CustomerReceipts_Bank FOREIGN KEY (BankAccountID) REFERENCES BankAccounts(BankAccountID)
);

-- Payables (AP) - supplier payments
CREATE TABLE SupplierPayments (
    SupplierPaymentID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    PaymentDate DATETIME2 DEFAULT GETDATE(),
    AmountPaid DECIMAL(18,4) NOT NULL,
    PaymentMethodID INT NOT NULL,
    BankAccountID INT NULL,
    ReferenceNumber NVARCHAR(100),
    Notes NVARCHAR(500),
    ProcessedByEmployeeID INT NULL,
    CONSTRAINT FK_SupplierPayments_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierPayments_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_SupplierPayments_PaymentMethods FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_SupplierPayments_BankAccounts FOREIGN KEY (BankAccountID) REFERENCES BankAccounts(BankAccountID),
    CONSTRAINT FK_SupplierPayments_Employees FOREIGN KEY (ProcessedByEmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE SupplierPaymentAllocations (
    SupplierPaymentAllocationID INT IDENTITY(1,1) PRIMARY KEY,
    SupplierPaymentID INT NOT NULL,
    SupplierInvoiceID INT NOT NULL,
    AmountAllocated DECIMAL(18,4) NOT NULL,
    AllocationDate DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SupplierPaymentAllocations_Payments FOREIGN KEY (SupplierPaymentID) REFERENCES SupplierPayments(SupplierPaymentID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierPaymentAllocations_Invoices FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
    CONSTRAINT UQ_SupplierPaymentAllocation UNIQUE (SupplierPaymentID, SupplierInvoiceID)
);

-- Books for SII
CREATE TABLE LibroVentas (
    LibroVentasID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodoMes CHAR(7) NOT NULL, -- 'YYYY-MM'
    TotalVentasNeto DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalIVA DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalExento DECIMAL(18,4) NOT NULL DEFAULT 0,
    ArchivoGenerado NVARCHAR(500) NULL,
    EnviadoSII BIT DEFAULT 0,
    FechaEnvio DATETIME2 NULL,
    CONSTRAINT FK_LibroVentas_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_LibroVentas UNIQUE (CompanyID, PeriodoMes)
);

CREATE TABLE LibroCompras (
    LibroComprasID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodoMes CHAR(7) NOT NULL,
    TotalComprasNeto DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalIVA DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalExento DECIMAL(18,4) NOT NULL DEFAULT 0,
    ArchivoGenerado NVARCHAR(500) NULL,
    EnviadoSII BIT DEFAULT 0,
    FechaEnvio DATETIME2 NULL,
    CONSTRAINT FK_LibroCompras_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_LibroCompras UNIQUE (CompanyID, PeriodoMes)
);

-- =======================================================================
-- IX. HR & PAYROLL (BASIC)
-- =======================================================================

CREATE TABLE EmployeeContracts (
    EmployeeContractID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    EmployeeID INT NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    JobTitle NVARCHAR(100),
    EmploymentType NVARCHAR(50) CHECK (EmploymentType IN ('Full-time','Part-time','Contract','Intern')),
    Salary DECIMAL(18,4),
    PayFrequency NVARCHAR(50) CHECK (PayFrequency IN ('Monthly','Bi-weekly','Weekly','Hourly')),
    WorkHoursPerWeek DECIMAL(5,2),
    IsActive BIT DEFAULT 1,
    CONSTRAINT FK_EmployeeContracts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_EmployeeContracts_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
);

CREATE TABLE PayrollRuns (
    PayrollRunID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PayPeriodStartDate DATE NOT NULL,
    PayPeriodEndDate DATE NOT NULL,
    PaymentDate DATE NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Pending' CHECK (Status IN ('Pending','Processing','Completed','Cancelled')),
    ProcessedByEmployeeID INT NULL,
    CONSTRAINT FK_PayrollRuns_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_PayrollRuns_ProcessedBy FOREIGN KEY (ProcessedByEmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Payslips (
    PayslipID INT IDENTITY(1,1) PRIMARY KEY,
    PayrollRunID INT NOT NULL,
    EmployeeID INT NOT NULL,
    GrossPay DECIMAL(18,4) NOT NULL,
    TotalDeductions DECIMAL(18,4) DEFAULT 0,
    NetPay DECIMAL(18,4) NOT NULL,
    Notes NVARCHAR(1000),
    CONSTRAINT FK_Payslips_PayrollRuns FOREIGN KEY (PayrollRunID) REFERENCES PayrollRuns(PayrollRunID) ON DELETE CASCADE,
    CONSTRAINT FK_Payslips_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE PayslipItems (
    PayslipItemID INT IDENTITY(1,1) PRIMARY KEY,
    PayslipID INT NOT NULL,
    ItemType NVARCHAR(50) NOT NULL CHECK (ItemType IN ('Earning','Deduction','CompanyContribution','Tax')),
    Description NVARCHAR(255) NOT NULL,
    Amount DECIMAL(18,4) NOT NULL,
    GLAccountID INT NULL,
    CONSTRAINT FK_PayslipItems_Payslips FOREIGN KEY (PayslipID) REFERENCES Payslips(PayslipID) ON DELETE CASCADE,
    CONSTRAINT FK_PayslipItems_ChartOfAccounts FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID)
);

-- =======================================================================
-- X. MANUFACTURING (BASIC)
-- =======================================================================

CREATE TABLE BillOfMaterials (
    BOMID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID_FinishedGood INT NOT NULL,
    BOMName NVARCHAR(100) NOT NULL,
    Version NVARCHAR(20) DEFAULT '1.0',
    IsActive BIT DEFAULT 1,
    Notes NVARCHAR(500),
    CONSTRAINT FK_BOM_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_BOM_Products_Finished FOREIGN KEY (ProductID_FinishedGood) REFERENCES Products(ProductID),
    CONSTRAINT UQ_BOM_Company_Product_Version UNIQUE (CompanyID, ProductID_FinishedGood, Version)
);

CREATE TABLE BOMItems (
    BOMItemID INT IDENTITY(1,1) PRIMARY KEY,
    BOMID INT NOT NULL,
    ComponentProductID INT NOT NULL,
    QuantityRequired DECIMAL(18,4) NOT NULL,
    UnitID_Component INT NOT NULL,
    ScrapPercentage DECIMAL(5,4) DEFAULT 0,
    CONSTRAINT FK_BOMItems_BOM FOREIGN KEY (BOMID) REFERENCES BillOfMaterials(BOMID) ON DELETE CASCADE,
    CONSTRAINT FK_BOMItems_ComponentProduct FOREIGN KEY (ComponentProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_BOMItems_Units FOREIGN KEY (UnitID_Component) REFERENCES UnitsOfMeasure(UnitID)
);

CREATE TABLE WorkOrders (
    WorkOrderID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID_ToProduce INT NOT NULL,
    BOMID INT NULL,
    QuantityToProduce DECIMAL(18,4) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Planned' CHECK (Status IN ('Planned','InProgress','Completed','Cancelled','OnHold')),
    PlannedStartDate DATETIME2 NULL,
    PlannedEndDate DATETIME2 NULL,
    ActualStartDate DATETIME2 NULL,
    ActualEndDate DATETIME2 NULL,
    SaleID INT NULL,
    Notes NVARCHAR(1000),
    CONSTRAINT FK_WorkOrders_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_WorkOrders_Products FOREIGN KEY (ProductID_ToProduce) REFERENCES Products(ProductID),
    CONSTRAINT FK_WorkOrders_BOM FOREIGN KEY (BOMID) REFERENCES BillOfMaterials(BOMID),
    CONSTRAINT FK_WorkOrders_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
);

-- =======================================================================
-- XI. MARKETPLACE & PAYMENT GATEWAYS
-- =======================================================================

CREATE TABLE Marketplaces (
    MarketplaceID INT IDENTITY(1,1) PRIMARY KEY,
    MarketplaceCode NVARCHAR(50) NOT NULL UNIQUE,
    MarketplaceName NVARCHAR(100) NOT NULL,
    ApiBaseUrl NVARCHAR(255) NULL,
    AuthenticationType NVARCHAR(50) CHECK (AuthenticationType IN ('OAuth2','APIKeyToken','Custom')),
    SupportsProductSync BIT DEFAULT 0,
    SupportsOrderSync BIT DEFAULT 0,
    SupportsInventorySync BIT DEFAULT 0,
    SupportsPricingSync BIT DEFAULT 0
);

CREATE TABLE CompanyMarketplaceConnections (
    CompanyMarketplaceConnectionID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    MarketplaceID INT NOT NULL,
    StoreName NVARCHAR(100) NULL,
    ApiKeyEncrypted VARBINARY(MAX) NULL,
    ApiSecretEncrypted VARBINARY(MAX) NULL,
    AccessTokenEncrypted VARBINARY(MAX) NULL,
    RefreshTokenEncrypted VARBINARY(MAX) NULL,
    TokenExpiry DATETIME2 NULL,
    AppSpecificID NVARCHAR(255) NULL,
    IsEnabled BIT DEFAULT 0,
    DefaultWarehouseID INT NULL,
    SyncProducts BIT DEFAULT 0,
    SyncOrders BIT DEFAULT 0,
    SyncInventory BIT DEFAULT 0,
    LastSyncProducts DATETIME2 NULL,
    LastSyncOrders DATETIME2 NULL,
    LastSyncInventory DATETIME2 NULL,
    CONSTRAINT FK_CompanyMarketplaceConnections_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyMarketplaceConnections_Marketplaces FOREIGN KEY (MarketplaceID) REFERENCES Marketplaces(MarketplaceID),
    CONSTRAINT FK_CompanyMarketplaceConnections_Warehouses FOREIGN KEY (DefaultWarehouseID) REFERENCES Warehouses(WarehouseID),
    CONSTRAINT UQ_Company_Marketplace_AppID UNIQUE (CompanyID, MarketplaceID, AppSpecificID)
);

CREATE TABLE ProductMarketplaceMappings (
    ProductMarketplaceMappingID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    CompanyMarketplaceConnectionID INT NOT NULL,
    MarketplaceProductID_External NVARCHAR(255) NOT NULL,
    MarketplaceSKU_External NVARCHAR(100) NULL,
    MarketplaceListingURL NVARCHAR(1000) NULL,
    LastSyncedPrice DECIMAL(18,4) NULL,
    LastSyncedStock BIGINT NULL,
    SyncStatus NVARCHAR(50) DEFAULT 'Pending' CHECK (SyncStatus IN ('Pending','Synced','Error','Disabled')),
    LastSyncAttemptAt DATETIME2 NULL,
    LastSuccessfulSyncAt DATETIME2 NULL,
    SyncErrorMessage NVARCHAR(MAX) NULL,
    IsActiveOnMarketplace BIT DEFAULT 1,
    CONSTRAINT FK_ProductMarketplaceMappings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID),
    CONSTRAINT FK_ProductMarketplaceMappings_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductMarketplaceMappings_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE,
    CONSTRAINT UQ_Product_MarketplaceConnection UNIQUE (ProductID, CompanyMarketplaceConnectionID)
);

CREATE TABLE OrderMarketplaceMappings (
    OrderMarketplaceMappingID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NOT NULL UNIQUE,
    CompanyMarketplaceConnectionID INT NOT NULL,
    MarketplaceOrderID_External NVARCHAR(255) NOT NULL,
    MarketplaceOrderStatus_External NVARCHAR(100) NULL,
    OrderDownloadedAt DATETIME2 DEFAULT GETDATE(),
    LastMarketplaceUpdateAt DATETIME2 NULL,
    RawOrderDataJson NVARCHAR(MAX) NULL,
    CONSTRAINT FK_OrderMarketplaceMappings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID),
    CONSTRAINT FK_OrderMarketplaceMappings_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_OrderMarketplaceMappings_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE,
    CONSTRAINT UQ_MarketplaceOrder_Connection UNIQUE (CompanyMarketplaceConnectionID, MarketplaceOrderID_External)
);

CREATE TABLE MarketplaceSyncLogs (
    MarketplaceSyncLogID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyMarketplaceConnectionID INT NOT NULL,
    SyncType NVARCHAR(50) NOT NULL CHECK (SyncType IN ('Products','Orders','Inventory','Pricing','General')),
    StartTime DATETIME2 DEFAULT GETDATE(),
    EndTime DATETIME2 NULL,
    Status NVARCHAR(50) NOT NULL CHECK (Status IN ('InProgress','Completed','Failed','CompletedWithErrors')),
    RecordsProcessed INT DEFAULT 0,
    RecordsFailed INT DEFAULT 0,
    LogDetails NVARCHAR(MAX) NULL,
    CONSTRAINT FK_MarketplaceSyncLogs_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE
);

-- Payment Gateways (Transbank, Mercado Pago, Flow)
CREATE TABLE PaymentGateways (
    PaymentGatewayID INT IDENTITY(1,1) PRIMARY KEY,
    GatewayCode NVARCHAR(50) NOT NULL UNIQUE, -- 'TRANSBANK','MERCADOPAGO','FLOW'
    GatewayName NVARCHAR(100) NOT NULL,
    ApiBaseUrl NVARCHAR(255) NULL
);

CREATE TABLE CompanyPaymentGatewayConnections (
    CompanyPaymentGatewayConnectionID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    PaymentGatewayID INT NOT NULL,
    CommerceCode NVARCHAR(100) NULL,
    ApiKeyEncrypted VARBINARY(MAX) NULL,
    ApiSecretEncrypted VARBINARY(MAX) NULL,
    AccessTokenEncrypted VARBINARY(MAX) NULL,
    RefreshTokenEncrypted VARBINARY(MAX) NULL,
    TokenExpiry DATETIME2 NULL,
    IsEnabled BIT DEFAULT 0,
    LastSyncAt DATETIME2 NULL,
    CONSTRAINT FK_CPGC_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CPGC_Gateway FOREIGN KEY (PaymentGatewayID) REFERENCES PaymentGateways(PaymentGatewayID),
    CONSTRAINT UQ_CPGC UNIQUE (CompanyID, PaymentGatewayID)
);

-- =======================================================================
-- XII. BACKGROUND JOBS & API CLIENTS
-- =======================================================================

CREATE TABLE BackgroundJobs (
    BackgroundJobID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL,
    JobType NVARCHAR(100) NOT NULL, -- 'SiiSend','BooksGenerate','MarketplaceSync','GatewayReconcile'
    Payload NVARCHAR(MAX) NULL,
    Status NVARCHAR(50) DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Succeeded','Failed','Cancelled','Retrying')),
    RetryCount INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    StartedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    LastError NVARCHAR(MAX) NULL,
    CONSTRAINT FK_BackgroundJobs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL
);

CREATE TABLE ApiClients (
    ApiClientID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL, -- NULL for global apps
    ClientName NVARCHAR(100) NOT NULL,
    ClientId NVARCHAR(200) NOT NULL UNIQUE,
    ClientSecretEncrypted VARBINARY(MAX) NOT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ApiClients_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL
);

CREATE TABLE ApiLogs (
    ApiLogID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL,
    ApiClientID INT NULL,
    EmployeeID INT NULL,
    Timestamp DATETIME2 DEFAULT GETDATE(),
    HttpMethod NVARCHAR(10) NULL,
    Endpoint NVARCHAR(255) NULL,
    StatusCode INT NULL,
    RequestBody NVARCHAR(MAX) NULL,
    ResponseBody NVARCHAR(MAX) NULL,
    IPAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    CONSTRAINT FK_ApiLogs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL,
    CONSTRAINT FK_ApiLogs_ApiClient FOREIGN KEY (ApiClientID) REFERENCES ApiClients(ApiClientID) ON DELETE SET NULL,
    CONSTRAINT FK_ApiLogs_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
);

-- =======================================================================
-- XIII. CONSTRAINTS & INDEX IDEAS
-- =======================================================================
-- (Add strategic indexes in the application migration as per workload)
-- Example:
-- CREATE INDEX IX_Sales_Company_SaleDate ON Sales (CompanyID, SaleDate DESC);

