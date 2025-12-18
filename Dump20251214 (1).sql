-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: erp_akkj
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ApiClients`
--

DROP TABLE IF EXISTS `ApiClients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ApiClients` (
  `ApiClientID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int DEFAULT NULL,
  `ClientName` varchar(100) NOT NULL,
  `ClientId` varchar(200) NOT NULL,
  `ClientSecretEncrypted` longblob NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ApiClientID`),
  UNIQUE KEY `ClientId` (`ClientId`),
  KEY `FK_ApiClients_Company` (`CompanyID`),
  CONSTRAINT `FK_ApiClients_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ApiLogs`
--

DROP TABLE IF EXISTS `ApiLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ApiLogs` (
  `ApiLogID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int DEFAULT NULL,
  `ApiClientID` int DEFAULT NULL,
  `EmployeeID` int DEFAULT NULL,
  `Timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `HttpMethod` varchar(10) DEFAULT NULL,
  `Endpoint` varchar(255) DEFAULT NULL,
  `StatusCode` int DEFAULT NULL,
  `RequestBody` longtext,
  `ResponseBody` longtext,
  `IPAddress` varchar(45) DEFAULT NULL,
  `UserAgent` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`ApiLogID`),
  KEY `FK_ApiLogs_Company` (`CompanyID`),
  KEY `FK_ApiLogs_ApiClient` (`ApiClientID`),
  KEY `FK_ApiLogs_Employee` (`EmployeeID`),
  CONSTRAINT `FK_ApiLogs_ApiClient` FOREIGN KEY (`ApiClientID`) REFERENCES `ApiClients` (`ApiClientID`) ON DELETE SET NULL,
  CONSTRAINT `FK_ApiLogs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE SET NULL,
  CONSTRAINT `FK_ApiLogs_Employee` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `AuditLogs`
--

DROP TABLE IF EXISTS `AuditLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuditLogs` (
  `AuditLogID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int DEFAULT NULL,
  `UserID` int DEFAULT NULL,
  `Timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `EntityType` varchar(100) NOT NULL,
  `EntityID` varchar(255) DEFAULT NULL,
  `Action` varchar(50) NOT NULL,
  `OldValues` longtext,
  `NewValues` longtext,
  `IPAddress` varchar(45) DEFAULT NULL,
  `UserAgent` varchar(500) DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`AuditLogID`),
  KEY `FK_AuditLogs_Companies` (`CompanyID`),
  KEY `FK_AuditLogs_Users` (`UserID`),
  CONSTRAINT `FK_AuditLogs_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_AuditLogs_Users` FOREIGN KEY (`UserID`) REFERENCES `Employees` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `BackgroundJobs`
--

DROP TABLE IF EXISTS `BackgroundJobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BackgroundJobs` (
  `BackgroundJobID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int DEFAULT NULL,
  `JobType` varchar(100) NOT NULL,
  `Payload` longtext,
  `Status` varchar(50) DEFAULT 'Queued',
  `RetryCount` int DEFAULT '0',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `StartedAt` datetime DEFAULT NULL,
  `CompletedAt` datetime DEFAULT NULL,
  `LastError` longtext,
  PRIMARY KEY (`BackgroundJobID`),
  KEY `FK_BackgroundJobs_Company` (`CompanyID`),
  CONSTRAINT `FK_BackgroundJobs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE SET NULL,
  CONSTRAINT `BackgroundJobs_chk_1` CHECK ((`Status` in (_utf8mb4'Queued',_utf8mb4'Running',_utf8mb4'Succeeded',_utf8mb4'Failed',_utf8mb4'Cancelled',_utf8mb4'Retrying')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `BankAccounts`
--

DROP TABLE IF EXISTS `BankAccounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BankAccounts` (
  `BankAccountID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `GLAccountID` int NOT NULL,
  `AccountName` varchar(100) NOT NULL,
  `AccountNumber` varchar(50) NOT NULL,
  `BankName` varchar(100) DEFAULT NULL,
  `BranchName` varchar(100) DEFAULT NULL,
  `CurrencyID` int NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`BankAccountID`),
  UNIQUE KEY `GLAccountID` (`GLAccountID`),
  UNIQUE KEY `UQ_BankAccount_Company_AccountNumber` (`CompanyID`,`AccountNumber`),
  KEY `FK_BankAccounts_Currencies` (`CurrencyID`),
  CONSTRAINT `FK_BankAccounts_ChartOfAccounts` FOREIGN KEY (`GLAccountID`) REFERENCES `ChartOfAccounts` (`AccountID`),
  CONSTRAINT `FK_BankAccounts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BankAccounts_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `Currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `BillOfMaterials`
--

DROP TABLE IF EXISTS `BillOfMaterials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BillOfMaterials` (
  `BOMID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID_FinishedGood` int NOT NULL,
  `BOMName` varchar(100) NOT NULL,
  `Version` varchar(20) DEFAULT '1.0',
  `IsActive` tinyint(1) DEFAULT '1',
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`BOMID`),
  UNIQUE KEY `UQ_BOM_Company_Product_Version` (`CompanyID`,`ProductID_FinishedGood`,`Version`),
  KEY `FK_BOM_Products_Finished` (`ProductID_FinishedGood`),
  CONSTRAINT `FK_BOM_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BOM_Products_Finished` FOREIGN KEY (`ProductID_FinishedGood`) REFERENCES `Products` (`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `BomItems`
--

DROP TABLE IF EXISTS `BomItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BomItems` (
  `BOMItemID` int NOT NULL AUTO_INCREMENT,
  `BOMID` int NOT NULL,
  `ComponentProductID` int NOT NULL,
  `QuantityRequired` decimal(18,4) NOT NULL,
  `UnitID_Component` int NOT NULL,
  `ScrapPercentage` decimal(5,4) DEFAULT '0.0000',
  PRIMARY KEY (`BOMItemID`),
  KEY `FK_BOMItems_BOM` (`BOMID`),
  KEY `FK_BOMItems_ComponentProduct` (`ComponentProductID`),
  KEY `FK_BOMItems_Units` (`UnitID_Component`),
  CONSTRAINT `FK_BOMItems_BOM` FOREIGN KEY (`BOMID`) REFERENCES `BillOfMaterials` (`BOMID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BOMItems_ComponentProduct` FOREIGN KEY (`ComponentProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_BOMItems_Units` FOREIGN KEY (`UnitID_Component`) REFERENCES `UnitsOfMeasure` (`UnitID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ChartOfAccounts`
--

DROP TABLE IF EXISTS `ChartOfAccounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ChartOfAccounts` (
  `AccountID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `AccountNumber` varchar(20) NOT NULL,
  `AccountName` varchar(255) NOT NULL,
  `AccountType` varchar(50) NOT NULL,
  `ParentAccountID` int DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `NormalBalance` varchar(10) DEFAULT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`AccountID`),
  UNIQUE KEY `UQ_ChartOfAccounts_Company_AccountNumber` (`CompanyID`,`AccountNumber`),
  KEY `FK_ChartOfAccounts_Parent` (`ParentAccountID`),
  CONSTRAINT `FK_ChartOfAccounts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ChartOfAccounts_Parent` FOREIGN KEY (`ParentAccountID`) REFERENCES `ChartOfAccounts` (`AccountID`),
  CONSTRAINT `ChartOfAccounts_chk_1` CHECK ((`AccountType` in (_utf8mb4'Asset',_utf8mb4'Liability',_utf8mb4'Equity',_utf8mb4'Revenue',_utf8mb4'Expense',_utf8mb4'CostOfGoodsSold'))),
  CONSTRAINT `ChartOfAccounts_chk_2` CHECK ((`NormalBalance` in (_utf8mb4'Debit',_utf8mb4'Credit')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Companies`
--

DROP TABLE IF EXISTS `Companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Companies` (
  `CompanyID` int NOT NULL AUTO_INCREMENT,
  `CompanyName` varchar(255) NOT NULL,
  `LegalName` varchar(255) DEFAULT NULL,
  `TaxID` varchar(50) DEFAULT NULL,
  `AddressLine1` varchar(255) DEFAULT NULL,
  `AddressLine2` varchar(255) DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `StateOrProvince` varchar(100) DEFAULT NULL,
  `PostalCode` varchar(20) DEFAULT NULL,
  `CountryCode` char(2) DEFAULT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Website` varchar(255) DEFAULT NULL,
  `LogoURL` varchar(500) DEFAULT NULL,
  `DefaultCurrencyID` int DEFAULT NULL,
  `DefaultLanguageCode` char(2) DEFAULT 'ES',
  `SiiEnvironment` varchar(20) DEFAULT 'Certificacion',
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CompanyID`),
  KEY `FK_Companies_DefaultCurrency` (`DefaultCurrencyID`),
  CONSTRAINT `FK_Companies_DefaultCurrency` FOREIGN KEY (`DefaultCurrencyID`) REFERENCES `Currencies` (`CurrencyID`),
  CONSTRAINT `Companies_chk_1` CHECK ((`SiiEnvironment` in (_utf8mb4'Certificacion',_utf8mb4'Produccion')))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanyCurrencies`
--

DROP TABLE IF EXISTS `CompanyCurrencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanyCurrencies` (
  `CompanyCurrencyID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CurrencyID` int NOT NULL,
  `IsDefaultOperatingCurrency` tinyint(1) DEFAULT '0',
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CompanyCurrencyID`),
  UNIQUE KEY `UQ_CompanyCurrency` (`CompanyID`,`CurrencyID`),
  KEY `FK_CompanyCurrencies_Currencies` (`CurrencyID`),
  CONSTRAINT `FK_CompanyCurrencies_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyCurrencies_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `Currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanyCustomFeatureLimits`
--

DROP TABLE IF EXISTS `CompanyCustomFeatureLimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanyCustomFeatureLimits` (
  `CompanyCustomFeatureLimitID` int NOT NULL AUTO_INCREMENT,
  `CompanySubscriptionID` int NOT NULL,
  `ModuleID` int DEFAULT NULL,
  `FeatureLimitID` int NOT NULL,
  `CustomLimitValue` bigint NOT NULL,
  `CustomOverageCharge` decimal(10,4) DEFAULT NULL,
  `CustomOverageUnit` bigint DEFAULT NULL,
  `CustomEnforcementType` varchar(20) DEFAULT NULL,
  `EffectiveDate` date NOT NULL,
  `ExpiryDate` date DEFAULT NULL,
  PRIMARY KEY (`CompanyCustomFeatureLimitID`),
  UNIQUE KEY `UQ_CompanySubscription_Feature_Module_Limit` (`CompanySubscriptionID`,`FeatureLimitID`,`ModuleID`),
  KEY `FK_CompanyCustomFeatureLimits_Modules` (`ModuleID`),
  KEY `FK_CompanyCustomFeatureLimits_Features` (`FeatureLimitID`),
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `FeatureLimits` (`FeatureLimitID`),
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `Modules` (`ModuleID`),
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Subscriptions` FOREIGN KEY (`CompanySubscriptionID`) REFERENCES `CompanySubscriptions` (`CompanySubscriptionID`) ON DELETE CASCADE,
  CONSTRAINT `CompanyCustomFeatureLimits_chk_1` CHECK ((`CustomEnforcementType` in (_utf8mb4'Soft',_utf8mb4'Hard',_utf8mb4'Notify')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanyMarketplaceConnections`
--

DROP TABLE IF EXISTS `CompanyMarketplaceConnections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanyMarketplaceConnections` (
  `CompanyMarketplaceConnectionID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `MarketplaceID` int NOT NULL,
  `StoreName` varchar(100) DEFAULT NULL,
  `ApiKeyEncrypted` longblob,
  `ApiSecretEncrypted` longblob,
  `AccessTokenEncrypted` longblob,
  `RefreshTokenEncrypted` longblob,
  `TokenExpiry` datetime DEFAULT NULL,
  `AppSpecificID` varchar(255) DEFAULT NULL,
  `IsEnabled` tinyint(1) DEFAULT '0',
  `DefaultWarehouseID` int DEFAULT NULL,
  `SyncProducts` tinyint(1) DEFAULT '0',
  `SyncOrders` tinyint(1) DEFAULT '0',
  `SyncInventory` tinyint(1) DEFAULT '0',
  `LastSyncProducts` datetime DEFAULT NULL,
  `LastSyncOrders` datetime DEFAULT NULL,
  `LastSyncInventory` datetime DEFAULT NULL,
  PRIMARY KEY (`CompanyMarketplaceConnectionID`),
  UNIQUE KEY `UQ_Company_Marketplace_AppID` (`CompanyID`,`MarketplaceID`,`AppSpecificID`),
  KEY `FK_CompanyMarketplaceConnections_Marketplaces` (`MarketplaceID`),
  KEY `FK_CompanyMarketplaceConnections_Warehouses` (`DefaultWarehouseID`),
  CONSTRAINT `FK_CompanyMarketplaceConnections_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyMarketplaceConnections_Marketplaces` FOREIGN KEY (`MarketplaceID`) REFERENCES `MarketPlaces` (`MarketplaceID`),
  CONSTRAINT `FK_CompanyMarketplaceConnections_Warehouses` FOREIGN KEY (`DefaultWarehouseID`) REFERENCES `Warehouses` (`WarehouseID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanyPaymentGatewayConnections`
--

DROP TABLE IF EXISTS `CompanyPaymentGatewayConnections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanyPaymentGatewayConnections` (
  `CompanyPaymentGatewayConnectionID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PaymentGatewayID` int NOT NULL,
  `CommerceCode` varchar(100) DEFAULT NULL,
  `ApiKeyEncrypted` longblob,
  `ApiSecretEncrypted` longblob,
  `AccessTokenEncrypted` longblob,
  `RefreshTokenEncrypted` longblob,
  `TokenExpiry` datetime DEFAULT NULL,
  `IsEnabled` tinyint(1) DEFAULT '0',
  `LastSyncAt` datetime DEFAULT NULL,
  PRIMARY KEY (`CompanyPaymentGatewayConnectionID`),
  UNIQUE KEY `UQ_CPGC` (`CompanyID`,`PaymentGatewayID`),
  KEY `FK_CPGC_Gateway` (`PaymentGatewayID`),
  CONSTRAINT `FK_CPGC_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CPGC_Gateway` FOREIGN KEY (`PaymentGatewayID`) REFERENCES `PaymentGateways` (`PaymentGatewayID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanySubscribedAddons`
--

DROP TABLE IF EXISTS `CompanySubscribedAddons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanySubscribedAddons` (
  `CompanySubscribedAddonID` int NOT NULL AUTO_INCREMENT,
  `CompanySubscriptionID` int NOT NULL,
  `ModuleID` int NOT NULL,
  `SubscribedDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `PriceAtSubscription` decimal(10,2) NOT NULL,
  `BillingCycle` varchar(20) NOT NULL,
  `NextBillingDateForAddon` date DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CompanySubscribedAddonID`),
  UNIQUE KEY `UQ_CompanySubscription_ModuleAddon` (`CompanySubscriptionID`,`ModuleID`),
  KEY `FK_CompanySubscribedAddons_Modules` (`ModuleID`),
  CONSTRAINT `FK_CompanySubscribedAddons_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `Modules` (`ModuleID`),
  CONSTRAINT `FK_CompanySubscribedAddons_Subscriptions` FOREIGN KEY (`CompanySubscriptionID`) REFERENCES `CompanySubscriptions` (`CompanySubscriptionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanySubscriptions`
--

DROP TABLE IF EXISTS `CompanySubscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanySubscriptions` (
  `CompanySubscriptionID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PlanID` int NOT NULL,
  `StartDate` datetime NOT NULL,
  `EndDate` datetime DEFAULT NULL,
  `NextBillingDate` date NOT NULL,
  `Status` varchar(50) DEFAULT 'Active',
  `TrialEndDate` date DEFAULT NULL,
  `AutoRenew` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CompanySubscriptionID`),
  UNIQUE KEY `CompanyID` (`CompanyID`),
  KEY `FK_CompanySubscriptions_Plans` (`PlanID`),
  CONSTRAINT `FK_CompanySubscriptions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanySubscriptions_Plans` FOREIGN KEY (`PlanID`) REFERENCES `SubscriptionPlans` (`PlanID`),
  CONSTRAINT `CompanySubscriptions_chk_1` CHECK ((`Status` in (_utf8mb4'Active',_utf8mb4'Trial',_utf8mb4'PastDue',_utf8mb4'Cancelled',_utf8mb4'Expired')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CompanyUsageRecords`
--

DROP TABLE IF EXISTS `CompanyUsageRecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CompanyUsageRecords` (
  `CompanyUsageRecordID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `FeatureLimitID` int NOT NULL,
  `BillingPeriodStartDate` date NOT NULL,
  `BillingPeriodEndDate` date NOT NULL,
  `CurrentUsage` bigint NOT NULL,
  `PeakUsage` bigint DEFAULT NULL,
  `RecordedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CompanyUsageRecordID`),
  KEY `FK_CompanyUsageRecords_Companies` (`CompanyID`),
  KEY `FK_CompanyUsageRecords_Features` (`FeatureLimitID`),
  CONSTRAINT `FK_CompanyUsageRecords_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyUsageRecords_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `FeatureLimits` (`FeatureLimitID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Currencies`
--

DROP TABLE IF EXISTS `Currencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Currencies` (
  `CurrencyID` int NOT NULL AUTO_INCREMENT,
  `CurrencyCode` char(3) NOT NULL,
  `CurrencyName` varchar(100) NOT NULL,
  `Symbol` varchar(10) DEFAULT NULL,
  `DecimalPlaces` int DEFAULT '0',
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CurrencyID`),
  UNIQUE KEY `CurrencyCode` (`CurrencyCode`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CustomerGroups`
--

DROP TABLE IF EXISTS `CustomerGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CustomerGroups` (
  `CustomerGroupID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `GroupName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CustomerGroupID`),
  UNIQUE KEY `UQ_CustomerGroups` (`CompanyID`,`GroupName`),
  CONSTRAINT `FK_CustomerGroups_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CustomerReceipts`
--

DROP TABLE IF EXISTS `CustomerReceipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CustomerReceipts` (
  `CustomerReceiptID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CustomerID` int NOT NULL,
  `ReceiptDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Amount` decimal(18,4) NOT NULL,
  `PaymentMethodID` int NOT NULL,
  `BankAccountID` int DEFAULT NULL,
  `ReferenceNumber` varchar(100) DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`CustomerReceiptID`),
  KEY `FK_CustomerReceipts_Company` (`CompanyID`),
  KEY `FK_CustomerReceipts_Customer` (`CustomerID`),
  KEY `FK_CustomerReceipts_Method` (`PaymentMethodID`),
  KEY `FK_CustomerReceipts_Bank` (`BankAccountID`),
  CONSTRAINT `FK_CustomerReceipts_Bank` FOREIGN KEY (`BankAccountID`) REFERENCES `BankAccounts` (`BankAccountID`),
  CONSTRAINT `FK_CustomerReceipts_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CustomerReceipts_Customer` FOREIGN KEY (`CustomerID`) REFERENCES `Customers` (`CustomerID`),
  CONSTRAINT `FK_CustomerReceipts_Method` FOREIGN KEY (`PaymentMethodID`) REFERENCES `PaymentMethods` (`PaymentMethodID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Customers`
--

DROP TABLE IF EXISTS `Customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Customers` (
  `CustomerID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CustomerName` varchar(255) NOT NULL,
  `ContactPerson` varchar(150) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `TaxID` varchar(50) DEFAULT NULL,
  `BillingAddressLine1` varchar(255) DEFAULT NULL,
  `BillingCity` varchar(100) DEFAULT NULL,
  `ShippingAddressLine1` varchar(255) DEFAULT NULL,
  `ShippingCity` varchar(100) DEFAULT NULL,
  `CustomerGroupID` int DEFAULT NULL,
  `CreditLimit` decimal(18,2) DEFAULT '0.00',
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CustomerID`),
  UNIQUE KEY `UQ_Customer_Company_TaxID` (`CompanyID`,`TaxID`),
  KEY `FK_Customers_Group` (`CustomerGroupID`),
  CONSTRAINT `FK_Customers_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Customers_Group` FOREIGN KEY (`CustomerGroupID`) REFERENCES `CustomerGroups` (`CustomerGroupID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `DigitalCertificates`
--

DROP TABLE IF EXISTS `DigitalCertificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DigitalCertificates` (
  `DigitalCertificateID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CertSerial` varchar(200) NOT NULL,
  `ValidFrom` datetime NOT NULL,
  `ValidTo` datetime NOT NULL,
  `CertFileEncrypted` longblob NOT NULL,
  `CertPasswordEncrypted` longblob,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`DigitalCertificateID`),
  UNIQUE KEY `UQ_DigitalCertificates` (`CompanyID`,`CertSerial`),
  CONSTRAINT `FK_DigitalCertificates_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `DocumentSequences`
--

DROP TABLE IF EXISTS `DocumentSequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DocumentSequences` (
  `DocumentSequenceID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `DocumentType` varchar(50) NOT NULL,
  `Prefix` varchar(20) DEFAULT NULL,
  `NextNumber` bigint NOT NULL DEFAULT '1',
  `Suffix` varchar(20) DEFAULT NULL,
  `FormatString` varchar(100) DEFAULT NULL,
  `IsElectronic` tinyint(1) DEFAULT '1',
  `RangeStart` bigint DEFAULT NULL,
  `RangeEnd` bigint DEFAULT NULL,
  `LastUsedAt` datetime DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`DocumentSequenceID`),
  UNIQUE KEY `UQ_DocumentSequences_Company_Type_Electronic` (`CompanyID`,`DocumentType`,`IsElectronic`),
  CONSTRAINT `FK_DocumentSequences_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `EmployeeContracts`
--

DROP TABLE IF EXISTS `EmployeeContracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EmployeeContracts` (
  `EmployeeContractID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `EmployeeID` int NOT NULL,
  `StartDate` date NOT NULL,
  `EndDate` date DEFAULT NULL,
  `JobTitle` varchar(100) DEFAULT NULL,
  `EmploymentType` varchar(50) DEFAULT NULL,
  `Salary` decimal(18,4) DEFAULT NULL,
  `PayFrequency` varchar(50) DEFAULT NULL,
  `WorkHoursPerWeek` decimal(5,2) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`EmployeeContractID`),
  KEY `FK_EmployeeContracts_Companies` (`CompanyID`),
  KEY `FK_EmployeeContracts_Employees` (`EmployeeID`),
  CONSTRAINT `FK_EmployeeContracts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_EmployeeContracts_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`) ON DELETE CASCADE,
  CONSTRAINT `EmployeeContracts_chk_1` CHECK ((`EmploymentType` in (_utf8mb4'Full-time',_utf8mb4'Part-time',_utf8mb4'Contract',_utf8mb4'Intern'))),
  CONSTRAINT `EmployeeContracts_chk_2` CHECK ((`PayFrequency` in (_utf8mb4'Monthly',_utf8mb4'Bi-weekly',_utf8mb4'Weekly',_utf8mb4'Hourly')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `EmployeeRoles`
--

DROP TABLE IF EXISTS `EmployeeRoles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EmployeeRoles` (
  `EmployeeRoleID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int NOT NULL,
  `RoleID` int NOT NULL,
  PRIMARY KEY (`EmployeeRoleID`),
  UNIQUE KEY `UQ_Employee_Role` (`EmployeeID`,`RoleID`),
  KEY `FK_EmployeeRoles_Role` (`RoleID`),
  CONSTRAINT `FK_EmployeeRoles_Employee` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`) ON DELETE CASCADE,
  CONSTRAINT `FK_EmployeeRoles_Role` FOREIGN KEY (`RoleID`) REFERENCES `Roles` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Employees`
--

DROP TABLE IF EXISTS `Employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Employees` (
  `EmployeeID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `FirstName` varchar(100) NOT NULL,
  `LastName` varchar(100) NOT NULL,
  `Email` varchar(255) NOT NULL,
  `PasswordHash` longtext NOT NULL,
  `PinHash` varchar(255) DEFAULT NULL,
  `Role` varchar(100) DEFAULT 'Employee',
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `JobTitle` varchar(100) DEFAULT NULL,
  `DepartmentID` int DEFAULT NULL,
  `ReportsToEmployeeID` int DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `LastLoginAt` datetime DEFAULT NULL,
  PRIMARY KEY (`EmployeeID`),
  UNIQUE KEY `UQ_Employee_Company_Email` (`CompanyID`,`Email`),
  KEY `FK_Employees_ReportsTo` (`ReportsToEmployeeID`),
  CONSTRAINT `FK_Employees_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Employees_ReportsTo` FOREIGN KEY (`ReportsToEmployeeID`) REFERENCES `Employees` (`EmployeeID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ExchangeRates`
--

DROP TABLE IF EXISTS `ExchangeRates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ExchangeRates` (
  `ExchangeRateID` int NOT NULL AUTO_INCREMENT,
  `BaseCurrencyID` int NOT NULL,
  `QuoteCurrencyID` int NOT NULL,
  `Rate` decimal(18,8) NOT NULL,
  `RateDate` date NOT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ExchangeRateID`),
  UNIQUE KEY `UQ_ExchangeRates` (`BaseCurrencyID`,`QuoteCurrencyID`,`RateDate`),
  KEY `FK_ExchangeRates_Quote` (`QuoteCurrencyID`),
  CONSTRAINT `FK_ExchangeRates_Base` FOREIGN KEY (`BaseCurrencyID`) REFERENCES `Currencies` (`CurrencyID`),
  CONSTRAINT `FK_ExchangeRates_Quote` FOREIGN KEY (`QuoteCurrencyID`) REFERENCES `Currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `FeatureLimits`
--

DROP TABLE IF EXISTS `FeatureLimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FeatureLimits` (
  `FeatureLimitID` int NOT NULL AUTO_INCREMENT,
  `LimitName` varchar(100) NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `UnitOfMeasure` varchar(50) DEFAULT NULL,
  `DefaultValue` bigint DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`FeatureLimitID`),
  UNIQUE KEY `LimitName` (`LimitName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `FinancialPeriods`
--

DROP TABLE IF EXISTS `FinancialPeriods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FinancialPeriods` (
  `FinancialPeriodID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PeriodName` varchar(100) NOT NULL,
  `StartDate` date NOT NULL,
  `EndDate` date NOT NULL,
  `Status` varchar(20) DEFAULT 'Open',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`FinancialPeriodID`),
  UNIQUE KEY `UQ_FinancialPeriods_Company_PeriodName` (`CompanyID`,`PeriodName`),
  UNIQUE KEY `UQ_FinancialPeriods_Company_Dates` (`CompanyID`,`StartDate`,`EndDate`),
  CONSTRAINT `FK_FinancialPeriods_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FinancialPeriods_chk_1` CHECK ((`Status` in (_utf8mb4'Open',_utf8mb4'Closed',_utf8mb4'Archived')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GoodsReceiptItems`
--

DROP TABLE IF EXISTS `GoodsReceiptItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GoodsReceiptItems` (
  `GoodsReceiptItemID` int NOT NULL AUTO_INCREMENT,
  `GoodsReceiptID` int NOT NULL,
  `PurchaseOrderItemID` int DEFAULT NULL,
  `ProductID` int NOT NULL,
  `QuantityReceived` decimal(18,4) NOT NULL,
  `UnitPrice` decimal(18,4) DEFAULT NULL,
  `ProductLotID` int DEFAULT NULL,
  `ProductSerialID` int DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`GoodsReceiptItemID`),
  KEY `FK_GoodsReceiptItems_GoodsReceipts` (`GoodsReceiptID`),
  KEY `FK_GoodsReceiptItems_PurchaseOrderItems` (`PurchaseOrderItemID`),
  KEY `FK_GoodsReceiptItems_Products` (`ProductID`),
  KEY `FK_GoodsReceiptItems_Lot` (`ProductLotID`),
  KEY `FK_GoodsReceiptItems_Serial` (`ProductSerialID`),
  CONSTRAINT `FK_GoodsReceiptItems_GoodsReceipts` FOREIGN KEY (`GoodsReceiptID`) REFERENCES `GoodsReceipts` (`GoodsReceiptID`) ON DELETE CASCADE,
  CONSTRAINT `FK_GoodsReceiptItems_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `ProductLots` (`ProductLotID`),
  CONSTRAINT `FK_GoodsReceiptItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_GoodsReceiptItems_PurchaseOrderItems` FOREIGN KEY (`PurchaseOrderItemID`) REFERENCES `PurchaseOrderItems` (`PurchaseOrderItemID`),
  CONSTRAINT `FK_GoodsReceiptItems_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `Productserials` (`ProductSerialID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GoodsReceipts`
--

DROP TABLE IF EXISTS `GoodsReceipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GoodsReceipts` (
  `GoodsReceiptID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PurchaseOrderID` int DEFAULT NULL,
  `SupplierID` int NOT NULL,
  `ReceiptDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `ReceiptNumber` varchar(50) NOT NULL,
  `SupplierGuiaDespachoNumber` varchar(50) DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  `ReceivedByEmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`GoodsReceiptID`),
  UNIQUE KEY `UQ_GoodsReceipt_Company_Number` (`CompanyID`,`ReceiptNumber`),
  KEY `FK_GoodsReceipts_PurchaseOrders` (`PurchaseOrderID`),
  KEY `FK_GoodsReceipts_Suppliers` (`SupplierID`),
  KEY `FK_GoodsReceipts_Employees` (`ReceivedByEmployeeID`),
  CONSTRAINT `FK_GoodsReceipts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_GoodsReceipts_Employees` FOREIGN KEY (`ReceivedByEmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_GoodsReceipts_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `PurchaseOrders` (`PurchaseOrderID`),
  CONSTRAINT `FK_GoodsReceipts_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `Suppliers` (`SupplierID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `InventoryTransactions`
--

DROP TABLE IF EXISTS `InventoryTransactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InventoryTransactions` (
  `InventoryTransactionID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `WarehouseID` int NOT NULL,
  `TransactionType` varchar(50) NOT NULL,
  `QuantityChange` decimal(18,4) NOT NULL,
  `TransactionDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `ReferenceDocumentType` varchar(50) DEFAULT NULL,
  `ReferenceDocumentID` int DEFAULT NULL,
  `ProductLotID` int DEFAULT NULL,
  `ProductSerialID` int DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  `EmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`InventoryTransactionID`),
  KEY `FK_InventoryTransactions_Companies` (`CompanyID`),
  KEY `FK_InventoryTransactions_Products` (`ProductID`),
  KEY `FK_InventoryTransactions_Warehouses` (`WarehouseID`),
  KEY `FK_InventoryTransactions_Employees` (`EmployeeID`),
  KEY `FK_InventoryTransactions_Lot` (`ProductLotID`),
  KEY `FK_InventoryTransactions_Serial` (`ProductSerialID`),
  CONSTRAINT `FK_InventoryTransactions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_InventoryTransactions_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_InventoryTransactions_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `ProductLots` (`ProductLotID`),
  CONSTRAINT `FK_InventoryTransactions_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_InventoryTransactions_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `Productserials` (`ProductSerialID`),
  CONSTRAINT `FK_InventoryTransactions_Warehouses` FOREIGN KEY (`WarehouseID`) REFERENCES `Warehouses` (`WarehouseID`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `JournalEntries`
--

DROP TABLE IF EXISTS `JournalEntries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `JournalEntries` (
  `JournalEntryID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `EntryDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `FinancialPeriodID` int NOT NULL,
  `ReferenceNumber` varchar(100) DEFAULT NULL,
  `Description` varchar(1000) DEFAULT NULL,
  `SourceDocumentType` varchar(50) DEFAULT NULL,
  `SourceDocumentID` int DEFAULT NULL,
  `IsPosted` tinyint(1) DEFAULT '0',
  `PostedByEmployeeID` int DEFAULT NULL,
  `PostedAt` datetime DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`JournalEntryID`),
  KEY `FK_JournalEntries_Companies` (`CompanyID`),
  KEY `FK_JournalEntries_FinancialPeriods` (`FinancialPeriodID`),
  KEY `FK_JournalEntries_PostedBy` (`PostedByEmployeeID`),
  CONSTRAINT `FK_JournalEntries_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_JournalEntries_FinancialPeriods` FOREIGN KEY (`FinancialPeriodID`) REFERENCES `FinancialPeriods` (`FinancialPeriodID`),
  CONSTRAINT `FK_JournalEntries_PostedBy` FOREIGN KEY (`PostedByEmployeeID`) REFERENCES `Employees` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `JournalEntryItems`
--

DROP TABLE IF EXISTS `JournalEntryItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `JournalEntryItems` (
  `JournalEntryItemID` int NOT NULL AUTO_INCREMENT,
  `JournalEntryID` int NOT NULL,
  `AccountID` int NOT NULL,
  `DebitAmount` decimal(18,4) DEFAULT '0.0000',
  `CreditAmount` decimal(18,4) DEFAULT '0.0000',
  `Description` varchar(500) DEFAULT NULL,
  `ContactType` varchar(50) DEFAULT NULL,
  `ContactID` int DEFAULT NULL,
  PRIMARY KEY (`JournalEntryItemID`),
  KEY `FK_JournalEntryItems_JournalEntries` (`JournalEntryID`),
  KEY `FK_JournalEntryItems_ChartOfAccounts` (`AccountID`),
  CONSTRAINT `FK_JournalEntryItems_ChartOfAccounts` FOREIGN KEY (`AccountID`) REFERENCES `ChartOfAccounts` (`AccountID`),
  CONSTRAINT `FK_JournalEntryItems_JournalEntries` FOREIGN KEY (`JournalEntryID`) REFERENCES `JournalEntries` (`JournalEntryID`) ON DELETE CASCADE,
  CONSTRAINT `CK_JournalEntryItems_DebitOrCredit` CHECK ((((`DebitAmount` <> 0) and (`CreditAmount` = 0)) or ((`CreditAmount` <> 0) and (`DebitAmount` = 0)))),
  CONSTRAINT `JournalEntryItems_chk_1` CHECK ((`ContactType` in (_utf8mb4'Customer',_utf8mb4'Supplier',_utf8mb4'Employee')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LibroCompras`
--

DROP TABLE IF EXISTS `LibroCompras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LibroCompras` (
  `LibroComprasID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PeriodoMes` char(7) NOT NULL,
  `TotalComprasNeto` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalIVA` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalExento` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `ArchivoGenerado` varchar(500) DEFAULT NULL,
  `EnviadoSII` tinyint(1) DEFAULT '0',
  `FechaEnvio` datetime DEFAULT NULL,
  PRIMARY KEY (`LibroComprasID`),
  UNIQUE KEY `UQ_LibroCompras` (`CompanyID`,`PeriodoMes`),
  CONSTRAINT `FK_LibroCompras_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LibroVentas`
--

DROP TABLE IF EXISTS `LibroVentas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LibroVentas` (
  `LibroVentasID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PeriodoMes` char(7) NOT NULL,
  `TotalVentasNeto` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalIVA` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalExento` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `ArchivoGenerado` varchar(500) DEFAULT NULL,
  `EnviadoSII` tinyint(1) DEFAULT '0',
  `FechaEnvio` datetime DEFAULT NULL,
  PRIMARY KEY (`LibroVentasID`),
  UNIQUE KEY `UQ_LibroVentas` (`CompanyID`,`PeriodoMes`),
  CONSTRAINT `FK_LibroVentas_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LoginSessions`
--

DROP TABLE IF EXISTS `LoginSessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LoginSessions` (
  `LoginSessionID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `EmployeeID` int NOT NULL,
  `SessionToken` longblob NOT NULL,
  `IssuedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `ExpiresAt` datetime DEFAULT NULL,
  `RevokedAt` datetime DEFAULT NULL,
  `IPAddress` varchar(45) DEFAULT NULL,
  `UserAgent` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`LoginSessionID`),
  KEY `FK_LoginSessions_Companies` (`CompanyID`),
  KEY `FK_LoginSessions_Employees` (`EmployeeID`),
  CONSTRAINT `FK_LoginSessions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_LoginSessions_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LoyaltyPoints`
--

DROP TABLE IF EXISTS `LoyaltyPoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LoyaltyPoints` (
  `LoyaltyPointID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CustomerID` int NOT NULL,
  `PointsEarned` int DEFAULT '0',
  `PointsRedeemed` int DEFAULT '0',
  `Event` varchar(100) NOT NULL,
  `EventDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`LoyaltyPointID`),
  KEY `FK_LoyaltyPoints_Company` (`CompanyID`),
  KEY `FK_LoyaltyPoints_Customer` (`CustomerID`),
  CONSTRAINT `FK_LoyaltyPoints_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_LoyaltyPoints_Customer` FOREIGN KEY (`CustomerID`) REFERENCES `Customers` (`CustomerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `MarketPlaces`
--

DROP TABLE IF EXISTS `MarketPlaces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MarketPlaces` (
  `MarketplaceID` int NOT NULL AUTO_INCREMENT,
  `MarketplaceCode` varchar(50) NOT NULL,
  `MarketplaceName` varchar(100) NOT NULL,
  `ApiBaseUrl` varchar(255) DEFAULT NULL,
  `AuthenticationType` varchar(50) DEFAULT NULL,
  `SupportsProductSync` tinyint(1) DEFAULT '0',
  `SupportsOrderSync` tinyint(1) DEFAULT '0',
  `SupportsInventorySync` tinyint(1) DEFAULT '0',
  `SupportsPricingSync` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`MarketplaceID`),
  UNIQUE KEY `MarketplaceCode` (`MarketplaceCode`),
  CONSTRAINT `MarketPlaces_chk_1` CHECK ((`AuthenticationType` in (_utf8mb4'OAuth2',_utf8mb4'APIKeyToken',_utf8mb4'Custom')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `MarketPlacesynclogs`
--

DROP TABLE IF EXISTS `MarketPlacesynclogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MarketPlacesynclogs` (
  `MarketplaceSyncLogID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyMarketplaceConnectionID` int NOT NULL,
  `SyncType` varchar(50) NOT NULL,
  `StartTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `EndTime` datetime DEFAULT NULL,
  `Status` varchar(50) NOT NULL,
  `RecordsProcessed` int DEFAULT '0',
  `RecordsFailed` int DEFAULT '0',
  `LogDetails` longtext,
  PRIMARY KEY (`MarketplaceSyncLogID`),
  KEY `FK_MarketplaceSyncLogs_Connections` (`CompanyMarketplaceConnectionID`),
  CONSTRAINT `FK_MarketplaceSyncLogs_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `CompanyMarketplaceConnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `MarketPlacesynclogs_chk_1` CHECK ((`SyncType` in (_utf8mb4'Products',_utf8mb4'Orders',_utf8mb4'Inventory',_utf8mb4'Pricing',_utf8mb4'General'))),
  CONSTRAINT `MarketPlacesynclogs_chk_2` CHECK ((`Status` in (_utf8mb4'InProgress',_utf8mb4'Completed',_utf8mb4'Failed',_utf8mb4'CompletedWithErrors')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Modules`
--

DROP TABLE IF EXISTS `Modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Modules` (
  `ModuleID` int NOT NULL AUTO_INCREMENT,
  `ModuleCode` varchar(50) NOT NULL,
  `ModuleName` varchar(100) NOT NULL,
  `Description` varchar(1000) DEFAULT NULL,
  `IsStandAloneAddon` tinyint(1) DEFAULT '0',
  `AddonPrice` decimal(10,2) DEFAULT NULL,
  `DefaultBillingCycle` varchar(20) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ModuleID`),
  UNIQUE KEY `ModuleCode` (`ModuleCode`),
  CONSTRAINT `Modules_chk_1` CHECK ((`DefaultBillingCycle` in (_utf8mb4'Monthly',_utf8mb4'Annually',_utf8mb4'OneTime')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrderMarketplaceMappings`
--

DROP TABLE IF EXISTS `OrderMarketplaceMappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderMarketplaceMappings` (
  `OrderMarketplaceMappingID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SaleID` int NOT NULL,
  `CompanyMarketplaceConnectionID` int NOT NULL,
  `MarketplaceOrderID_External` varchar(255) NOT NULL,
  `MarketplaceOrderStatus_External` varchar(100) DEFAULT NULL,
  `OrderDownloadedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `LastMarketplaceUpdateAt` datetime DEFAULT NULL,
  `RawOrderDataJson` longtext,
  PRIMARY KEY (`OrderMarketplaceMappingID`),
  UNIQUE KEY `SaleID` (`SaleID`),
  UNIQUE KEY `UQ_MarketplaceOrder_Connection` (`CompanyMarketplaceConnectionID`,`MarketplaceOrderID_External`),
  KEY `FK_OrderMarketplaceMappings_Companies` (`CompanyID`),
  CONSTRAINT `FK_OrderMarketplaceMappings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`),
  CONSTRAINT `FK_OrderMarketplaceMappings_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `CompanyMarketplaceConnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_OrderMarketplaceMappings_Sales` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PaymentGateways`
--

DROP TABLE IF EXISTS `PaymentGateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PaymentGateways` (
  `PaymentGatewayID` int NOT NULL AUTO_INCREMENT,
  `GatewayCode` varchar(50) NOT NULL,
  `GatewayName` varchar(100) NOT NULL,
  `ApiBaseUrl` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`PaymentGatewayID`),
  UNIQUE KEY `GatewayCode` (`GatewayCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PaymentMethods`
--

DROP TABLE IF EXISTS `PaymentMethods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PaymentMethods` (
  `PaymentMethodID` int NOT NULL AUTO_INCREMENT,
  `MethodName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`PaymentMethodID`),
  UNIQUE KEY `MethodName` (`MethodName`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payrollRuns`
--

DROP TABLE IF EXISTS `payrollRuns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payrollRuns` (
  `PayrollRunID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PayPeriodStartDate` date NOT NULL,
  `PayPeriodEndDate` date NOT NULL,
  `PaymentDate` date NOT NULL,
  `Status` varchar(50) DEFAULT 'Pending',
  `ProcessedByEmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`PayrollRunID`),
  KEY `FK_PayrollRuns_Companies` (`CompanyID`),
  KEY `FK_PayrollRuns_ProcessedBy` (`ProcessedByEmployeeID`),
  CONSTRAINT `FK_PayrollRuns_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PayrollRuns_ProcessedBy` FOREIGN KEY (`ProcessedByEmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `payrollRuns_chk_1` CHECK ((`Status` in (_utf8mb4'Pending',_utf8mb4'Processing',_utf8mb4'Completed',_utf8mb4'Cancelled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PayslipItems`
--

DROP TABLE IF EXISTS `PayslipItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PayslipItems` (
  `PayslipItemID` int NOT NULL AUTO_INCREMENT,
  `PayslipID` int NOT NULL,
  `ItemType` varchar(50) NOT NULL,
  `Description` varchar(255) NOT NULL,
  `Amount` decimal(18,4) NOT NULL,
  `GLAccountID` int DEFAULT NULL,
  PRIMARY KEY (`PayslipItemID`),
  KEY `FK_PayslipItems_Payslips` (`PayslipID`),
  KEY `FK_PayslipItems_ChartOfAccounts` (`GLAccountID`),
  CONSTRAINT `FK_PayslipItems_ChartOfAccounts` FOREIGN KEY (`GLAccountID`) REFERENCES `ChartOfAccounts` (`AccountID`),
  CONSTRAINT `FK_PayslipItems_Payslips` FOREIGN KEY (`PayslipID`) REFERENCES `Payslips` (`PayslipID`) ON DELETE CASCADE,
  CONSTRAINT `PayslipItems_chk_1` CHECK ((`ItemType` in (_utf8mb4'Earning',_utf8mb4'Deduction',_utf8mb4'CompanyContribution',_utf8mb4'Tax')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Payslips`
--

DROP TABLE IF EXISTS `Payslips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Payslips` (
  `PayslipID` int NOT NULL AUTO_INCREMENT,
  `PayrollRunID` int NOT NULL,
  `EmployeeID` int NOT NULL,
  `GrossPay` decimal(18,4) NOT NULL,
  `TotalDeductions` decimal(18,4) DEFAULT '0.0000',
  `NetPay` decimal(18,4) NOT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`PayslipID`),
  KEY `FK_Payslips_PayrollRuns` (`PayrollRunID`),
  KEY `FK_Payslips_Employees` (`EmployeeID`),
  CONSTRAINT `FK_Payslips_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_Payslips_PayrollRuns` FOREIGN KEY (`PayrollRunID`) REFERENCES `payrollRuns` (`PayrollRunID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PendingProductCustomfieldValues`
--

DROP TABLE IF EXISTS `PendingProductCustomfieldValues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PendingProductCustomfieldValues` (
  `PendingID` bigint NOT NULL AUTO_INCREMENT,
  `PendingToken` varchar(64) NOT NULL,
  `ProductCustomFieldDefinitionID` int NOT NULL,
  `ValueText` longtext,
  `ValueNumber` decimal(18,4) DEFAULT NULL,
  `ValueBoolean` tinyint(1) DEFAULT NULL,
  `ValueDate` date DEFAULT NULL,
  `ValueJSON` longtext,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`PendingID`),
  UNIQUE KEY `UQ_PendingCF` (`PendingToken`,`ProductCustomFieldDefinitionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `planFeatureLimits`
--

DROP TABLE IF EXISTS `planFeatureLimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planFeatureLimits` (
  `PlanFeatureLimitID` int NOT NULL AUTO_INCREMENT,
  `PlanID` int NOT NULL,
  `FeatureLimitID` int NOT NULL,
  `LimitValue` bigint NOT NULL,
  `OverageCharge` decimal(10,4) DEFAULT NULL,
  `OverageUnit` bigint DEFAULT NULL,
  `EnforcementType` varchar(20) DEFAULT 'Soft',
  PRIMARY KEY (`PlanFeatureLimitID`),
  UNIQUE KEY `UQ_Plan_FeatureLimit` (`PlanID`,`FeatureLimitID`),
  KEY `FK_PlanFeatureLimits_Features` (`FeatureLimitID`),
  CONSTRAINT `FK_PlanFeatureLimits_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `FeatureLimits` (`FeatureLimitID`),
  CONSTRAINT `FK_PlanFeatureLimits_Plans` FOREIGN KEY (`PlanID`) REFERENCES `SubscriptionPlans` (`PlanID`) ON DELETE CASCADE,
  CONSTRAINT `planFeatureLimits_chk_1` CHECK ((`EnforcementType` in (_utf8mb4'Soft',_utf8mb4'Hard',_utf8mb4'Notify')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `planModules`
--

DROP TABLE IF EXISTS `planModules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planModules` (
  `PlanModuleID` int NOT NULL AUTO_INCREMENT,
  `PlanID` int NOT NULL,
  `ModuleID` int NOT NULL,
  PRIMARY KEY (`PlanModuleID`),
  UNIQUE KEY `UQ_PlanModule` (`PlanID`,`ModuleID`),
  KEY `FK_PlanModules_Modules` (`ModuleID`),
  CONSTRAINT `FK_PlanModules_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `Modules` (`ModuleID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PlanModules_Plans` FOREIGN KEY (`PlanID`) REFERENCES `SubscriptionPlans` (`PlanID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PosUserSettings`
--

DROP TABLE IF EXISTS `PosUserSettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PosUserSettings` (
  `POSUserSettingID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `UserID` int NOT NULL,
  `WorkstationIdentifier` varchar(255) DEFAULT NULL,
  `SettingName` varchar(100) NOT NULL,
  `SettingValue` longtext NOT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`POSUserSettingID`),
  UNIQUE KEY `UQ_POSUser_Setting` (`CompanyID`,`UserID`,`WorkstationIdentifier`,`SettingName`),
  KEY `FK_POSUserSettings_Users` (`UserID`),
  CONSTRAINT `FK_POSUserSettings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_POSUserSettings_Users` FOREIGN KEY (`UserID`) REFERENCES `Employees` (`EmployeeID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PricelistItems`
--

DROP TABLE IF EXISTS `PricelistItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PricelistItems` (
  `PriceListItemID` bigint NOT NULL AUTO_INCREMENT,
  `PriceListID` bigint NOT NULL,
  `ProductID` int NOT NULL,
  `MinQty` decimal(18,4) NOT NULL DEFAULT '1.0000',
  `Price` decimal(18,4) NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`PriceListItemID`),
  UNIQUE KEY `UQ_PriceListItem` (`PriceListID`,`ProductID`,`MinQty`),
  KEY `FK_PriceListItems_Products` (`ProductID`),
  CONSTRAINT `FK_PriceListItems_PriceLists` FOREIGN KEY (`PriceListID`) REFERENCES `Pricelists` (`PriceListID`),
  CONSTRAINT `FK_PriceListItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Pricelists`
--

DROP TABLE IF EXISTS `Pricelists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Pricelists` (
  `PriceListID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` bigint NOT NULL,
  `Name` varchar(255) NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`PriceListID`),
  UNIQUE KEY `UQ_PriceLists_Company_Name` (`CompanyID`,`Name`),
  KEY `IX_PriceLists_Company` (`CompanyID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductBrands`
--

DROP TABLE IF EXISTS `ProductBrands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductBrands` (
  `ProductBrandID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `BrandName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductBrandID`),
  UNIQUE KEY `UQ_ProductBrand_Company_Name` (`CompanyID`,`BrandName`),
  CONSTRAINT `FK_ProductBrands_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductCategories`
--

DROP TABLE IF EXISTS `ProductCategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCategories` (
  `ProductCategoryID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CategoryName` varchar(100) NOT NULL,
  `ParentCategoryID` int DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductCategoryID`),
  UNIQUE KEY `UQ_ProductCategory_Company_Name` (`CompanyID`,`CategoryName`,`ParentCategoryID`),
  KEY `FK_ProductCategories_Parent` (`ParentCategoryID`),
  CONSTRAINT `FK_ProductCategories_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductCategories_Parent` FOREIGN KEY (`ParentCategoryID`) REFERENCES `ProductCategories` (`ProductCategoryID`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductCustomfieldDefinitions`
--

DROP TABLE IF EXISTS `ProductCustomfieldDefinitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCustomfieldDefinitions` (
  `ProductCustomFieldDefinitionID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `FieldName` varchar(100) NOT NULL,
  `DataType` varchar(20) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductCustomFieldDefinitionID`),
  UNIQUE KEY `UQ_ProductCFD` (`CompanyID`,`FieldName`),
  CONSTRAINT `FK_ProductCFD_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `ProductCustomfieldDefinitions_chk_1` CHECK ((`DataType` in (_utf8mb4'Text',_utf8mb4'Number',_utf8mb4'Boolean',_utf8mb4'Date',_utf8mb4'JSON')))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductCustomfieldOptions`
--

DROP TABLE IF EXISTS `ProductCustomfieldOptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCustomfieldOptions` (
  `OptionID` int NOT NULL AUTO_INCREMENT,
  `ProductCustomFieldDefinitionID` int NOT NULL,
  `OptionValue` varchar(255) NOT NULL,
  PRIMARY KEY (`OptionID`),
  UNIQUE KEY `UQ_CF_Option` (`ProductCustomFieldDefinitionID`,`OptionValue`),
  CONSTRAINT `FK_CF_Option_Def` FOREIGN KEY (`ProductCustomFieldDefinitionID`) REFERENCES `ProductCustomfieldDefinitions` (`ProductCustomFieldDefinitionID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductCustomfieldValues`
--

DROP TABLE IF EXISTS `ProductCustomfieldValues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCustomfieldValues` (
  `ProductCustomFieldValueID` int NOT NULL AUTO_INCREMENT,
  `ProductID` int NOT NULL,
  `ProductCustomFieldDefinitionID` int NOT NULL,
  `ValueText` longtext,
  `ValueNumber` decimal(18,4) DEFAULT NULL,
  `ValueBoolean` tinyint(1) DEFAULT NULL,
  `ValueDate` date DEFAULT NULL,
  `ValueJSON` longtext,
  PRIMARY KEY (`ProductCustomFieldValueID`),
  UNIQUE KEY `UQ_ProductCFV` (`ProductID`,`ProductCustomFieldDefinitionID`),
  KEY `FK_ProductCFV_Def` (`ProductCustomFieldDefinitionID`),
  CONSTRAINT `FK_ProductCFV_Def` FOREIGN KEY (`ProductCustomFieldDefinitionID`) REFERENCES `ProductCustomfieldDefinitions` (`ProductCustomFieldDefinitionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductCFV_Product` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductImages`
--

DROP TABLE IF EXISTS `ProductImages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductImages` (
  `ProductImageID` int NOT NULL AUTO_INCREMENT,
  `ProductID` int NOT NULL,
  `ImageUrl` varchar(500) NOT NULL,
  `AltText` varchar(255) DEFAULT NULL,
  `SortOrder` int NOT NULL DEFAULT '0',
  `IsPrimary` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductImageID`),
  UNIQUE KEY `UQ_ProductImages_Primary` (`ProductID`,`IsPrimary`) /*!80000 INVISIBLE */,
  CONSTRAINT `FK_ProductImages_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductInventoryLevels`
--

DROP TABLE IF EXISTS `ProductInventoryLevels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductInventoryLevels` (
  `ProductInventoryLevelID` int NOT NULL AUTO_INCREMENT,
  `ProductID` int NOT NULL,
  `WarehouseID` int NOT NULL,
  `StockQuantity` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `ReservedQuantity` decimal(18,4) DEFAULT '0.0000',
  `AvailableQuantity` decimal(18,4) GENERATED ALWAYS AS ((`StockQuantity` - `ReservedQuantity`)) STORED,
  `MinStockLevel` decimal(18,4) DEFAULT NULL,
  `MaxStockLevel` decimal(18,4) DEFAULT NULL,
  `LastUpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `ProductLotID` int DEFAULT NULL,
  PRIMARY KEY (`ProductInventoryLevelID`),
  UNIQUE KEY `UQ_Product_Warehouse_Inventory` (`ProductID`,`WarehouseID`,`ProductLotID`),
  KEY `FK_ProductInventoryLevels_Warehouses` (`WarehouseID`),
  KEY `FK_ProductInventoryLevels_Lot` (`ProductLotID`),
  CONSTRAINT `FK_ProductInventoryLevels_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `ProductLots` (`ProductLotID`),
  CONSTRAINT `FK_ProductInventoryLevels_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductInventoryLevels_Warehouses` FOREIGN KEY (`WarehouseID`) REFERENCES `Warehouses` (`WarehouseID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductLots`
--

DROP TABLE IF EXISTS `ProductLots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductLots` (
  `ProductLotID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `LotNumber` varchar(100) NOT NULL,
  `ExpirationDate` date DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductLotID`),
  UNIQUE KEY `UQ_ProductLots` (`CompanyID`,`ProductID`,`LotNumber`),
  KEY `FK_ProductLots_Product` (`ProductID`),
  CONSTRAINT `FK_ProductLots_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductLots_Product` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productMarketplaceMappings`
--

DROP TABLE IF EXISTS `productMarketplaceMappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productMarketplaceMappings` (
  `ProductMarketplaceMappingID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `CompanyMarketplaceConnectionID` int NOT NULL,
  `MarketplaceProductID_External` varchar(255) NOT NULL,
  `MarketplaceSKU_External` varchar(100) DEFAULT NULL,
  `MarketplaceListingURL` varchar(1000) DEFAULT NULL,
  `LastSyncedPrice` decimal(18,4) DEFAULT NULL,
  `LastSyncedStock` bigint DEFAULT NULL,
  `SyncStatus` varchar(50) DEFAULT 'Pending',
  `LastSyncAttemptAt` datetime DEFAULT NULL,
  `LastSuccessfulSyncAt` datetime DEFAULT NULL,
  `SyncErrorMessage` longtext,
  `IsActiveOnMarketplace` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductMarketplaceMappingID`),
  UNIQUE KEY `UQ_Product_MarketplaceConnection` (`ProductID`,`CompanyMarketplaceConnectionID`),
  KEY `FK_ProductMarketplaceMappings_Companies` (`CompanyID`),
  KEY `FK_ProductMarketplaceMappings_Connections` (`CompanyMarketplaceConnectionID`),
  CONSTRAINT `FK_ProductMarketplaceMappings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`),
  CONSTRAINT `FK_ProductMarketplaceMappings_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `CompanyMarketplaceConnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductMarketplaceMappings_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`) ON DELETE CASCADE,
  CONSTRAINT `productMarketplaceMappings_chk_1` CHECK ((`SyncStatus` in (_utf8mb4'Pending',_utf8mb4'Synced',_utf8mb4'Error',_utf8mb4'Disabled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductPacks`
--

DROP TABLE IF EXISTS `ProductPacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductPacks` (
  `ProductPackID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PackProductID` int NOT NULL,
  `ComponentProductID` int NOT NULL,
  `ComponentQuantity` decimal(18,4) NOT NULL,
  PRIMARY KEY (`ProductPackID`),
  UNIQUE KEY `UQ_ProductPacks` (`PackProductID`,`ComponentProductID`),
  KEY `FK_ProductPacks_Company` (`CompanyID`),
  KEY `FK_ProductPacks_ComponentProduct` (`ComponentProductID`),
  CONSTRAINT `FK_ProductPacks_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductPacks_ComponentProduct` FOREIGN KEY (`ComponentProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_ProductPacks_PackProduct` FOREIGN KEY (`PackProductID`) REFERENCES `Products` (`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Products`
--

DROP TABLE IF EXISTS `Products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Products` (
  `ProductID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SKU` varchar(100) NOT NULL,
  `ProductName` varchar(255) NOT NULL,
  `Description` longtext,
  `ProductCategoryID` int DEFAULT NULL,
  `ProductBrandID` int DEFAULT NULL,
  `UnitID` int NOT NULL,
  `CostPrice` decimal(18,4) DEFAULT '0.0000',
  `SellingPrice` decimal(18,4) DEFAULT '0.0000',
  `IsTaxable` tinyint(1) DEFAULT '1',
  `IsService` tinyint(1) DEFAULT '0',
  `Weight` decimal(10,3) DEFAULT NULL,
  `WeightUnitID` int DEFAULT NULL,
  `Length` decimal(10,3) DEFAULT NULL,
  `Width` decimal(10,3) DEFAULT NULL,
  `Height` decimal(10,3) DEFAULT NULL,
  `DimensionUnitID` int DEFAULT NULL,
  `ImageURL` varchar(500) DEFAULT NULL,
  `Barcode` varchar(100) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `TaxRateID` int DEFAULT NULL,
  PRIMARY KEY (`ProductID`),
  UNIQUE KEY `UQ_Product_Company_SKU` (`CompanyID`,`SKU`),
  KEY `FK_Products_Categories` (`ProductCategoryID`),
  KEY `FK_Products_Brands` (`ProductBrandID`),
  KEY `FK_Products_Unit` (`UnitID`),
  KEY `FK_Products_WeightUnit` (`WeightUnitID`),
  KEY `FK_Products_DimensionUnit` (`DimensionUnitID`),
  CONSTRAINT `FK_Products_Brands` FOREIGN KEY (`ProductBrandID`) REFERENCES `ProductBrands` (`ProductBrandID`),
  CONSTRAINT `FK_Products_Categories` FOREIGN KEY (`ProductCategoryID`) REFERENCES `ProductCategories` (`ProductCategoryID`),
  CONSTRAINT `FK_Products_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Products_DimensionUnit` FOREIGN KEY (`DimensionUnitID`) REFERENCES `UnitsOfMeasure` (`UnitID`),
  CONSTRAINT `FK_Products_Unit` FOREIGN KEY (`UnitID`) REFERENCES `UnitsOfMeasure` (`UnitID`),
  CONSTRAINT `FK_Products_WeightUnit` FOREIGN KEY (`WeightUnitID`) REFERENCES `UnitsOfMeasure` (`UnitID`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Productserials`
--

DROP TABLE IF EXISTS `Productserials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Productserials` (
  `ProductSerialID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `SerialNumber` varchar(100) NOT NULL,
  `Status` varchar(50) DEFAULT 'InStock',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductSerialID`),
  UNIQUE KEY `UQ_ProductSerials` (`CompanyID`,`ProductID`,`SerialNumber`),
  KEY `FK_ProductSerials_Product` (`ProductID`),
  CONSTRAINT `FK_ProductSerials_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductSerials_Product` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `Productserials_chk_1` CHECK ((`Status` in (_utf8mb4'InStock',_utf8mb4'Reserved',_utf8mb4'Sold',_utf8mb4'Returned',_utf8mb4'Scrapped')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promotion_scopes`
--

DROP TABLE IF EXISTS `promotion_scopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotion_scopes` (
  `PromotionScopeID` bigint NOT NULL AUTO_INCREMENT,
  `PromotionID` bigint NOT NULL,
  `ScopeType` enum('product','category','brand','customer','employee','custom_field','channel','day') NOT NULL,
  `ScopeValue` varchar(255) NOT NULL,
  PRIMARY KEY (`PromotionScopeID`),
  KEY `idx_promo_scope` (`PromotionID`,`ScopeType`,`ScopeValue`),
  CONSTRAINT `promotion_scopes_ibfk_1` FOREIGN KEY (`PromotionID`) REFERENCES `promotions` (`PromotionID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promotion_usages`
--

DROP TABLE IF EXISTS `promotion_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotion_usages` (
  `PromotionUsageID` bigint NOT NULL AUTO_INCREMENT,
  `PromotionID` bigint NOT NULL,
  `OrderID` bigint DEFAULT NULL,
  `CustomerID` bigint DEFAULT NULL,
  `UsedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `QuantityApplied` int DEFAULT NULL,
  PRIMARY KEY (`PromotionUsageID`),
  KEY `idx_usage_promo` (`PromotionID`),
  KEY `idx_usage_customer` (`CustomerID`),
  CONSTRAINT `promotion_usages_ibfk_1` FOREIGN KEY (`PromotionID`) REFERENCES `promotions` (`PromotionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotions` (
  `PromotionID` bigint NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) NOT NULL,
  `Code` varchar(100) DEFAULT NULL,
  `Description` text,
  `Type` enum('percent','amount','bogo','bundle','shipping') NOT NULL DEFAULT 'percent',
  `Value` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `UnitPrice` decimal(18,4) DEFAULT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT '1',
  `Stackable` tinyint(1) NOT NULL DEFAULT '1',
  `Priority` int NOT NULL DEFAULT '100',
  `MinQuantity` int DEFAULT NULL,
  `PerOrderLimit` int DEFAULT NULL,
  `PerCustomerLimit` int DEFAULT NULL,
  `TotalRedemptions` int DEFAULT NULL,
  `StartAt` datetime DEFAULT NULL,
  `EndAt` datetime DEFAULT NULL,
  `Timezone` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `CompanyID` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`PromotionID`),
  UNIQUE KEY `Code` (`Code`),
  KEY `IX_Promotions_Company` (`CompanyID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PurchaseOrderItems`
--

DROP TABLE IF EXISTS `PurchaseOrderItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PurchaseOrderItems` (
  `PurchaseOrderItemID` int NOT NULL AUTO_INCREMENT,
  `PurchaseOrderID` int NOT NULL,
  `ProductID` int NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `Quantity` decimal(18,4) NOT NULL,
  `UnitPrice` decimal(18,4) NOT NULL,
  `TaxAmount` decimal(18,4) DEFAULT '0.0000',
  `LineTotal` decimal(18,4) GENERATED ALWAYS AS (((`Quantity` * `UnitPrice`) + `TaxAmount`)) STORED,
  `ReceivedQuantity` decimal(18,4) DEFAULT '0.0000',
  PRIMARY KEY (`PurchaseOrderItemID`),
  KEY `FK_PurchaseOrderItems_PurchaseOrders` (`PurchaseOrderID`),
  KEY `FK_PurchaseOrderItems_Products` (`ProductID`),
  CONSTRAINT `FK_PurchaseOrderItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_PurchaseOrderItems_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `PurchaseOrders` (`PurchaseOrderID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PurchaseOrders`
--

DROP TABLE IF EXISTS `PurchaseOrders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PurchaseOrders` (
  `PurchaseOrderID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SupplierID` int NOT NULL,
  `OrderDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `ExpectedDeliveryDate` datetime DEFAULT NULL,
  `PurchaseOrderNumber` varchar(50) NOT NULL,
  `Status` varchar(50) DEFAULT 'Draft',
  `TotalAmount` decimal(18,4) DEFAULT '0.0000',
  `Notes` varchar(1000) DEFAULT NULL,
  `ShippingAddress` varchar(500) DEFAULT NULL,
  `CreatedByEmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`PurchaseOrderID`),
  UNIQUE KEY `UQ_PurchaseOrder_Company_Number` (`CompanyID`,`PurchaseOrderNumber`),
  KEY `FK_PurchaseOrders_Suppliers` (`SupplierID`),
  KEY `FK_PurchaseOrders_CreatedBy` (`CreatedByEmployeeID`),
  CONSTRAINT `FK_PurchaseOrders_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PurchaseOrders_CreatedBy` FOREIGN KEY (`CreatedByEmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_PurchaseOrders_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `Suppliers` (`SupplierID`),
  CONSTRAINT `PurchaseOrders_chk_1` CHECK ((`Status` in (_utf8mb4'Draft',_utf8mb4'Submitted',_utf8mb4'Approved',_utf8mb4'PartiallyReceived',_utf8mb4'Received',_utf8mb4'Cancelled')))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RolePermissions`
--

DROP TABLE IF EXISTS `RolePermissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RolePermissions` (
  `RolePermissionID` int NOT NULL AUTO_INCREMENT,
  `RoleID` int NOT NULL,
  `PermissionName` varchar(100) NOT NULL,
  `PermissionDescription` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`RolePermissionID`),
  UNIQUE KEY `UQ_Role_Permission` (`RoleID`,`PermissionName`),
  CONSTRAINT `FK_RolePermissions_Roles` FOREIGN KEY (`RoleID`) REFERENCES `Roles` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Roles`
--

DROP TABLE IF EXISTS `Roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Roles` (
  `RoleID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `RoleName` varchar(100) NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`RoleID`),
  UNIQUE KEY `UQ_Role_Company_Name` (`CompanyID`,`RoleName`),
  CONSTRAINT `FK_Roles_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Sales`
--

DROP TABLE IF EXISTS `Sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sales` (
  `SaleID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CustomerID` int DEFAULT NULL,
  `EmployeeID` int NOT NULL,
  `SaleDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `DocumentType` varchar(50) NOT NULL,
  `DocumentNumber` varchar(50) NOT NULL,
  `IsExenta` tinyint(1) NOT NULL DEFAULT '0',
  `OriginalSaleID` int DEFAULT NULL,
  `GeneratedFromGuiaID` int DEFAULT NULL,
  `TotalAmount` decimal(18,4) NOT NULL,
  `DiscountAmountTotal` decimal(18,4) DEFAULT '0.0000',
  `SubTotal` decimal(18,4) GENERATED ALWAYS AS ((`TotalAmount` - `DiscountAmountTotal`)) STORED,
  `TaxAmountTotal` decimal(18,4) DEFAULT '0.0000',
  `FinalAmount` decimal(18,4) GENERATED ALWAYS AS (((`TotalAmount` - `DiscountAmountTotal`) + `TaxAmountTotal`)) STORED,
  `AmountPaid` decimal(18,4) DEFAULT '0.0000',
  `PaymentStatus` varchar(50) DEFAULT 'Unpaid',
  `CurrencyID` int NOT NULL,
  `Status` varchar(50) DEFAULT 'Draft',
  `Notes` varchar(1000) DEFAULT NULL,
  `ShippingAddress` varchar(500) DEFAULT NULL,
  `BillingAddress` varchar(500) DEFAULT NULL,
  `MarketplaceOrderID_External` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SaleID`),
  UNIQUE KEY `UQ_Sales_Company_DocType_DocNumber` (`CompanyID`,`DocumentType`,`DocumentNumber`),
  KEY `FK_Sales_Customers` (`CustomerID`),
  KEY `FK_Sales_Employees` (`EmployeeID`),
  KEY `FK_Sales_Currencies` (`CurrencyID`),
  KEY `FK_Sales_OriginalSale` (`OriginalSaleID`),
  KEY `FK_Sales_GeneratedFromGuia` (`GeneratedFromGuiaID`),
  CONSTRAINT `FK_Sales_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Sales_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `Currencies` (`CurrencyID`),
  CONSTRAINT `FK_Sales_Customers` FOREIGN KEY (`CustomerID`) REFERENCES `Customers` (`CustomerID`),
  CONSTRAINT `FK_Sales_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_Sales_GeneratedFromGuia` FOREIGN KEY (`GeneratedFromGuiaID`) REFERENCES `Sales` (`SaleID`),
  CONSTRAINT `FK_Sales_OriginalSale` FOREIGN KEY (`OriginalSaleID`) REFERENCES `Sales` (`SaleID`),
  CONSTRAINT `CK_Sales_DocumentType` CHECK ((`DocumentType` in (_utf8mb4'FACTURA',_utf8mb4'BOLETA',_utf8mb4'GUIA_DESPACHO',_utf8mb4'NOTA_CREDITO',_utf8mb4'NOTA_DEBITO',_utf8mb4'FACTURA_EXENTA',_utf8mb4'BOLETA_EXENTA',_utf8mb4'COTIZACION'))),
  CONSTRAINT `CK_Sales_TaxAmount_Exenta` CHECK ((((`IsExenta` = 1) and (`TaxAmountTotal` = 0)) or (`IsExenta` = 0))),
  CONSTRAINT `Sales_chk_1` CHECK ((`PaymentStatus` in (_utf8mb4'Unpaid',_utf8mb4'PartiallyPaid',_utf8mb4'Paid',_utf8mb4'Overdue')))
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SalesItems`
--

DROP TABLE IF EXISTS `SalesItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SalesItems` (
  `SalesItemID` int NOT NULL AUTO_INCREMENT,
  `SaleID` int NOT NULL,
  `ProductID` int NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `Quantity` decimal(18,4) NOT NULL,
  `UnitPrice` decimal(18,4) NOT NULL,
  `DiscountPercentage` decimal(5,2) DEFAULT '0.00',
  `DiscountAmountItem` decimal(18,4) DEFAULT '0.0000',
  `SubTotalItem` decimal(18,4) GENERATED ALWAYS AS (((`Quantity` * `UnitPrice`) - `DiscountAmountItem`)) STORED,
  `TaxRatePercentage` decimal(5,2) DEFAULT '0.00',
  `TaxAmountItem` decimal(18,4) DEFAULT '0.0000',
  `LineTotal` decimal(18,4) GENERATED ALWAYS AS ((((`Quantity` * `UnitPrice`) - `DiscountAmountItem`) + `TaxAmountItem`)) STORED,
  `IsLineExenta` tinyint(1) DEFAULT '0',
  `ProductLotID` int DEFAULT NULL,
  `ProductSerialID` int DEFAULT NULL,
  `TaxRateID` int DEFAULT NULL,
  PRIMARY KEY (`SalesItemID`),
  KEY `FK_SalesItems_Sales` (`SaleID`),
  KEY `FK_SalesItems_Products` (`ProductID`),
  KEY `FK_SalesItems_Lot` (`ProductLotID`),
  KEY `FK_SalesItems_Serial` (`ProductSerialID`),
  CONSTRAINT `FK_SalesItems_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `ProductLots` (`ProductLotID`),
  CONSTRAINT `FK_SalesItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_SalesItems_Sales` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SalesItems_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `Productserials` (`ProductSerialID`),
  CONSTRAINT `CK_SalesItems_Tax_Exenta` CHECK ((((`IsLineExenta` = 1) and (`TaxAmountItem` = 0)) or (`IsLineExenta` = 0)))
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SalesPayments`
--

DROP TABLE IF EXISTS `SalesPayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SalesPayments` (
  `SalesPaymentID` int NOT NULL AUTO_INCREMENT,
  `SaleID` int NOT NULL,
  `PaymentMethodID` int NOT NULL,
  `Amount` decimal(18,4) NOT NULL,
  `PaymentDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `ReferenceNumber` varchar(100) DEFAULT NULL,
  `BankTransactionID` int DEFAULT NULL,
  PRIMARY KEY (`SalesPaymentID`),
  KEY `FK_SalesPayments_Sale` (`SaleID`),
  KEY `FK_SalesPayments_Method` (`PaymentMethodID`),
  CONSTRAINT `FK_SalesPayments_Method` FOREIGN KEY (`PaymentMethodID`) REFERENCES `PaymentMethods` (`PaymentMethodID`),
  CONSTRAINT `FK_SalesPayments_Sale` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SiiCaf`
--

DROP TABLE IF EXISTS `SiiCaf`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiiCaf` (
  `SiiCAFID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `DocumentType` varchar(50) NOT NULL,
  `RangeStart` bigint NOT NULL,
  `RangeEnd` bigint NOT NULL,
  `CAFXml` longtext NOT NULL,
  `LoadedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`SiiCAFID`),
  KEY `FK_SiiCAF_Companies` (`CompanyID`),
  CONSTRAINT `FK_SiiCAF_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SiiDteLogs`
--

DROP TABLE IF EXISTS `SiiDteLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiiDteLogs` (
  `SiiDteLogID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SaleID` int DEFAULT NULL,
  `Timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `DocumentTypeGenerated` varchar(50) NOT NULL,
  `DocumentNumberGenerated` varchar(50) NOT NULL,
  `StatusSii` varchar(100) NOT NULL,
  `SiiTrackID` varchar(100) DEFAULT NULL,
  `SiiResponseMessage` longtext,
  `RequestXMLSent` longtext,
  `ResponseXMLReceived` longtext,
  `PdfTimbre` longblob,
  PRIMARY KEY (`SiiDteLogID`),
  KEY `FK_SiiDteLogs_Companies` (`CompanyID`),
  KEY `FK_SiiDteLogs_Sales` (`SaleID`),
  CONSTRAINT `FK_SiiDteLogs_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiDteLogs_Sales` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SiiRejectedDocs`
--

DROP TABLE IF EXISTS `SiiRejectedDocs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiiRejectedDocs` (
  `SiiRejectedDocID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SaleID` int DEFAULT NULL,
  `DocumentType` varchar(50) NOT NULL,
  `DocumentNumber` varchar(50) NOT NULL,
  `Reason` varchar(1000) NOT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SiiRejectedDocID`),
  KEY `FK_SiiRejectedDocs_Company` (`CompanyID`),
  KEY `FK_SiiRejectedDocs_Sale` (`SaleID`),
  CONSTRAINT `FK_SiiRejectedDocs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiRejectedDocs_Sale` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SiiSendQueue`
--

DROP TABLE IF EXISTS `SiiSendQueue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiiSendQueue` (
  `SiiSendQueueID` bigint NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SaleID` int DEFAULT NULL,
  `DocumentType` varchar(50) NOT NULL,
  `DocumentNumber` varchar(50) NOT NULL,
  `EnqueuedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `DequeuedAt` datetime DEFAULT NULL,
  `Status` varchar(50) DEFAULT 'Pending',
  `RetryCount` int DEFAULT '0',
  `LastError` longtext,
  PRIMARY KEY (`SiiSendQueueID`),
  KEY `FK_SiiSendQueue_Company` (`CompanyID`),
  KEY `FK_SiiSendQueue_Sale` (`SaleID`),
  CONSTRAINT `FK_SiiSendQueue_Company` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiSendQueue_Sale` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`),
  CONSTRAINT `SiiSendQueue_chk_1` CHECK ((`Status` in (_utf8mb4'Pending',_utf8mb4'Processing',_utf8mb4'Sent',_utf8mb4'Failed',_utf8mb4'Retried',_utf8mb4'Completed')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SubscriptionPlans`
--

DROP TABLE IF EXISTS `SubscriptionPlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SubscriptionPlans` (
  `PlanID` int NOT NULL AUTO_INCREMENT,
  `PlanName` varchar(100) NOT NULL,
  `Description` varchar(1000) DEFAULT NULL,
  `BasePrice` decimal(10,2) NOT NULL,
  `PlanCurrencyID` int NOT NULL,
  `BillingCycle` varchar(20) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`PlanID`),
  UNIQUE KEY `PlanName` (`PlanName`),
  KEY `FK_SubscriptionPlans_Currency` (`PlanCurrencyID`),
  CONSTRAINT `FK_SubscriptionPlans_Currency` FOREIGN KEY (`PlanCurrencyID`) REFERENCES `Currencies` (`CurrencyID`),
  CONSTRAINT `SubscriptionPlans_chk_1` CHECK ((`BillingCycle` in (_utf8mb4'Monthly',_utf8mb4'Annually',_utf8mb4'OneTime')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SupplierInvoiceItems`
--

DROP TABLE IF EXISTS `SupplierInvoiceItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierInvoiceItems` (
  `SupplierInvoiceItemID` int NOT NULL AUTO_INCREMENT,
  `SupplierInvoiceID` int NOT NULL,
  `ProductID` int DEFAULT NULL,
  `Description` varchar(500) NOT NULL,
  `Quantity` decimal(18,4) NOT NULL,
  `UnitPrice` decimal(18,4) NOT NULL,
  `TaxAmountItem` decimal(18,4) DEFAULT '0.0000',
  `GLAccountID` int DEFAULT NULL,
  `LineTotal` decimal(18,4) GENERATED ALWAYS AS (((`Quantity` * `UnitPrice`) + `TaxAmountItem`)) STORED,
  PRIMARY KEY (`SupplierInvoiceItemID`),
  KEY `FK_SupplierInvoiceItems_SupplierInvoices` (`SupplierInvoiceID`),
  KEY `FK_SupplierInvoiceItems_Products` (`ProductID`),
  KEY `FK_SupplierInvoiceItems_GLAccount` (`GLAccountID`),
  CONSTRAINT `FK_SupplierInvoiceItems_GLAccount` FOREIGN KEY (`GLAccountID`) REFERENCES `ChartOfAccounts` (`AccountID`),
  CONSTRAINT `FK_SupplierInvoiceItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_SupplierInvoiceItems_SupplierInvoices` FOREIGN KEY (`SupplierInvoiceID`) REFERENCES `SupplierInvoices` (`SupplierInvoiceID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SupplierInvoices`
--

DROP TABLE IF EXISTS `SupplierInvoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierInvoices` (
  `SupplierInvoiceID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SupplierID` int NOT NULL,
  `DocumentType` varchar(50) NOT NULL,
  `InvoiceNumber_Supplier` varchar(100) NOT NULL,
  `IsSupplierDocExenta` tinyint(1) NOT NULL DEFAULT '0',
  `InvoiceDate` date NOT NULL,
  `DueDate` date DEFAULT NULL,
  `TotalAmount` decimal(18,4) NOT NULL,
  `TaxAmount` decimal(18,4) DEFAULT '0.0000',
  `AmountPaid` decimal(18,4) DEFAULT '0.0000',
  `Status` varchar(50) DEFAULT 'Unpaid',
  `PurchaseOrderID` int DEFAULT NULL,
  `GoodsReceiptID` int DEFAULT NULL,
  `OriginalSupplierInvoiceID` int DEFAULT NULL,
  `SiiTrackID` varchar(100) DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`SupplierInvoiceID`),
  UNIQUE KEY `UQ_SupplierInvoice_Company_Supplier_InvNum_DocType` (`CompanyID`,`SupplierID`,`InvoiceNumber_Supplier`,`DocumentType`),
  KEY `FK_SupplierInvoices_Suppliers` (`SupplierID`),
  KEY `FK_SupplierInvoices_PurchaseOrders` (`PurchaseOrderID`),
  KEY `FK_SupplierInvoices_GoodsReceipts` (`GoodsReceiptID`),
  KEY `FK_SupplierInvoices_Original` (`OriginalSupplierInvoiceID`),
  CONSTRAINT `FK_SupplierInvoices_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierInvoices_GoodsReceipts` FOREIGN KEY (`GoodsReceiptID`) REFERENCES `GoodsReceipts` (`GoodsReceiptID`),
  CONSTRAINT `FK_SupplierInvoices_Original` FOREIGN KEY (`OriginalSupplierInvoiceID`) REFERENCES `SupplierInvoices` (`SupplierInvoiceID`),
  CONSTRAINT `FK_SupplierInvoices_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `PurchaseOrders` (`PurchaseOrderID`),
  CONSTRAINT `FK_SupplierInvoices_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `Suppliers` (`SupplierID`),
  CONSTRAINT `SupplierInvoices_chk_1` CHECK ((`Status` in (_utf8mb4'Unpaid',_utf8mb4'PartiallyPaid',_utf8mb4'Paid',_utf8mb4'Void')))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SupplierPaymentAllocations`
--

DROP TABLE IF EXISTS `SupplierPaymentAllocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierPaymentAllocations` (
  `SupplierPaymentAllocationID` int NOT NULL AUTO_INCREMENT,
  `SupplierPaymentID` int NOT NULL,
  `SupplierInvoiceID` int NOT NULL,
  `AmountAllocated` decimal(18,4) NOT NULL,
  `AllocationDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SupplierPaymentAllocationID`),
  UNIQUE KEY `UQ_SupplierPaymentAllocation` (`SupplierPaymentID`,`SupplierInvoiceID`),
  KEY `FK_SupplierPaymentAllocations_Invoices` (`SupplierInvoiceID`),
  CONSTRAINT `FK_SupplierPaymentAllocations_Invoices` FOREIGN KEY (`SupplierInvoiceID`) REFERENCES `SupplierInvoices` (`SupplierInvoiceID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierPaymentAllocations_Payments` FOREIGN KEY (`SupplierPaymentID`) REFERENCES `SupplierPayments` (`SupplierPaymentID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SupplierPayments`
--

DROP TABLE IF EXISTS `SupplierPayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierPayments` (
  `SupplierPaymentID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SupplierID` int NOT NULL,
  `PaymentDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `AmountPaid` decimal(18,4) NOT NULL,
  `PaymentMethodID` int NOT NULL,
  `BankAccountID` int DEFAULT NULL,
  `ReferenceNumber` varchar(100) DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  `ProcessedByEmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`SupplierPaymentID`),
  KEY `FK_SupplierPayments_Companies` (`CompanyID`),
  KEY `FK_SupplierPayments_Suppliers` (`SupplierID`),
  KEY `FK_SupplierPayments_PaymentMethods` (`PaymentMethodID`),
  KEY `FK_SupplierPayments_BankAccounts` (`BankAccountID`),
  KEY `FK_SupplierPayments_Employees` (`ProcessedByEmployeeID`),
  CONSTRAINT `FK_SupplierPayments_BankAccounts` FOREIGN KEY (`BankAccountID`) REFERENCES `BankAccounts` (`BankAccountID`),
  CONSTRAINT `FK_SupplierPayments_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierPayments_Employees` FOREIGN KEY (`ProcessedByEmployeeID`) REFERENCES `Employees` (`EmployeeID`),
  CONSTRAINT `FK_SupplierPayments_PaymentMethods` FOREIGN KEY (`PaymentMethodID`) REFERENCES `PaymentMethods` (`PaymentMethodID`),
  CONSTRAINT `FK_SupplierPayments_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `Suppliers` (`SupplierID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Suppliers`
--

DROP TABLE IF EXISTS `Suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Suppliers` (
  `SupplierID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SupplierName` varchar(255) NOT NULL,
  `ContactPerson` varchar(150) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `TaxID` varchar(50) DEFAULT NULL,
  `AddressLine1` varchar(255) DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SupplierID`),
  UNIQUE KEY `UQ_Supplier_Company_TaxID` (`CompanyID`,`TaxID`),
  CONSTRAINT `FK_Suppliers_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SystemSettings`
--

DROP TABLE IF EXISTS `SystemSettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SystemSettings` (
  `SystemSettingID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int DEFAULT NULL,
  `SettingKey` varchar(100) NOT NULL,
  `SettingValue` longtext NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `DataType` varchar(50) DEFAULT 'String',
  `IsEditableByTenant` tinyint(1) DEFAULT '0',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SystemSettingID`),
  UNIQUE KEY `UQ_SystemSettings_Key` (`CompanyID`,`SettingKey`),
  CONSTRAINT `FK_SystemSettings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `SystemSettings_chk_1` CHECK ((`DataType` in (_utf8mb4'String',_utf8mb4'Integer',_utf8mb4'Boolean',_utf8mb4'JSON',_utf8mb4'Decimal')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TaxRates`
--

DROP TABLE IF EXISTS `TaxRates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TaxRates` (
  `TaxRateID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `RatePercentage` decimal(8,3) NOT NULL DEFAULT '0.000',
  `AppliesTo` enum('goods','services','all') NOT NULL DEFAULT 'all',
  `IsDefault` tinyint(1) NOT NULL DEFAULT '0',
  `EffectiveFrom` datetime DEFAULT NULL,
  `EffectiveTo` datetime DEFAULT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`TaxRateID`),
  UNIQUE KEY `uk_TaxRates_company_name` (`CompanyID`,`Name`),
  KEY `idx_TaxRates_company_default` (`CompanyID`,`IsDefault`),
  KEY `idx_TaxRates_company_active` (`CompanyID`,`IsActive`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UnitsOfMeasure`
--

DROP TABLE IF EXISTS `UnitsOfMeasure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UnitsOfMeasure` (
  `UnitID` int NOT NULL AUTO_INCREMENT,
  `UnitName` varchar(50) NOT NULL,
  `Abbreviation` varchar(10) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`UnitID`),
  UNIQUE KEY `UnitName` (`UnitName`),
  UNIQUE KEY `Abbreviation` (`Abbreviation`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Warehouses`
--

DROP TABLE IF EXISTS `Warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Warehouses` (
  `WarehouseID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `WarehouseName` varchar(100) NOT NULL,
  `AddressLine1` varchar(255) DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `IsDefault` tinyint(1) DEFAULT '0',
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`WarehouseID`),
  UNIQUE KEY `UQ_Warehouse_Company_Name` (`CompanyID`,`WarehouseName`),
  CONSTRAINT `FK_Warehouses_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `WorkOrders`
--

DROP TABLE IF EXISTS `WorkOrders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WorkOrders` (
  `WorkOrderID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID_ToProduce` int NOT NULL,
  `BOMID` int DEFAULT NULL,
  `QuantityToProduce` decimal(18,4) NOT NULL,
  `Status` varchar(50) DEFAULT 'Planned',
  `PlannedStartDate` datetime DEFAULT NULL,
  `PlannedEndDate` datetime DEFAULT NULL,
  `ActualStartDate` datetime DEFAULT NULL,
  `ActualEndDate` datetime DEFAULT NULL,
  `SaleID` int DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`WorkOrderID`),
  KEY `FK_WorkOrders_Companies` (`CompanyID`),
  KEY `FK_WorkOrders_Products` (`ProductID_ToProduce`),
  KEY `FK_WorkOrders_BOM` (`BOMID`),
  KEY `FK_WorkOrders_Sales` (`SaleID`),
  CONSTRAINT `FK_WorkOrders_BOM` FOREIGN KEY (`BOMID`) REFERENCES `BillOfMaterials` (`BOMID`),
  CONSTRAINT `FK_WorkOrders_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `Companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_WorkOrders_Products` FOREIGN KEY (`ProductID_ToProduce`) REFERENCES `Products` (`ProductID`),
  CONSTRAINT `FK_WorkOrders_Sales` FOREIGN KEY (`SaleID`) REFERENCES `Sales` (`SaleID`),
  CONSTRAINT `WorkOrders_chk_1` CHECK ((`Status` in (_utf8mb4'Planned',_utf8mb4'InProgress',_utf8mb4'Completed',_utf8mb4'Cancelled',_utf8mb4'OnHold')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-14 22:59:20
ALTER TABLE Products
  ADD COLUMN UsesLots TINYINT(1) NOT NULL DEFAULT 0 AFTER IsService;
  ADD COLUMN UsesSerials TINYINT(1) NOT NULL DEFAULT 0
    AFTER UsesLots;



CREATE TABLE IF NOT EXISTS ProductLotInventory (
  ProductLotInventoryID INT AUTO_INCREMENT PRIMARY KEY,
  ProductLotID INT NOT NULL,
  WarehouseID INT NOT NULL,
  Quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_Lot_Warehouse (ProductLotID, WarehouseID),
  CONSTRAINT FK_LotInventory_Lot FOREIGN KEY (ProductLotID)
    REFERENCES ProductLots(ProductLotID) ON DELETE CASCADE,
  CONSTRAINT FK_LotInventory_Warehouse FOREIGN KEY (WarehouseID)
    REFERENCES Warehouses(WarehouseID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


