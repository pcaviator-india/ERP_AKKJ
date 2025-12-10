
-- =======================================================================
-- Author: Jitendra Khatri & ChatGPT
-- Date: 2025-10-30
-- Notes:
-- - This script is a full schema (not a patch). Run on a new database.
-- - Includes: Multi-tenant core, DTE/SII, POS, Inventory, Purchasing,
--   Accounting, HR, Manufacturing (basic), Marketplaces, Payments,
--   E-commerce gateways, Books (Libros), Background Jobs, and API logging.
-- =======================================================================

-- =======================================================================
-- 0. UTILITY TYPES
-- =======================================================================
-- (Add user-defined table types or enums if needed later)

-- =======================================================================
-- I. FOUNDATION & CORE TABLES
-- =======================================================================

CREATE TABLE Currencies (
    CurrencyID INT AUTO_INCREMENT PRIMARY KEY,
    CurrencyCode CHAR(3) NOT NULL UNIQUE, -- ISO 4217 ('CLP', 'USD')
    CurrencyName VARCHAR(100) NOT NULL,
    Symbol VARCHAR(10) NULL,
    DecimalPlaces INT DEFAULT 0,
    IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ExchangeRates (
    ExchangeRateID INT AUTO_INCREMENT PRIMARY KEY,
    BaseCurrencyID INT NOT NULL,         -- e.g., CLP
    QuoteCurrencyID INT NOT NULL,        -- e.g., USD
    Rate DECIMAL(18,8) NOT NULL,
    RateDate DATE NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ExchangeRates_Base FOREIGN KEY (BaseCurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT FK_ExchangeRates_Quote FOREIGN KEY (QuoteCurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_ExchangeRates UNIQUE (BaseCurrencyID, QuoteCurrencyID, RateDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Companies (
    CompanyID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyName VARCHAR(255) NOT NULL,
    LegalName VARCHAR(255) NULL,
    TaxID VARCHAR(50) NULL, -- RUT for Chile
    AddressLine1 VARCHAR(255) NULL,
    AddressLine2 VARCHAR(255) NULL,
    City VARCHAR(100) NULL,
    StateOrProvince VARCHAR(100) NULL,
    PostalCode VARCHAR(20) NULL,
    CountryCode CHAR(2) NULL, -- ISO 3166-1 Alpha-2
    PhoneNumber VARCHAR(50) NULL,
    Email VARCHAR(255) NULL,
    Website VARCHAR(255) NULL,
    LogoURL VARCHAR(500) NULL,
    DefaultCurrencyID INT NULL, -- FK to Currencies
    DefaultLanguageCode CHAR(2) DEFAULT 'ES', -- ISO 639-1
    SiiEnvironment VARCHAR(20) DEFAULT 'Certificacion' CHECK (SiiEnvironment IN ('Certificacion','Produccion')),
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Companies_DefaultCurrency FOREIGN KEY (DefaultCurrencyID) REFERENCES Currencies(CurrencyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanyCurrencies (
    CompanyCurrencyID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CurrencyID INT NOT NULL,
    IsDefaultOperatingCurrency TINYINT(1) DEFAULT 0,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_CompanyCurrencies_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyCurrencies_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_CompanyCurrency UNIQUE (CompanyID, CurrencyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE UnitsOfMeasure (
    UnitID INT AUTO_INCREMENT PRIMARY KEY,
    UnitName VARCHAR(50) NOT NULL UNIQUE, -- 'Piece', 'Kg', 'Box', 'Pack'
    Abbreviation VARCHAR(10) NOT NULL UNIQUE,
    IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PaymentMethods (
    PaymentMethodID INT AUTO_INCREMENT PRIMARY KEY,
    MethodName VARCHAR(100) NOT NULL UNIQUE, -- 'Cash','Bank Transfer','Credit Card','Transbank','MercadoPago','Flow'
    IsActive TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Employees ( -- Can also serve as Users
    EmployeeID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    FirstName VARCHAR(100) NOT NULL,
    LastName VARCHAR(100) NOT NULL,
    Email VARCHAR(255) NOT NULL, -- Used for login
    PasswordHash LONGTEXT NOT NULL,
    PhoneNumber VARCHAR(50) NULL,
    JobTitle VARCHAR(100) NULL,
    DepartmentID INT NULL,
    ReportsToEmployeeID INT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    LastLoginAt DATETIME NULL,
    CONSTRAINT FK_Employees_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Employees_ReportsTo FOREIGN KEY (ReportsToEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_Employee_Company_Email UNIQUE (CompanyID, Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Roles (
    RoleID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    RoleName VARCHAR(100) NOT NULL,
    Description VARCHAR(500),
    CONSTRAINT FK_Roles_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Role_Company_Name UNIQUE (CompanyID, RoleName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE RolePermissions (
    RolePermissionID INT AUTO_INCREMENT PRIMARY KEY,
    RoleID INT NOT NULL,
    PermissionName VARCHAR(100) NOT NULL,
    PermissionDescription VARCHAR(500),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
    CONSTRAINT UQ_Role_Permission UNIQUE (RoleID, PermissionName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE EmployeeRoles (
    EmployeeRoleID INT AUTO_INCREMENT PRIMARY KEY,
    EmployeeID INT NOT NULL,
    RoleID INT NOT NULL,
    CONSTRAINT FK_EmployeeRoles_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE,
    CONSTRAINT FK_EmployeeRoles_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID) ON DELETE CASCADE,
    CONSTRAINT UQ_Employee_Role UNIQUE (EmployeeID, RoleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- II. SYSTEM, ADMINISTRATION & SECURITY
-- =======================================================================

CREATE TABLE SystemSettings (
    SystemSettingID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NULL,
    SettingKey VARCHAR(100) NOT NULL,
    SettingValue LONGTEXT NOT NULL,
    Description VARCHAR(500),
    DataType VARCHAR(50) DEFAULT 'String' CHECK (DataType IN ('String', 'Integer', 'Boolean', 'JSON', 'Decimal')),
    IsEditableByTenant TINYINT(1) DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SystemSettings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_SystemSettings_Key UNIQUE (CompanyID, SettingKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE AuditLogs (
    AuditLogID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NULL,
    UserID INT NULL, -- FK to Employees.EmployeeID
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    EntityType VARCHAR(100) NOT NULL,
    EntityID VARCHAR(255) NULL,
    Action VARCHAR(50) NOT NULL, -- 'Create','Update','Delete','Login','ViewDTE'
    OldValues LONGTEXT NULL,
    NewValues LONGTEXT NULL,
    IPAddress VARCHAR(45) NULL,
    UserAgent VARCHAR(500) NULL,
    Notes VARCHAR(1000),
    CONSTRAINT FK_AuditLogs_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE POSUserSettings (
    POSUserSettingID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    UserID INT NOT NULL,
    WorkstationIdentifier VARCHAR(255) NULL,
    SettingName VARCHAR(100) NOT NULL,
    SettingValue LONGTEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_POSUserSettings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_POSUserSettings_Users FOREIGN KEY (UserID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE,
    CONSTRAINT UQ_POSUser_Setting UNIQUE (CompanyID, UserID, WorkstationIdentifier, SettingName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE DigitalCertificates ( -- For DTE signing
    DigitalCertificateID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CertSerial VARCHAR(200) NOT NULL,
    ValidFrom DATETIME NOT NULL,
    ValidTo DATETIME NOT NULL,
    CertFileEncrypted LONGBLOB NOT NULL,
    CertPasswordEncrypted LONGBLOB NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_DigitalCertificates_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_DigitalCertificates UNIQUE (CompanyID, CertSerial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE LoginSessions (
    LoginSessionID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    EmployeeID INT NOT NULL,
    SessionToken LONGBLOB NOT NULL,
    IssuedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME NULL,
    RevokedAt DATETIME NULL,
    IPAddress VARCHAR(45) NULL,
    UserAgent VARCHAR(500) NULL,
    CONSTRAINT FK_LoginSessions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_LoginSessions_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- III. SUBSCRIPTION, MODULE & USAGE MANAGEMENT
-- =======================================================================

CREATE TABLE SubscriptionPlans (
    PlanID INT AUTO_INCREMENT PRIMARY KEY,
    PlanName VARCHAR(100) NOT NULL UNIQUE,
    Description VARCHAR(1000),
    BasePrice DECIMAL(10,2) NOT NULL,
    PlanCurrencyID INT NOT NULL,
    BillingCycle VARCHAR(20) NOT NULL CHECK (BillingCycle IN ('Monthly', 'Annually', 'OneTime')),
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SubscriptionPlans_Currency FOREIGN KEY (PlanCurrencyID) REFERENCES Currencies(CurrencyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Modules (
    ModuleID INT AUTO_INCREMENT PRIMARY KEY,
    ModuleCode VARCHAR(50) NOT NULL UNIQUE,
    ModuleName VARCHAR(100) NOT NULL,
    Description VARCHAR(1000),
    IsStandAloneAddon TINYINT(1) DEFAULT 0,
    AddonPrice DECIMAL(10,2) NULL,
    DefaultBillingCycle VARCHAR(20) NULL CHECK (DefaultBillingCycle IN ('Monthly', 'Annually', 'OneTime')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PlanModules (
    PlanModuleID INT AUTO_INCREMENT PRIMARY KEY,
    PlanID INT NOT NULL,
    ModuleID INT NOT NULL,
    CONSTRAINT FK_PlanModules_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID) ON DELETE CASCADE,
    CONSTRAINT FK_PlanModules_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID) ON DELETE CASCADE,
    CONSTRAINT UQ_PlanModule UNIQUE (PlanID, ModuleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanySubscriptions (
    CompanySubscriptionID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL UNIQUE,
    PlanID INT NOT NULL,
    StartDate DATETIME NOT NULL,
    EndDate DATETIME NULL,
    NextBillingDate DATE NOT NULL,
    Status VARCHAR(50) DEFAULT 'Active' CHECK (Status IN ('Active', 'Trial', 'PastDue', 'Cancelled', 'Expired')),
    TrialEndDate DATE NULL,
    AutoRenew TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_CompanySubscriptions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanySubscriptions_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanySubscribedAddons (
    CompanySubscribedAddonID INT AUTO_INCREMENT PRIMARY KEY,
    CompanySubscriptionID INT NOT NULL,
    ModuleID INT NOT NULL,
    SubscribedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    PriceAtSubscription DECIMAL(10,2) NOT NULL,
    BillingCycle VARCHAR(20) NOT NULL,
    NextBillingDateForAddon DATE NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_CompanySubscribedAddons_Subscriptions FOREIGN KEY (CompanySubscriptionID) REFERENCES CompanySubscriptions(CompanySubscriptionID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanySubscribedAddons_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID),
    CONSTRAINT UQ_CompanySubscription_ModuleAddon UNIQUE (CompanySubscriptionID, ModuleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE FeatureLimits (
    FeatureLimitID INT AUTO_INCREMENT PRIMARY KEY,
    LimitName VARCHAR(100) NOT NULL UNIQUE, -- 'MaxProducts','MaxWarehouses','MaxUsers','MaxMarketplaceConnections'
    Description VARCHAR(500),
    UnitOfMeasure VARCHAR(50), -- 'Count','GB'
    DefaultValue BIGINT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PlanFeatureLimits (
    PlanFeatureLimitID INT AUTO_INCREMENT PRIMARY KEY,
    PlanID INT NOT NULL,
    FeatureLimitID INT NOT NULL,
    LimitValue BIGINT NOT NULL,
    OverageCharge DECIMAL(10,4) NULL,
    OverageUnit BIGINT NULL,
    EnforcementType VARCHAR(20) DEFAULT 'Soft' CHECK (EnforcementType IN ('Soft', 'Hard', 'Notify')),
    CONSTRAINT FK_PlanFeatureLimits_Plans FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID) ON DELETE CASCADE,
    CONSTRAINT FK_PlanFeatureLimits_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID),
    CONSTRAINT UQ_Plan_FeatureLimit UNIQUE (PlanID, FeatureLimitID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanyCustomFeatureLimits (
    CompanyCustomFeatureLimitID INT AUTO_INCREMENT PRIMARY KEY,
    CompanySubscriptionID INT NOT NULL,
    ModuleID INT NULL,
    FeatureLimitID INT NOT NULL,
    CustomLimitValue BIGINT NOT NULL,
    CustomOverageCharge DECIMAL(10,4) NULL,
    CustomOverageUnit BIGINT NULL,
    CustomEnforcementType VARCHAR(20) NULL CHECK (CustomEnforcementType IN ('Soft', 'Hard', 'Notify')),
    EffectiveDate DATE NOT NULL,
    ExpiryDate DATE NULL,
    CONSTRAINT FK_CompanyCustomFeatureLimits_Subscriptions FOREIGN KEY (CompanySubscriptionID) REFERENCES CompanySubscriptions(CompanySubscriptionID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyCustomFeatureLimits_Modules FOREIGN KEY (ModuleID) REFERENCES Modules(ModuleID),
    CONSTRAINT FK_CompanyCustomFeatureLimits_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID),
    CONSTRAINT UQ_CompanySubscription_Feature_Module_Limit UNIQUE (CompanySubscriptionID, FeatureLimitID, ModuleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanyUsageRecords (
    CompanyUsageRecordID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    FeatureLimitID INT NOT NULL,
    BillingPeriodStartDate DATE NOT NULL,
    BillingPeriodEndDate DATE NOT NULL,
    CurrentUsage BIGINT NOT NULL,
    PeakUsage BIGINT NULL,
    RecordedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_CompanyUsageRecords_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyUsageRecords_Features FOREIGN KEY (FeatureLimitID) REFERENCES FeatureLimits(FeatureLimitID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- IV. PRODUCT & INVENTORY MANAGEMENT
-- =======================================================================

CREATE TABLE ProductCategories (
    ProductCategoryID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CategoryName VARCHAR(100) NOT NULL,
    ParentCategoryID INT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_ProductCategories_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductCategories_Parent FOREIGN KEY (ParentCategoryID) REFERENCES ProductCategories(ProductCategoryID),
    CONSTRAINT UQ_ProductCategory_Company_Name UNIQUE (CompanyID, CategoryName, ParentCategoryID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ProductBrands (
    ProductBrandID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    BrandName VARCHAR(100) NOT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_ProductBrands_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductBrand_Company_Name UNIQUE (CompanyID, BrandName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Products (
    ProductID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SKU VARCHAR(100) NOT NULL,
    ProductName VARCHAR(255) NOT NULL,
    Description LONGTEXT NULL,
    ProductCategoryID INT NULL,
    ProductBrandID INT NULL,
    UnitID INT NOT NULL,
    CostPrice DECIMAL(18,4) DEFAULT 0,
    SellingPrice DECIMAL(18,4) DEFAULT 0,
    IsTaxable TINYINT(1) DEFAULT 1,
    IsService TINYINT(1) DEFAULT 0,
    Weight DECIMAL(10,3) NULL,
    WeightUnitID INT NULL,
    Length DECIMAL(10,3) NULL,
    Width DECIMAL(10,3) NULL,
    Height DECIMAL(10,3) NULL,
    DimensionUnitID INT NULL,
    ImageURL VARCHAR(500) NULL,
    Barcode VARCHAR(100) NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Products_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Products_Categories FOREIGN KEY (ProductCategoryID) REFERENCES ProductCategories(ProductCategoryID),
    CONSTRAINT FK_Products_Brands FOREIGN KEY (ProductBrandID) REFERENCES ProductBrands(ProductBrandID),
    CONSTRAINT FK_Products_Unit FOREIGN KEY (UnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT FK_Products_WeightUnit FOREIGN KEY (WeightUnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT FK_Products_DimensionUnit FOREIGN KEY (DimensionUnitID) REFERENCES UnitsOfMeasure(UnitID),
    CONSTRAINT UQ_Product_Company_SKU UNIQUE (CompanyID, SKU)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Custom fields (dynamic attributes)
CREATE TABLE ProductCustomFieldDefinitions (
    ProductCustomFieldDefinitionID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    FieldName VARCHAR(100) NOT NULL,
    DataType VARCHAR(20) NOT NULL CHECK (DataType IN ('Text','Number','Boolean','Date','JSON')),
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_ProductCFD_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductCFD UNIQUE (CompanyID, FieldName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ProductCustomFieldValues (
    ProductCustomFieldValueID INT AUTO_INCREMENT PRIMARY KEY,
    ProductID INT NOT NULL,
    ProductCustomFieldDefinitionID INT NOT NULL,
    ValueText LONGTEXT NULL,
    ValueNumber DECIMAL(18,4) NULL,
    ValueBoolean TINYINT(1) NULL,
    ValueDate DATE NULL,
    ValueJSON LONGTEXT NULL,
    CONSTRAINT FK_ProductCFV_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductCFV_Def FOREIGN KEY (ProductCustomFieldDefinitionID) REFERENCES ProductCustomFieldDefinitions(ProductCustomFieldDefinitionID) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductCFV UNIQUE (ProductID, ProductCustomFieldDefinitionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Packs/kits
CREATE TABLE ProductPacks (
    ProductPackID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PackProductID INT NOT NULL,         -- The pack SKU
    ComponentProductID INT NOT NULL,    -- Component SKU
    ComponentQuantity DECIMAL(18,4) NOT NULL,
    CONSTRAINT FK_ProductPacks_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductPacks_PackProduct FOREIGN KEY (PackProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_ProductPacks_ComponentProduct FOREIGN KEY (ComponentProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductPacks UNIQUE (PackProductID, ComponentProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lots & Serial tracking
CREATE TABLE ProductLots (
    ProductLotID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    LotNumber VARCHAR(100) NOT NULL,
    ExpirationDate DATE NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ProductLots_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductLots_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductLots UNIQUE (CompanyID, ProductID, LotNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ProductSerials (
    ProductSerialID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    SerialNumber VARCHAR(100) NOT NULL,
    Status VARCHAR(50) DEFAULT 'InStock' CHECK (Status IN ('InStock','Reserved','Sold','Returned','Scrapped')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ProductSerials_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductSerials_Product FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT UQ_ProductSerials UNIQUE (CompanyID, ProductID, SerialNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Warehouses (
    WarehouseID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    WarehouseName VARCHAR(100) NOT NULL,
    AddressLine1 VARCHAR(255) NULL,
    City VARCHAR(100) NULL,
    IsDefault TINYINT(1) DEFAULT 0,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Warehouses_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Warehouse_Company_Name UNIQUE (CompanyID, WarehouseName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ProductInventoryLevels (
    ProductInventoryLevelID INT AUTO_INCREMENT PRIMARY KEY,
    ProductID INT NOT NULL,
    WarehouseID INT NOT NULL,
    StockQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    ReservedQuantity DECIMAL(18,4) DEFAULT 0,
    AvailableQuantity DECIMAL(18,4) AS (StockQuantity - ReservedQuantity) STORED,
    MinStockLevel DECIMAL(18,4) NULL,
    MaxStockLevel DECIMAL(18,4) NULL,
    LastUpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ProductLotID INT NULL,
    CONSTRAINT FK_ProductInventoryLevels_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductInventoryLevels_Warehouses FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductInventoryLevels_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT UQ_Product_Warehouse_Inventory UNIQUE (ProductID, WarehouseID, ProductLotID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE InventoryTransactions (
    InventoryTransactionID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    WarehouseID INT NOT NULL,
    TransactionType VARCHAR(50) NOT NULL, -- 'PurchaseReceipt','SaleShipment','AdjustmentIn','AdjustmentOut','TransferOut','TransferIn','ManufacturingConsumption','ManufacturingOutput'
    QuantityChange DECIMAL(18,4) NOT NULL,
    TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ReferenceDocumentType VARCHAR(50) NULL,
    ReferenceDocumentID INT NULL,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    Notes VARCHAR(500),
    EmployeeID INT NULL,
    CONSTRAINT FK_InventoryTransactions_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_InventoryTransactions_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_InventoryTransactions_Warehouses FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID),
    CONSTRAINT FK_InventoryTransactions_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT FK_InventoryTransactions_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_InventoryTransactions_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- V. CONTACTS MANAGEMENT (CUSTOMERS & SUPPLIERS)
-- =======================================================================

CREATE TABLE CustomerGroups (
    CustomerGroupID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    GroupName VARCHAR(100) NOT NULL, -- Retail, Horeca, Distributor
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_CustomerGroups_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_CustomerGroups UNIQUE (CompanyID, GroupName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Customers (
    CustomerID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerName VARCHAR(255) NOT NULL,
    ContactPerson VARCHAR(150) NULL,
    Email VARCHAR(255) NULL,
    PhoneNumber VARCHAR(50) NULL,
    TaxID VARCHAR(50) NULL, -- RUT
    BillingAddressLine1 VARCHAR(255) NULL,
    BillingCity VARCHAR(100) NULL,
    ShippingAddressLine1 VARCHAR(255) NULL,
    ShippingCity VARCHAR(100) NULL,
    CustomerGroupID INT NULL,
    CreditLimit DECIMAL(18,2) DEFAULT 0,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Customers_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Customers_Group FOREIGN KEY (CustomerGroupID) REFERENCES CustomerGroups(CustomerGroupID),
    CONSTRAINT UQ_Customer_Company_TaxID UNIQUE (CompanyID, TaxID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE LoyaltyPoints (
    LoyaltyPointID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NOT NULL,
    PointsEarned INT DEFAULT 0,
    PointsRedeemed INT DEFAULT 0,
    Event VARCHAR(100) NOT NULL, -- 'Purchase','Return','Adjustment'
    EventDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    Notes VARCHAR(500),
    CONSTRAINT FK_LoyaltyPoints_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_LoyaltyPoints_Customer FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Suppliers (
    SupplierID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierName VARCHAR(255) NOT NULL,
    ContactPerson VARCHAR(150) NULL,
    Email VARCHAR(255) NULL,
    PhoneNumber VARCHAR(50) NULL,
    TaxID VARCHAR(50) NULL, -- RUT
    AddressLine1 VARCHAR(255) NULL,
    City VARCHAR(100) NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Suppliers_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Supplier_Company_TaxID UNIQUE (CompanyID, TaxID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- VI. SALES MODULE (CHILEAN LOCALIZATION)
-- =======================================================================

CREATE TABLE DocumentSequences ( -- Folios
    DocumentSequenceID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    DocumentType VARCHAR(50) NOT NULL, -- 'FACTURA','BOLETA','GUIA_DESPACHO','NOTA_CREDITO','NOTA_DEBITO','FACTURA_EXENTA','BOLETA_EXENTA','COTIZACION'
    Prefix VARCHAR(20) NULL,
    NextNumber BIGINT NOT NULL DEFAULT 1,
    Suffix VARCHAR(20) NULL,
    FormatString VARCHAR(100) NULL, -- e.g., '{YYYY}-{NNNNNN}'
    IsElectronic TINYINT(1) DEFAULT 1,
    RangeStart BIGINT NULL,
    RangeEnd BIGINT NULL,
    LastUsedAt DATETIME NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_DocumentSequences_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_DocumentSequences_Company_Type_Electronic UNIQUE (CompanyID, DocumentType, IsElectronic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CAF storage
CREATE TABLE SiiCAF (
    SiiCAFID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    DocumentType VARCHAR(50) NOT NULL,
    RangeStart BIGINT NOT NULL,
    RangeEnd BIGINT NOT NULL,
    CAFXml LONGTEXT NOT NULL,
    LoadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_SiiCAF_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Sales (
    SaleID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NULL,
    EmployeeID INT NOT NULL,
    SaleDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    DocumentType VARCHAR(50) NOT NULL,
    DocumentNumber VARCHAR(50) NOT NULL, -- Folio
    IsExenta TINYINT(1) DEFAULT 0 NOT NULL,
    OriginalSaleID INT NULL,      -- For NC/ND
    GeneratedFromGuiaID INT NULL, -- Factura from Guia
    TotalAmount DECIMAL(18, 4) NOT NULL,
    DiscountAmountTotal DECIMAL(18,4) DEFAULT 0,
    SubTotal DECIMAL(18,4) AS (TotalAmount - DiscountAmountTotal) STORED,
    TaxAmountTotal DECIMAL(18, 4) DEFAULT 0,
    FinalAmount DECIMAL(18,4) AS (TotalAmount - DiscountAmountTotal + TaxAmountTotal) STORED,
    AmountPaid DECIMAL(18,4) DEFAULT 0,
    PaymentStatus VARCHAR(50) DEFAULT 'Unpaid' CHECK (PaymentStatus IN ('Unpaid','PartiallyPaid','Paid','Overdue')),
    CurrencyID INT NOT NULL,
    Status VARCHAR(50) DEFAULT 'Draft', -- 'Draft','GuiaEmitida','Facturada','BoletaEmitida','Completada','Cancelada'
    Notes VARCHAR(1000),
    ShippingAddress VARCHAR(500),
    BillingAddress VARCHAR(500),
    MarketplaceOrderID_External VARCHAR(255) NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Sales_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Sales_Customers FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT FK_Sales_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT FK_Sales_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT FK_Sales_OriginalSale FOREIGN KEY (OriginalSaleID) REFERENCES Sales(SaleID),
    CONSTRAINT FK_Sales_GeneratedFromGuia FOREIGN KEY (GeneratedFromGuiaID) REFERENCES Sales(SaleID),
    CONSTRAINT UQ_Sales_Company_DocType_DocNumber UNIQUE (CompanyID, DocumentType, DocumentNumber),
    CONSTRAINT CK_Sales_DocumentType CHECK (DocumentType IN ('FACTURA','BOLETA','GUIA_DESPACHO','NOTA_CREDITO','NOTA_DEBITO','FACTURA_EXENTA','BOLETA_EXENTA','COTIZACION')),
    CONSTRAINT CK_Sales_TaxAmount_Exenta CHECK ((IsExenta = 1 AND TaxAmountTotal = 0) OR (IsExenta = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SalesItems (
    SalesItemID INT AUTO_INCREMENT PRIMARY KEY,
    SaleID INT NOT NULL,
    ProductID INT NOT NULL,
    Description VARCHAR(500) NULL,
    Quantity DECIMAL(18, 4) NOT NULL,
    UnitPrice DECIMAL(18, 4) NOT NULL,
    DiscountPercentage DECIMAL(5,2) DEFAULT 0,
    DiscountAmountItem DECIMAL(18,4) DEFAULT 0,
    SubTotalItem DECIMAL(18,4) AS (Quantity * UnitPrice - DiscountAmountItem) STORED,
    TaxRatePercentage DECIMAL(5,2) DEFAULT 0,
    TaxAmountItem DECIMAL(18,4) DEFAULT 0,
    LineTotal DECIMAL(18,4) AS (Quantity * UnitPrice - DiscountAmountItem + TaxAmountItem) STORED,
    IsLineExenta TINYINT(1) DEFAULT 0,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    CONSTRAINT FK_SalesItems_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_SalesItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_SalesItems_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_SalesItems_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID),
    CONSTRAINT CK_SalesItems_Tax_Exenta CHECK ((IsLineExenta = 1 AND TaxAmountItem = 0) OR (IsLineExenta = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payments per sale (split tender supported)
CREATE TABLE SalesPayments (
    SalesPaymentID INT AUTO_INCREMENT PRIMARY KEY,
    SaleID INT NOT NULL,
    PaymentMethodID INT NOT NULL,
    Amount DECIMAL(18,4) NOT NULL,
    PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ReferenceNumber VARCHAR(100) NULL,
    BankTransactionID INT NULL,
    CONSTRAINT FK_SalesPayments_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_SalesPayments_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DTE logs and queues
CREATE TABLE SiiDteLogs (
    SiiDteLogID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    DocumentTypeGenerated VARCHAR(50) NOT NULL,
    DocumentNumberGenerated VARCHAR(50) NOT NULL,
    StatusSii VARCHAR(100) NOT NULL, -- 'PendingGeneration','XMLGenerated','Signed','SentToSii','AcceptedBySii','RejectedBySii','AcceptedWithReparo'
    SiiTrackID VARCHAR(100) NULL,
    SiiResponseMessage LONGTEXT NULL,
    RequestXMLSent LONGTEXT NULL,
    ResponseXMLReceived LONGTEXT NULL,
    PdfTimbre LONGBLOB NULL,
    CONSTRAINT FK_SiiDteLogs_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiDteLogs_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SiiSendQueue (
    SiiSendQueueID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    DocumentType VARCHAR(50) NOT NULL,
    DocumentNumber VARCHAR(50) NOT NULL,
    EnqueuedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    DequeuedAt DATETIME NULL,
    Status VARCHAR(50) DEFAULT 'Pending' CHECK (Status IN ('Pending','Processing','Sent','Failed','Retried','Completed')),
    RetryCount INT DEFAULT 0,
    LastError LONGTEXT NULL,
    CONSTRAINT FK_SiiSendQueue_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiSendQueue_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SiiRejectedDocs (
    SiiRejectedDocID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NULL,
    DocumentType VARCHAR(50) NOT NULL,
    DocumentNumber VARCHAR(50) NOT NULL,
    Reason VARCHAR(1000) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SiiRejectedDocs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SiiRejectedDocs_Sale FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- VII. PURCHASING MODULE
-- =======================================================================

CREATE TABLE PurchaseOrders (
    PurchaseOrderID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    OrderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpectedDeliveryDate DATETIME NULL,
    PurchaseOrderNumber VARCHAR(50) NOT NULL,
    Status VARCHAR(50) DEFAULT 'Draft' CHECK (Status IN ('Draft','Submitted','Approved','PartiallyReceived','Received','Cancelled')),
    TotalAmount DECIMAL(18,4) DEFAULT 0,
    Notes VARCHAR(1000),
    ShippingAddress VARCHAR(500),
    CreatedByEmployeeID INT NULL,
    CONSTRAINT FK_PurchaseOrders_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseOrders_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_PurchaseOrders_CreatedBy FOREIGN KEY (CreatedByEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_PurchaseOrder_Company_Number UNIQUE (CompanyID, PurchaseOrderNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PurchaseOrderItems (
    PurchaseOrderItemID INT AUTO_INCREMENT PRIMARY KEY,
    PurchaseOrderID INT NOT NULL,
    ProductID INT NOT NULL,
    Description VARCHAR(500),
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    TaxAmount DECIMAL(18,4) DEFAULT 0,
    LineTotal DECIMAL(18,4) AS (Quantity * UnitPrice + TaxAmount) STORED,
    ReceivedQuantity DECIMAL(18,4) DEFAULT 0,
    CONSTRAINT FK_PurchaseOrderItems_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseOrderItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE GoodsReceipts (
    GoodsReceiptID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PurchaseOrderID INT NULL,
    SupplierID INT NOT NULL,
    ReceiptDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ReceiptNumber VARCHAR(50) NOT NULL,
    SupplierGuiaDespachoNumber VARCHAR(50) NULL,
    Notes VARCHAR(1000),
    ReceivedByEmployeeID INT NULL,
    CONSTRAINT FK_GoodsReceipts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_GoodsReceipts_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
    CONSTRAINT FK_GoodsReceipts_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_GoodsReceipts_Employees FOREIGN KEY (ReceivedByEmployeeID) REFERENCES Employees(EmployeeID),
    CONSTRAINT UQ_GoodsReceipt_Company_Number UNIQUE (CompanyID, ReceiptNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE GoodsReceiptItems (
    GoodsReceiptItemID INT AUTO_INCREMENT PRIMARY KEY,
    GoodsReceiptID INT NOT NULL,
    PurchaseOrderItemID INT NULL,
    ProductID INT NOT NULL,
    QuantityReceived DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NULL,
    ProductLotID INT NULL,
    ProductSerialID INT NULL,
    Notes VARCHAR(500),
    CONSTRAINT FK_GoodsReceiptItems_GoodsReceipts FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID) ON DELETE CASCADE,
    CONSTRAINT FK_GoodsReceiptItems_PurchaseOrderItems FOREIGN KEY (PurchaseOrderItemID) REFERENCES PurchaseOrderItems(PurchaseOrderItemID),
    CONSTRAINT FK_GoodsReceiptItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_GoodsReceiptItems_Lot FOREIGN KEY (ProductLotID) REFERENCES ProductLots(ProductLotID),
    CONSTRAINT FK_GoodsReceiptItems_Serial FOREIGN KEY (ProductSerialID) REFERENCES ProductSerials(ProductSerialID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SupplierInvoices (
    SupplierInvoiceID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    DocumentType VARCHAR(50) NOT NULL, -- 'FACTURA_PROVEEDOR','NOTA_CREDITO_PROVEEDOR','GUIA_DESPACHO_PROVEEDOR'
    InvoiceNumber_Supplier VARCHAR(100) NOT NULL,
    IsSupplierDocExenta TINYINT(1) DEFAULT 0 NOT NULL,
    InvoiceDate DATE NOT NULL,
    DueDate DATE NULL,
    TotalAmount DECIMAL(18,4) NOT NULL,
    TaxAmount DECIMAL(18,4) DEFAULT 0,
    AmountPaid DECIMAL(18,4) DEFAULT 0,
    Status VARCHAR(50) DEFAULT 'Unpaid' CHECK (Status IN ('Unpaid','PartiallyPaid','Paid','Void')),
    PurchaseOrderID INT NULL,
    GoodsReceiptID INT NULL,
    OriginalSupplierInvoiceID INT NULL,
    SiiTrackID VARCHAR(100) NULL, -- inbound DTE ref
    Notes VARCHAR(1000),
    CONSTRAINT FK_SupplierInvoices_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierInvoices_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_SupplierInvoices_PurchaseOrders FOREIGN KEY (PurchaseOrderID) REFERENCES PurchaseOrders(PurchaseOrderID),
    CONSTRAINT FK_SupplierInvoices_GoodsReceipts FOREIGN KEY (GoodsReceiptID) REFERENCES GoodsReceipts(GoodsReceiptID),
    CONSTRAINT FK_SupplierInvoices_Original FOREIGN KEY (OriginalSupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID),
    CONSTRAINT UQ_SupplierInvoice_Company_Supplier_InvNum_DocType UNIQUE (CompanyID, SupplierID, InvoiceNumber_Supplier, DocumentType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SupplierInvoiceItems (
    SupplierInvoiceItemID INT AUTO_INCREMENT PRIMARY KEY,
    SupplierInvoiceID INT NOT NULL,
    ProductID INT NULL,
    Description VARCHAR(500) NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    TaxAmountItem DECIMAL(18,4) DEFAULT 0,
    GLAccountID INT NULL,
    LineTotal DECIMAL(18,4) AS (Quantity * UnitPrice + TaxAmountItem) STORED,
    CONSTRAINT FK_SupplierInvoiceItems_SupplierInvoices FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierInvoiceItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- VIII. FINANCIAL ACCOUNTING
-- =======================================================================

CREATE TABLE ChartOfAccounts (
    AccountID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    AccountNumber VARCHAR(20) NOT NULL,
    AccountName VARCHAR(255) NOT NULL,
    AccountType VARCHAR(50) NOT NULL CHECK (AccountType IN ('Asset','Liability','Equity','Revenue','Expense','CostOfGoodsSold')),
    ParentAccountID INT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    NormalBalance VARCHAR(10) CHECK (NormalBalance IN ('Debit','Credit')),
    Description VARCHAR(500),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ChartOfAccounts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_ChartOfAccounts_Parent FOREIGN KEY (ParentAccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT UQ_ChartOfAccounts_Company_AccountNumber UNIQUE (CompanyID, AccountNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE SupplierInvoiceItems
ADD CONSTRAINT FK_SupplierInvoiceItems_GLAccount FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID);

CREATE TABLE FinancialPeriods (
    FinancialPeriodID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodName VARCHAR(100) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    Status VARCHAR(20) DEFAULT 'Open' CHECK (Status IN ('Open','Closed','Archived')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_FinancialPeriods_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_FinancialPeriods_Company_PeriodName UNIQUE (CompanyID, PeriodName),
    CONSTRAINT UQ_FinancialPeriods_Company_Dates UNIQUE (CompanyID, StartDate, EndDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE JournalEntries (
    JournalEntryID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FinancialPeriodID INT NOT NULL,
    ReferenceNumber VARCHAR(100) NULL,
    Description VARCHAR(1000),
    SourceDocumentType VARCHAR(50) NULL, -- 'Sale','Purchase','Payment','Manual'
    SourceDocumentID INT NULL,
    IsPosted TINYINT(1) DEFAULT 0,
    PostedByEmployeeID INT NULL,
    PostedAt DATETIME NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_JournalEntries_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_JournalEntries_FinancialPeriods FOREIGN KEY (FinancialPeriodID) REFERENCES FinancialPeriods(FinancialPeriodID),
    CONSTRAINT FK_JournalEntries_PostedBy FOREIGN KEY (PostedByEmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE JournalEntryItems (
    JournalEntryItemID INT AUTO_INCREMENT PRIMARY KEY,
    JournalEntryID INT NOT NULL,
    AccountID INT NOT NULL,
    DebitAmount DECIMAL(18,4) DEFAULT 0,
    CreditAmount DECIMAL(18,4) DEFAULT 0,
    Description VARCHAR(500),
    ContactType VARCHAR(50) NULL CHECK (ContactType IN ('Customer','Supplier','Employee')),
    ContactID INT NULL,
    CONSTRAINT FK_JournalEntryItems_JournalEntries FOREIGN KEY (JournalEntryID) REFERENCES JournalEntries(JournalEntryID) ON DELETE CASCADE,
    CONSTRAINT FK_JournalEntryItems_ChartOfAccounts FOREIGN KEY (AccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT CK_JournalEntryItems_DebitOrCredit CHECK ((DebitAmount <> 0 AND CreditAmount = 0) OR (CreditAmount <> 0 AND DebitAmount = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE BankAccounts (
    BankAccountID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    GLAccountID INT NOT NULL UNIQUE,
    AccountName VARCHAR(100) NOT NULL,
    AccountNumber VARCHAR(50) NOT NULL,
    BankName VARCHAR(100),
    BranchName VARCHAR(100),
    CurrencyID INT NOT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_BankAccounts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_BankAccounts_ChartOfAccounts FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID),
    CONSTRAINT FK_BankAccounts_Currencies FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    CONSTRAINT UQ_BankAccount_Company_AccountNumber UNIQUE (CompanyID, AccountNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Receivables (AR) - customer receipts
CREATE TABLE CustomerReceipts (
    CustomerReceiptID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    CustomerID INT NOT NULL,
    ReceiptDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    Amount DECIMAL(18,4) NOT NULL,
    PaymentMethodID INT NOT NULL,
    BankAccountID INT NULL,
    ReferenceNumber VARCHAR(100) NULL,
    Notes VARCHAR(500) NULL,
    CONSTRAINT FK_CustomerReceipts_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerReceipts_Customer FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT FK_CustomerReceipts_Method FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_CustomerReceipts_Bank FOREIGN KEY (BankAccountID) REFERENCES BankAccounts(BankAccountID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payables (AP) - supplier payments
CREATE TABLE SupplierPayments (
    SupplierPaymentID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SupplierID INT NOT NULL,
    PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    AmountPaid DECIMAL(18,4) NOT NULL,
    PaymentMethodID INT NOT NULL,
    BankAccountID INT NULL,
    ReferenceNumber VARCHAR(100),
    Notes VARCHAR(500),
    ProcessedByEmployeeID INT NULL,
    CONSTRAINT FK_SupplierPayments_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierPayments_Suppliers FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    CONSTRAINT FK_SupplierPayments_PaymentMethods FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_SupplierPayments_BankAccounts FOREIGN KEY (BankAccountID) REFERENCES BankAccounts(BankAccountID),
    CONSTRAINT FK_SupplierPayments_Employees FOREIGN KEY (ProcessedByEmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SupplierPaymentAllocations (
    SupplierPaymentAllocationID INT AUTO_INCREMENT PRIMARY KEY,
    SupplierPaymentID INT NOT NULL,
    SupplierInvoiceID INT NOT NULL,
    AmountAllocated DECIMAL(18,4) NOT NULL,
    AllocationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SupplierPaymentAllocations_Payments FOREIGN KEY (SupplierPaymentID) REFERENCES SupplierPayments(SupplierPaymentID) ON DELETE CASCADE,
    CONSTRAINT FK_SupplierPaymentAllocations_Invoices FOREIGN KEY (SupplierInvoiceID) REFERENCES SupplierInvoices(SupplierInvoiceID) ON DELETE CASCADE,
    CONSTRAINT UQ_SupplierPaymentAllocation UNIQUE (SupplierPaymentID, SupplierInvoiceID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Books for SII
CREATE TABLE LibroVentas (
    LibroVentasID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodoMes CHAR(7) NOT NULL, -- 'YYYY-MM'
    TotalVentasNeto DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalIVA DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalExento DECIMAL(18,4) NOT NULL DEFAULT 0,
    ArchivoGenerado VARCHAR(500) NULL,
    EnviadoSII TINYINT(1) DEFAULT 0,
    FechaEnvio DATETIME NULL,
    CONSTRAINT FK_LibroVentas_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_LibroVentas UNIQUE (CompanyID, PeriodoMes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE LibroCompras (
    LibroComprasID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PeriodoMes CHAR(7) NOT NULL,
    TotalComprasNeto DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalIVA DECIMAL(18,4) NOT NULL DEFAULT 0,
    TotalExento DECIMAL(18,4) NOT NULL DEFAULT 0,
    ArchivoGenerado VARCHAR(500) NULL,
    EnviadoSII TINYINT(1) DEFAULT 0,
    FechaEnvio DATETIME NULL,
    CONSTRAINT FK_LibroCompras_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_LibroCompras UNIQUE (CompanyID, PeriodoMes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- IX. HR & PAYROLL (BASIC)
-- =======================================================================

CREATE TABLE EmployeeContracts (
    EmployeeContractID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    EmployeeID INT NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    JobTitle VARCHAR(100),
    EmploymentType VARCHAR(50) CHECK (EmploymentType IN ('Full-time','Part-time','Contract','Intern')),
    Salary DECIMAL(18,4),
    PayFrequency VARCHAR(50) CHECK (PayFrequency IN ('Monthly','Bi-weekly','Weekly','Hourly')),
    WorkHoursPerWeek DECIMAL(5,2),
    IsActive TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_EmployeeContracts_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_EmployeeContracts_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PayrollRuns (
    PayrollRunID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PayPeriodStartDate DATE NOT NULL,
    PayPeriodEndDate DATE NOT NULL,
    PaymentDate DATE NOT NULL,
    Status VARCHAR(50) DEFAULT 'Pending' CHECK (Status IN ('Pending','Processing','Completed','Cancelled')),
    ProcessedByEmployeeID INT NULL,
    CONSTRAINT FK_PayrollRuns_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_PayrollRuns_ProcessedBy FOREIGN KEY (ProcessedByEmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Payslips (
    PayslipID INT AUTO_INCREMENT PRIMARY KEY,
    PayrollRunID INT NOT NULL,
    EmployeeID INT NOT NULL,
    GrossPay DECIMAL(18,4) NOT NULL,
    TotalDeductions DECIMAL(18,4) DEFAULT 0,
    NetPay DECIMAL(18,4) NOT NULL,
    Notes VARCHAR(1000),
    CONSTRAINT FK_Payslips_PayrollRuns FOREIGN KEY (PayrollRunID) REFERENCES PayrollRuns(PayrollRunID) ON DELETE CASCADE,
    CONSTRAINT FK_Payslips_Employees FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PayslipItems (
    PayslipItemID INT AUTO_INCREMENT PRIMARY KEY,
    PayslipID INT NOT NULL,
    ItemType VARCHAR(50) NOT NULL CHECK (ItemType IN ('Earning','Deduction','CompanyContribution','Tax')),
    Description VARCHAR(255) NOT NULL,
    Amount DECIMAL(18,4) NOT NULL,
    GLAccountID INT NULL,
    CONSTRAINT FK_PayslipItems_Payslips FOREIGN KEY (PayslipID) REFERENCES Payslips(PayslipID) ON DELETE CASCADE,
    CONSTRAINT FK_PayslipItems_ChartOfAccounts FOREIGN KEY (GLAccountID) REFERENCES ChartOfAccounts(AccountID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- X. MANUFACTURING (BASIC)
-- =======================================================================

CREATE TABLE BillOfMaterials (
    BOMID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID_FinishedGood INT NOT NULL,
    BOMName VARCHAR(100) NOT NULL,
    Version VARCHAR(20) DEFAULT '1.0',
    IsActive TINYINT(1) DEFAULT 1,
    Notes VARCHAR(500),
    CONSTRAINT FK_BOM_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_BOM_Products_Finished FOREIGN KEY (ProductID_FinishedGood) REFERENCES Products(ProductID),
    CONSTRAINT UQ_BOM_Company_Product_Version UNIQUE (CompanyID, ProductID_FinishedGood, Version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE BOMItems (
    BOMItemID INT AUTO_INCREMENT PRIMARY KEY,
    BOMID INT NOT NULL,
    ComponentProductID INT NOT NULL,
    QuantityRequired DECIMAL(18,4) NOT NULL,
    UnitID_Component INT NOT NULL,
    ScrapPercentage DECIMAL(5,4) DEFAULT 0,
    CONSTRAINT FK_BOMItems_BOM FOREIGN KEY (BOMID) REFERENCES BillOfMaterials(BOMID) ON DELETE CASCADE,
    CONSTRAINT FK_BOMItems_ComponentProduct FOREIGN KEY (ComponentProductID) REFERENCES Products(ProductID),
    CONSTRAINT FK_BOMItems_Units FOREIGN KEY (UnitID_Component) REFERENCES UnitsOfMeasure(UnitID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE WorkOrders (
    WorkOrderID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID_ToProduce INT NOT NULL,
    BOMID INT NULL,
    QuantityToProduce DECIMAL(18,4) NOT NULL,
    Status VARCHAR(50) DEFAULT 'Planned' CHECK (Status IN ('Planned','InProgress','Completed','Cancelled','OnHold')),
    PlannedStartDate DATETIME NULL,
    PlannedEndDate DATETIME NULL,
    ActualStartDate DATETIME NULL,
    ActualEndDate DATETIME NULL,
    SaleID INT NULL,
    Notes VARCHAR(1000),
    CONSTRAINT FK_WorkOrders_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_WorkOrders_Products FOREIGN KEY (ProductID_ToProduce) REFERENCES Products(ProductID),
    CONSTRAINT FK_WorkOrders_BOM FOREIGN KEY (BOMID) REFERENCES BillOfMaterials(BOMID),
    CONSTRAINT FK_WorkOrders_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- XI. MARKETPLACE & PAYMENT GATEWAYS
-- =======================================================================

CREATE TABLE Marketplaces (
    MarketplaceID INT AUTO_INCREMENT PRIMARY KEY,
    MarketplaceCode VARCHAR(50) NOT NULL UNIQUE,
    MarketplaceName VARCHAR(100) NOT NULL,
    ApiBaseUrl VARCHAR(255) NULL,
    AuthenticationType VARCHAR(50) CHECK (AuthenticationType IN ('OAuth2','APIKeyToken','Custom')),
    SupportsProductSync TINYINT(1) DEFAULT 0,
    SupportsOrderSync TINYINT(1) DEFAULT 0,
    SupportsInventorySync TINYINT(1) DEFAULT 0,
    SupportsPricingSync TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanyMarketplaceConnections (
    CompanyMarketplaceConnectionID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    MarketplaceID INT NOT NULL,
    StoreName VARCHAR(100) NULL,
    ApiKeyEncrypted LONGBLOB NULL,
    ApiSecretEncrypted LONGBLOB NULL,
    AccessTokenEncrypted LONGBLOB NULL,
    RefreshTokenEncrypted LONGBLOB NULL,
    TokenExpiry DATETIME NULL,
    AppSpecificID VARCHAR(255) NULL,
    IsEnabled TINYINT(1) DEFAULT 0,
    DefaultWarehouseID INT NULL,
    SyncProducts TINYINT(1) DEFAULT 0,
    SyncOrders TINYINT(1) DEFAULT 0,
    SyncInventory TINYINT(1) DEFAULT 0,
    LastSyncProducts DATETIME NULL,
    LastSyncOrders DATETIME NULL,
    LastSyncInventory DATETIME NULL,
    CONSTRAINT FK_CompanyMarketplaceConnections_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CompanyMarketplaceConnections_Marketplaces FOREIGN KEY (MarketplaceID) REFERENCES Marketplaces(MarketplaceID),
    CONSTRAINT FK_CompanyMarketplaceConnections_Warehouses FOREIGN KEY (DefaultWarehouseID) REFERENCES Warehouses(WarehouseID),
    CONSTRAINT UQ_Company_Marketplace_AppID UNIQUE (CompanyID, MarketplaceID, AppSpecificID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ProductMarketplaceMappings (
    ProductMarketplaceMappingID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    ProductID INT NOT NULL,
    CompanyMarketplaceConnectionID INT NOT NULL,
    MarketplaceProductID_External VARCHAR(255) NOT NULL,
    MarketplaceSKU_External VARCHAR(100) NULL,
    MarketplaceListingURL VARCHAR(1000) NULL,
    LastSyncedPrice DECIMAL(18,4) NULL,
    LastSyncedStock BIGINT NULL,
    SyncStatus VARCHAR(50) DEFAULT 'Pending' CHECK (SyncStatus IN ('Pending','Synced','Error','Disabled')),
    LastSyncAttemptAt DATETIME NULL,
    LastSuccessfulSyncAt DATETIME NULL,
    SyncErrorMessage LONGTEXT NULL,
    IsActiveOnMarketplace TINYINT(1) DEFAULT 1,
    CONSTRAINT FK_ProductMarketplaceMappings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID),
    CONSTRAINT FK_ProductMarketplaceMappings_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID) ON DELETE CASCADE,
    CONSTRAINT FK_ProductMarketplaceMappings_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE,
    CONSTRAINT UQ_Product_MarketplaceConnection UNIQUE (ProductID, CompanyMarketplaceConnectionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE OrderMarketplaceMappings (
    OrderMarketplaceMappingID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    SaleID INT NOT NULL UNIQUE,
    CompanyMarketplaceConnectionID INT NOT NULL,
    MarketplaceOrderID_External VARCHAR(255) NOT NULL,
    MarketplaceOrderStatus_External VARCHAR(100) NULL,
    OrderDownloadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    LastMarketplaceUpdateAt DATETIME NULL,
    RawOrderDataJson LONGTEXT NULL,
    CONSTRAINT FK_OrderMarketplaceMappings_Companies FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID),
    CONSTRAINT FK_OrderMarketplaceMappings_Sales FOREIGN KEY (SaleID) REFERENCES Sales(SaleID) ON DELETE CASCADE,
    CONSTRAINT FK_OrderMarketplaceMappings_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE,
    CONSTRAINT UQ_MarketplaceOrder_Connection UNIQUE (CompanyMarketplaceConnectionID, MarketplaceOrderID_External)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE MarketplaceSyncLogs (
    MarketplaceSyncLogID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyMarketplaceConnectionID INT NOT NULL,
    SyncType VARCHAR(50) NOT NULL CHECK (SyncType IN ('Products','Orders','Inventory','Pricing','General')),
    StartTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    EndTime DATETIME NULL,
    Status VARCHAR(50) NOT NULL CHECK (Status IN ('InProgress','Completed','Failed','CompletedWithErrors')),
    RecordsProcessed INT DEFAULT 0,
    RecordsFailed INT DEFAULT 0,
    LogDetails LONGTEXT NULL,
    CONSTRAINT FK_MarketplaceSyncLogs_Connections FOREIGN KEY (CompanyMarketplaceConnectionID) REFERENCES CompanyMarketplaceConnections(CompanyMarketplaceConnectionID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment Gateways (Transbank, Mercado Pago, Flow)
CREATE TABLE PaymentGateways (
    PaymentGatewayID INT AUTO_INCREMENT PRIMARY KEY,
    GatewayCode VARCHAR(50) NOT NULL UNIQUE, -- 'TRANSBANK','MERCADOPAGO','FLOW'
    GatewayName VARCHAR(100) NOT NULL,
    ApiBaseUrl VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CompanyPaymentGatewayConnections (
    CompanyPaymentGatewayConnectionID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NOT NULL,
    PaymentGatewayID INT NOT NULL,
    CommerceCode VARCHAR(100) NULL,
    ApiKeyEncrypted LONGBLOB NULL,
    ApiSecretEncrypted LONGBLOB NULL,
    AccessTokenEncrypted LONGBLOB NULL,
    RefreshTokenEncrypted LONGBLOB NULL,
    TokenExpiry DATETIME NULL,
    IsEnabled TINYINT(1) DEFAULT 0,
    LastSyncAt DATETIME NULL,
    CONSTRAINT FK_CPGC_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_CPGC_Gateway FOREIGN KEY (PaymentGatewayID) REFERENCES PaymentGateways(PaymentGatewayID),
    CONSTRAINT UQ_CPGC UNIQUE (CompanyID, PaymentGatewayID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- XII. BACKGROUND JOBS & API CLIENTS
-- =======================================================================

CREATE TABLE BackgroundJobs (
    BackgroundJobID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NULL,
    JobType VARCHAR(100) NOT NULL, -- 'SiiSend','BooksGenerate','MarketplaceSync','GatewayReconcile'
    Payload LONGTEXT NULL,
    Status VARCHAR(50) DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Succeeded','Failed','Cancelled','Retrying')),
    RetryCount INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    StartedAt DATETIME NULL,
    CompletedAt DATETIME NULL,
    LastError LONGTEXT NULL,
    CONSTRAINT FK_BackgroundJobs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ApiClients (
    ApiClientID INT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NULL, -- NULL for global apps
    ClientName VARCHAR(100) NOT NULL,
    ClientId VARCHAR(200) NOT NULL UNIQUE,
    ClientSecretEncrypted LONGBLOB NOT NULL,
    IsActive TINYINT(1) DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ApiClients_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ApiLogs (
    ApiLogID BIGINT AUTO_INCREMENT PRIMARY KEY,
    CompanyID INT NULL,
    ApiClientID INT NULL,
    EmployeeID INT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    HttpMethod VARCHAR(10) NULL,
    Endpoint VARCHAR(255) NULL,
    StatusCode INT NULL,
    RequestBody LONGTEXT NULL,
    ResponseBody LONGTEXT NULL,
    IPAddress VARCHAR(45) NULL,
    UserAgent VARCHAR(500) NULL,
    CONSTRAINT FK_ApiLogs_Company FOREIGN KEY (CompanyID) REFERENCES Companies(CompanyID) ON DELETE SET NULL,
    CONSTRAINT FK_ApiLogs_ApiClient FOREIGN KEY (ApiClientID) REFERENCES ApiClients(ApiClientID) ON DELETE SET NULL,
    CONSTRAINT FK_ApiLogs_Employee FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================================
-- XIII. CONSTRAINTS & INDEX IDEAS
-- =======================================================================
-- (Add strategic indexes in the application migration as per workload)
-- Example:
-- CREATE INDEX IX_Sales_Company_SaleDate ON Sales (CompanyID, SaleDate DESC);

