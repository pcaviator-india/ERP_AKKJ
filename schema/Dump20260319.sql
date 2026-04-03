CREATE DATABASE  IF NOT EXISTS `erp_akkj` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `erp_akkj`;
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
-- Table structure for table `apiclients`
--

DROP TABLE IF EXISTS `apiclients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `apiclients` (
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
  CONSTRAINT `FK_ApiClients_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `apiclients`
--

LOCK TABLES `apiclients` WRITE;
/*!40000 ALTER TABLE `apiclients` DISABLE KEYS */;
/*!40000 ALTER TABLE `apiclients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `apilogs`
--

DROP TABLE IF EXISTS `apilogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `apilogs` (
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
  CONSTRAINT `FK_ApiLogs_ApiClient` FOREIGN KEY (`ApiClientID`) REFERENCES `apiclients` (`ApiClientID`) ON DELETE SET NULL,
  CONSTRAINT `FK_ApiLogs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE SET NULL,
  CONSTRAINT `FK_ApiLogs_Employee` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `apilogs`
--

LOCK TABLES `apilogs` WRITE;
/*!40000 ALTER TABLE `apilogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `apilogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditlogs`
--

DROP TABLE IF EXISTS `auditlogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditlogs` (
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
  CONSTRAINT `FK_AuditLogs_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_AuditLogs_Users` FOREIGN KEY (`UserID`) REFERENCES `employees` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditlogs`
--

LOCK TABLES `auditlogs` WRITE;
/*!40000 ALTER TABLE `auditlogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `auditlogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backgroundjobs`
--

DROP TABLE IF EXISTS `backgroundjobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backgroundjobs` (
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
  CONSTRAINT `FK_BackgroundJobs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE SET NULL,
  CONSTRAINT `backgroundjobs_chk_1` CHECK ((`Status` in (_utf8mb4'Queued',_utf8mb4'Running',_utf8mb4'Succeeded',_utf8mb4'Failed',_utf8mb4'Cancelled',_utf8mb4'Retrying')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backgroundjobs`
--

LOCK TABLES `backgroundjobs` WRITE;
/*!40000 ALTER TABLE `backgroundjobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `backgroundjobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bankaccounts`
--

DROP TABLE IF EXISTS `bankaccounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bankaccounts` (
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
  CONSTRAINT `FK_BankAccounts_ChartOfAccounts` FOREIGN KEY (`GLAccountID`) REFERENCES `chartofaccounts` (`AccountID`),
  CONSTRAINT `FK_BankAccounts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BankAccounts_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bankaccounts`
--

LOCK TABLES `bankaccounts` WRITE;
/*!40000 ALTER TABLE `bankaccounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `bankaccounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `billofmaterials`
--

DROP TABLE IF EXISTS `billofmaterials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `billofmaterials` (
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
  CONSTRAINT `FK_BOM_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BOM_Products_Finished` FOREIGN KEY (`ProductID_FinishedGood`) REFERENCES `products` (`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `billofmaterials`
--

LOCK TABLES `billofmaterials` WRITE;
/*!40000 ALTER TABLE `billofmaterials` DISABLE KEYS */;
/*!40000 ALTER TABLE `billofmaterials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bomitems`
--

DROP TABLE IF EXISTS `bomitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bomitems` (
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
  CONSTRAINT `FK_BOMItems_BOM` FOREIGN KEY (`BOMID`) REFERENCES `billofmaterials` (`BOMID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BOMItems_ComponentProduct` FOREIGN KEY (`ComponentProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_BOMItems_Units` FOREIGN KEY (`UnitID_Component`) REFERENCES `unitsofmeasure` (`UnitID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bomitems`
--

LOCK TABLES `bomitems` WRITE;
/*!40000 ALTER TABLE `bomitems` DISABLE KEYS */;
/*!40000 ALTER TABLE `bomitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chartofaccounts`
--

DROP TABLE IF EXISTS `chartofaccounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chartofaccounts` (
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
  CONSTRAINT `FK_ChartOfAccounts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ChartOfAccounts_Parent` FOREIGN KEY (`ParentAccountID`) REFERENCES `chartofaccounts` (`AccountID`),
  CONSTRAINT `chartofaccounts_chk_1` CHECK ((`AccountType` in (_utf8mb4'Asset',_utf8mb4'Liability',_utf8mb4'Equity',_utf8mb4'Revenue',_utf8mb4'Expense',_utf8mb4'CostOfGoodsSold'))),
  CONSTRAINT `chartofaccounts_chk_2` CHECK ((`NormalBalance` in (_utf8mb4'Debit',_utf8mb4'Credit')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chartofaccounts`
--

LOCK TABLES `chartofaccounts` WRITE;
/*!40000 ALTER TABLE `chartofaccounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `chartofaccounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
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
  CONSTRAINT `FK_Companies_DefaultCurrency` FOREIGN KEY (`DefaultCurrencyID`) REFERENCES `currencies` (`CurrencyID`),
  CONSTRAINT `companies_chk_1` CHECK ((`SiiEnvironment` in (_utf8mb4'Certificacion',_utf8mb4'Produccion')))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES (1,'Comercial Mukti SpA','Comercial Mukti SpA','11.111.111-1',NULL,NULL,'Santiago',NULL,NULL,'CL',NULL,'info@mukti.cl',NULL,NULL,NULL,'ES','Certificacion',1,'2025-11-13 00:49:14','2025-11-13 00:49:14'),(2,'Comercial Mukti SpA2','Comercial Mukti SpA2','11.111.111-2',NULL,NULL,'Santiago',NULL,NULL,'CL',NULL,'info2@mukti.cl',NULL,NULL,NULL,'ES','Certificacion',1,'2025-11-13 00:50:56','2025-11-13 00:50:56'),(5,'Comercial Ejemplo SpA','comercial ejemplo spa','77.577.135-6','Avenida las condes 13600, lo barnechea, santiago',NULL,'santiago',NULL,NULL,'CL',NULL,NULL,NULL,NULL,NULL,'ES','Certificacion',1,'2025-11-21 00:32:27','2025-11-21 00:32:27'),(6,'comercial ejemplo spa1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'CL',NULL,NULL,NULL,NULL,NULL,'ES','Certificacion',1,'2025-12-12 00:08:17','2025-12-12 00:08:17');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companycurrencies`
--

DROP TABLE IF EXISTS `companycurrencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companycurrencies` (
  `CompanyCurrencyID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CurrencyID` int NOT NULL,
  `IsDefaultOperatingCurrency` tinyint(1) DEFAULT '0',
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CompanyCurrencyID`),
  UNIQUE KEY `UQ_CompanyCurrency` (`CompanyID`,`CurrencyID`),
  KEY `FK_CompanyCurrencies_Currencies` (`CurrencyID`),
  CONSTRAINT `FK_CompanyCurrencies_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyCurrencies_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companycurrencies`
--

LOCK TABLES `companycurrencies` WRITE;
/*!40000 ALTER TABLE `companycurrencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `companycurrencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companycustomfeaturelimits`
--

DROP TABLE IF EXISTS `companycustomfeaturelimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companycustomfeaturelimits` (
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
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `featurelimits` (`FeatureLimitID`),
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `modules` (`ModuleID`),
  CONSTRAINT `FK_CompanyCustomFeatureLimits_Subscriptions` FOREIGN KEY (`CompanySubscriptionID`) REFERENCES `companysubscriptions` (`CompanySubscriptionID`) ON DELETE CASCADE,
  CONSTRAINT `companycustomfeaturelimits_chk_1` CHECK ((`CustomEnforcementType` in (_utf8mb4'Soft',_utf8mb4'Hard',_utf8mb4'Notify')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companycustomfeaturelimits`
--

LOCK TABLES `companycustomfeaturelimits` WRITE;
/*!40000 ALTER TABLE `companycustomfeaturelimits` DISABLE KEYS */;
/*!40000 ALTER TABLE `companycustomfeaturelimits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companymarketplaceconnections`
--

DROP TABLE IF EXISTS `companymarketplaceconnections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companymarketplaceconnections` (
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
  CONSTRAINT `FK_CompanyMarketplaceConnections_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyMarketplaceConnections_Marketplaces` FOREIGN KEY (`MarketplaceID`) REFERENCES `marketplaces` (`MarketplaceID`),
  CONSTRAINT `FK_CompanyMarketplaceConnections_Warehouses` FOREIGN KEY (`DefaultWarehouseID`) REFERENCES `warehouses` (`WarehouseID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companymarketplaceconnections`
--

LOCK TABLES `companymarketplaceconnections` WRITE;
/*!40000 ALTER TABLE `companymarketplaceconnections` DISABLE KEYS */;
/*!40000 ALTER TABLE `companymarketplaceconnections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companypaymentgatewayconnections`
--

DROP TABLE IF EXISTS `companypaymentgatewayconnections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companypaymentgatewayconnections` (
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
  CONSTRAINT `FK_CPGC_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CPGC_Gateway` FOREIGN KEY (`PaymentGatewayID`) REFERENCES `paymentgateways` (`PaymentGatewayID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companypaymentgatewayconnections`
--

LOCK TABLES `companypaymentgatewayconnections` WRITE;
/*!40000 ALTER TABLE `companypaymentgatewayconnections` DISABLE KEYS */;
/*!40000 ALTER TABLE `companypaymentgatewayconnections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companysubscribedaddons`
--

DROP TABLE IF EXISTS `companysubscribedaddons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companysubscribedaddons` (
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
  CONSTRAINT `FK_CompanySubscribedAddons_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `modules` (`ModuleID`),
  CONSTRAINT `FK_CompanySubscribedAddons_Subscriptions` FOREIGN KEY (`CompanySubscriptionID`) REFERENCES `companysubscriptions` (`CompanySubscriptionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companysubscribedaddons`
--

LOCK TABLES `companysubscribedaddons` WRITE;
/*!40000 ALTER TABLE `companysubscribedaddons` DISABLE KEYS */;
/*!40000 ALTER TABLE `companysubscribedaddons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companysubscriptions`
--

DROP TABLE IF EXISTS `companysubscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companysubscriptions` (
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
  CONSTRAINT `FK_CompanySubscriptions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanySubscriptions_Plans` FOREIGN KEY (`PlanID`) REFERENCES `subscriptionplans` (`PlanID`),
  CONSTRAINT `companysubscriptions_chk_1` CHECK ((`Status` in (_utf8mb4'Active',_utf8mb4'Trial',_utf8mb4'PastDue',_utf8mb4'Cancelled',_utf8mb4'Expired')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companysubscriptions`
--

LOCK TABLES `companysubscriptions` WRITE;
/*!40000 ALTER TABLE `companysubscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `companysubscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companyusagerecords`
--

DROP TABLE IF EXISTS `companyusagerecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companyusagerecords` (
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
  CONSTRAINT `FK_CompanyUsageRecords_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CompanyUsageRecords_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `featurelimits` (`FeatureLimitID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companyusagerecords`
--

LOCK TABLES `companyusagerecords` WRITE;
/*!40000 ALTER TABLE `companyusagerecords` DISABLE KEYS */;
/*!40000 ALTER TABLE `companyusagerecords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `currencies`
--

DROP TABLE IF EXISTS `currencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `currencies` (
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
-- Dumping data for table `currencies`
--

LOCK TABLES `currencies` WRITE;
/*!40000 ALTER TABLE `currencies` DISABLE KEYS */;
INSERT INTO `currencies` VALUES (1,'CLP','Peso Chileno','$',0,1);
/*!40000 ALTER TABLE `currencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customergroups`
--

DROP TABLE IF EXISTS `customergroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customergroups` (
  `CustomerGroupID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `GroupName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`CustomerGroupID`),
  UNIQUE KEY `UQ_CustomerGroups` (`CompanyID`,`GroupName`),
  CONSTRAINT `FK_CustomerGroups_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customergroups`
--

LOCK TABLES `customergroups` WRITE;
/*!40000 ALTER TABLE `customergroups` DISABLE KEYS */;
INSERT INTO `customergroups` VALUES (1,1,'Retail',1);
/*!40000 ALTER TABLE `customergroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customerreceipts`
--

DROP TABLE IF EXISTS `customerreceipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customerreceipts` (
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
  CONSTRAINT `FK_CustomerReceipts_Bank` FOREIGN KEY (`BankAccountID`) REFERENCES `bankaccounts` (`BankAccountID`),
  CONSTRAINT `FK_CustomerReceipts_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_CustomerReceipts_Customer` FOREIGN KEY (`CustomerID`) REFERENCES `customers` (`CustomerID`),
  CONSTRAINT `FK_CustomerReceipts_Method` FOREIGN KEY (`PaymentMethodID`) REFERENCES `paymentmethods` (`PaymentMethodID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customerreceipts`
--

LOCK TABLES `customerreceipts` WRITE;
/*!40000 ALTER TABLE `customerreceipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `customerreceipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
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
  CONSTRAINT `FK_Customers_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Customers_Group` FOREIGN KEY (`CustomerGroupID`) REFERENCES `customergroups` (`CustomerGroupID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,1,'Default Customer','Default Customer','default@company.cl','+56 9 1234 5678','11.111.111-1','Av. Siempre Viva 123','Santiago',NULL,NULL,1,100000.00,1,'2025-11-13 22:18:19'),(2,5,'Casa hindu spa','jitendra khatri','casahindu.cl@gmail.com','987415010','76912188-9','alameda 2702','santiago','alameda 2702','santiago',NULL,100000.00,1,'2025-12-02 00:04:00'),(3,5,'Prakash chand khatri','Prakash','pck1955@gmail.com','987415010','14743024-8','av las condes 13600','santiago','av las condes 13600','santiago',NULL,10000000.00,1,'2025-12-02 00:14:00'),(4,5,'Jitendra Khatri','Jitendra','jitu_p4@hotmail.com','941539249','21933915-1','San Jose de LA Sierra 23, dpto 806','Santiago','San Jose de LA Sierra 23, dpto 806','Santiago',NULL,100000000.00,1,'2025-12-03 00:39:08');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `digitalcertificates`
--

DROP TABLE IF EXISTS `digitalcertificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `digitalcertificates` (
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
  CONSTRAINT `FK_DigitalCertificates_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `digitalcertificates`
--

LOCK TABLES `digitalcertificates` WRITE;
/*!40000 ALTER TABLE `digitalcertificates` DISABLE KEYS */;
/*!40000 ALTER TABLE `digitalcertificates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `directpurchaseitems`
--

DROP TABLE IF EXISTS `directpurchaseitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `directpurchaseitems` (
  `DirectPurchaseItemID` int NOT NULL AUTO_INCREMENT,
  `DirectPurchaseID` int NOT NULL,
  `ProductID` int NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `Quantity` decimal(18,4) NOT NULL,
  `UnitPrice` decimal(18,4) NOT NULL,
  `TaxAmount` decimal(18,4) DEFAULT '0.0000',
  `ReceivedQuantity` decimal(18,4) DEFAULT '0.0000',
  PRIMARY KEY (`DirectPurchaseItemID`),
  KEY `FK_DPI_DP` (`DirectPurchaseID`),
  KEY `FK_DPI_Product` (`ProductID`),
  CONSTRAINT `FK_DPI_DP` FOREIGN KEY (`DirectPurchaseID`) REFERENCES `directpurchases` (`DirectPurchaseID`) ON DELETE CASCADE,
  CONSTRAINT `FK_DPI_Product` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `directpurchaseitems`
--

LOCK TABLES `directpurchaseitems` WRITE;
/*!40000 ALTER TABLE `directpurchaseitems` DISABLE KEYS */;
/*!40000 ALTER TABLE `directpurchaseitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `directpurchases`
--

DROP TABLE IF EXISTS `directpurchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `directpurchases` (
  `DirectPurchaseID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `SupplierID` int NOT NULL,
  `PurchaseDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `ReceiptNumber` varchar(50) NOT NULL,
  `TotalAmount` decimal(18,4) NOT NULL,
  `TaxAmount` decimal(18,4) DEFAULT '0.0000',
  `Status` varchar(50) DEFAULT 'Pending',
  `Notes` varchar(1000) DEFAULT NULL,
  `CreatedByEmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`DirectPurchaseID`),
  UNIQUE KEY `UQ_DP_Number` (`CompanyID`,`ReceiptNumber`),
  KEY `FK_DP_Supplier` (`SupplierID`),
  KEY `FK_DP_Employee` (`CreatedByEmployeeID`),
  CONSTRAINT `FK_DP_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_DP_Employee` FOREIGN KEY (`CreatedByEmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_DP_Supplier` FOREIGN KEY (`SupplierID`) REFERENCES `suppliers` (`SupplierID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `directpurchases`
--

LOCK TABLES `directpurchases` WRITE;
/*!40000 ALTER TABLE `directpurchases` DISABLE KEYS */;
/*!40000 ALTER TABLE `directpurchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documentsequences`
--

DROP TABLE IF EXISTS `documentsequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documentsequences` (
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
  CONSTRAINT `FK_DocumentSequences_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documentsequences`
--

LOCK TABLES `documentsequences` WRITE;
/*!40000 ALTER TABLE `documentsequences` DISABLE KEYS */;
INSERT INTO `documentsequences` VALUES (1,1,'FACTURA','F',1,NULL,NULL,1,NULL,NULL,NULL,1),(2,1,'BOLETA','B',1,NULL,NULL,1,NULL,NULL,NULL,1),(3,1,'GUIA_DESPACHO','GD',1,NULL,NULL,1,NULL,NULL,NULL,1),(4,1,'NOTA_DEBITO','ND',1,NULL,NULL,1,NULL,NULL,NULL,1),(5,1,'NOTA_CREDITO','NC',1,NULL,NULL,1,NULL,NULL,NULL,1),(6,1,'FACTURA_EXENTA','FE',1,NULL,NULL,1,NULL,NULL,NULL,1),(7,1,'BOLETA_EXENTA','BE',1,NULL,NULL,1,NULL,NULL,NULL,1);
/*!40000 ALTER TABLE `documentsequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employeecontracts`
--

DROP TABLE IF EXISTS `employeecontracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employeecontracts` (
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
  CONSTRAINT `FK_EmployeeContracts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_EmployeeContracts_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`) ON DELETE CASCADE,
  CONSTRAINT `employeecontracts_chk_1` CHECK ((`EmploymentType` in (_utf8mb4'Full-time',_utf8mb4'Part-time',_utf8mb4'Contract',_utf8mb4'Intern'))),
  CONSTRAINT `employeecontracts_chk_2` CHECK ((`PayFrequency` in (_utf8mb4'Monthly',_utf8mb4'Bi-weekly',_utf8mb4'Weekly',_utf8mb4'Hourly')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employeecontracts`
--

LOCK TABLES `employeecontracts` WRITE;
/*!40000 ALTER TABLE `employeecontracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `employeecontracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employeeroles`
--

DROP TABLE IF EXISTS `employeeroles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employeeroles` (
  `EmployeeRoleID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int NOT NULL,
  `RoleID` int NOT NULL,
  PRIMARY KEY (`EmployeeRoleID`),
  UNIQUE KEY `UQ_Employee_Role` (`EmployeeID`,`RoleID`),
  KEY `FK_EmployeeRoles_Role` (`RoleID`),
  CONSTRAINT `FK_EmployeeRoles_Employee` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`) ON DELETE CASCADE,
  CONSTRAINT `FK_EmployeeRoles_Role` FOREIGN KEY (`RoleID`) REFERENCES `roles` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employeeroles`
--

LOCK TABLES `employeeroles` WRITE;
/*!40000 ALTER TABLE `employeeroles` DISABLE KEYS */;
/*!40000 ALTER TABLE `employeeroles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
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
  CONSTRAINT `FK_Employees_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Employees_ReportsTo` FOREIGN KEY (`ReportsToEmployeeID`) REFERENCES `employees` (`EmployeeID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,1,'Jitendra','Khatri','jitendra@test.com','$2a$12$G7doBeSuN7s61nyicC/KX.icozX3spwFI1Fc1xgsYvurcPGmZeerC',NULL,'Employee',NULL,NULL,NULL,NULL,1,'2025-11-13 00:57:44',NULL),(2,5,'jitendra','khatri','pcaviator@gmail.com','$2b$10$kuSoEbF527vFZkg8JZ0PiudUZqZcxlYilxA9UDhkxNtb8isdYjUwi','$2b$08$hfsb9EgsrC72YxO0p0qd9uOxvYhC9w7IJZ3vrzu.Y/5c4FxT15hLS','CompanyAdmin',NULL,NULL,NULL,NULL,1,'2025-11-21 00:32:28','2026-01-06 23:27:15'),(3,5,'jitendra','khatri','comercialmuktispa@gmail.com','$2b$10$jguj355JPzaIm95lI9PvvutHMtMi9zQWjSp4EKz/Vu43buF9zYO1i','$2b$08$eJz9QFMy6XLsFBdVO7D1geIl8EUN7atWNKghMmZ92i.1eh5aqIwPC','Sales',NULL,NULL,NULL,NULL,1,'2025-11-21 00:33:15',NULL),(4,6,'jk','kj','pcaviator1@gmail.com','$2b$10$FbV9g1yWLzz85oZ6VfpkjOOir17S114h3FwYDRb4TXHKHr2/BysFi',NULL,'CompanyAdmin',NULL,NULL,NULL,NULL,1,'2025-12-12 00:08:17',NULL),(5,5,'Kaneesh','Khatri','worldkingkaneesh@gmail.com','$2b$10$QywGOye8qfFILrkVChhJg.4.PwrQD1yu7qV/LZuMqIjwPDkNr2gda','$2b$08$CY1Mq67S9v0eg.BkbVqSo.guyAs8NHuk6sK8vyD2vqId6kq1aV3V.','Sales','941539249','Sales manager',NULL,3,1,'2025-12-30 23:06:33',NULL),(6,5,'Khushbu','Khatri','khushi.sun04@gmail.com','$2b$10$kn2jPDeX61YunkAscSOpE..cqEOULgQLvPFhTWCEngB0lAa5UkXNq',NULL,'Sales','936776130','Sales manager',1,5,1,'2025-12-30 23:41:10',NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exchangerates`
--

DROP TABLE IF EXISTS `exchangerates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exchangerates` (
  `ExchangeRateID` int NOT NULL AUTO_INCREMENT,
  `BaseCurrencyID` int NOT NULL,
  `QuoteCurrencyID` int NOT NULL,
  `Rate` decimal(18,8) NOT NULL,
  `RateDate` date NOT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ExchangeRateID`),
  UNIQUE KEY `UQ_ExchangeRates` (`BaseCurrencyID`,`QuoteCurrencyID`,`RateDate`),
  KEY `FK_ExchangeRates_Quote` (`QuoteCurrencyID`),
  CONSTRAINT `FK_ExchangeRates_Base` FOREIGN KEY (`BaseCurrencyID`) REFERENCES `currencies` (`CurrencyID`),
  CONSTRAINT `FK_ExchangeRates_Quote` FOREIGN KEY (`QuoteCurrencyID`) REFERENCES `currencies` (`CurrencyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exchangerates`
--

LOCK TABLES `exchangerates` WRITE;
/*!40000 ALTER TABLE `exchangerates` DISABLE KEYS */;
/*!40000 ALTER TABLE `exchangerates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `fact_inventory_balances`
--

DROP TABLE IF EXISTS `fact_inventory_balances`;
/*!50001 DROP VIEW IF EXISTS `fact_inventory_balances`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `fact_inventory_balances` AS SELECT 
 1 AS `company_id`,
 1 AS `product_id`,
 1 AS `warehouse_id`,
 1 AS `category_id`,
 1 AS `snapshot_date`,
 1 AS `product_lot_id`,
 1 AS `product_serial_id`,
 1 AS `stock_on_hand`,
 1 AS `stock_reserved`,
 1 AS `lot_expiry`,
 1 AS `product_sku`,
 1 AS `product_name`,
 1 AS `brand_id`,
 1 AS `brand_name`,
 1 AS `category_name`,
 1 AS `warehouse_name`,
 1 AS `warehouse_address`,
 1 AS `warehouse_city`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `fact_payments`
--

DROP TABLE IF EXISTS `fact_payments`;
/*!50001 DROP VIEW IF EXISTS `fact_payments`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `fact_payments` AS SELECT 
 1 AS `company_id`,
 1 AS `payment_id`,
 1 AS `sale_id`,
 1 AS `payment_date`,
 1 AS `payment_timestamp`,
 1 AS `amount`,
 1 AS `method`,
 1 AS `status`,
 1 AS `sale_payment_status`,
 1 AS `sale_status`,
 1 AS `customer_id`,
 1 AS `employee_id`,
 1 AS `currency_id`,
 1 AS `currency_code`,
 1 AS `currency_symbol`,
 1 AS `reference_number`,
 1 AS `bank_transaction_id`,
 1 AS `document_type`,
 1 AS `document_number`,
 1 AS `customer_name`,
 1 AS `customer_tax_id`,
 1 AS `customer_email`,
 1 AS `customer_phone`,
 1 AS `customer_billing_address`,
 1 AS `customer_billing_city`,
 1 AS `customer_shipping_address`,
 1 AS `customer_shipping_city`,
 1 AS `customer_group_id`,
 1 AS `customer_group_name`,
 1 AS `employee_first_name`,
 1 AS `employee_last_name`,
 1 AS `employee_full_name`,
 1 AS `employee_email`,
 1 AS `employee_phone`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `fact_sales_orders`
--

DROP TABLE IF EXISTS `fact_sales_orders`;
/*!50001 DROP VIEW IF EXISTS `fact_sales_orders`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `fact_sales_orders` AS SELECT 
 1 AS `company_id`,
 1 AS `sale_id`,
 1 AS `order_date`,
 1 AS `order_timestamp`,
 1 AS `document_type`,
 1 AS `document_number`,
 1 AS `channel`,
 1 AS `payment_status`,
 1 AS `status`,
 1 AS `employee_id`,
 1 AS `customer_id`,
 1 AS `currency_id`,
 1 AS `gross_total`,
 1 AS `net_total`,
 1 AS `tax_total`,
 1 AS `discount_total`,
 1 AS `final_total`,
 1 AS `line_count`,
 1 AS `distinct_products`,
 1 AS `total_quantity`,
 1 AS `product_ids`,
 1 AS `product_skus`,
 1 AS `product_names`,
 1 AS `product_brand_ids`,
 1 AS `product_brand_names`,
 1 AS `product_category_ids`,
 1 AS `product_category_names`,
 1 AS `customer_name`,
 1 AS `customer_tax_id`,
 1 AS `customer_email`,
 1 AS `customer_phone`,
 1 AS `customer_billing_address`,
 1 AS `customer_billing_city`,
 1 AS `customer_shipping_address`,
 1 AS `customer_shipping_city`,
 1 AS `customer_group_id`,
 1 AS `customer_group_name`,
 1 AS `employee_first_name`,
 1 AS `employee_last_name`,
 1 AS `employee_full_name`,
 1 AS `employee_email`,
 1 AS `employee_phone`,
 1 AS `currency_code`,
 1 AS `currency_symbol`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `featurelimits`
--

DROP TABLE IF EXISTS `featurelimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `featurelimits` (
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
-- Dumping data for table `featurelimits`
--

LOCK TABLES `featurelimits` WRITE;
/*!40000 ALTER TABLE `featurelimits` DISABLE KEYS */;
/*!40000 ALTER TABLE `featurelimits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `financialperiods`
--

DROP TABLE IF EXISTS `financialperiods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financialperiods` (
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
  CONSTRAINT `FK_FinancialPeriods_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `financialperiods_chk_1` CHECK ((`Status` in (_utf8mb4'Open',_utf8mb4'Closed',_utf8mb4'Archived')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financialperiods`
--

LOCK TABLES `financialperiods` WRITE;
/*!40000 ALTER TABLE `financialperiods` DISABLE KEYS */;
/*!40000 ALTER TABLE `financialperiods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goodsreceiptitems`
--

DROP TABLE IF EXISTS `goodsreceiptitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goodsreceiptitems` (
  `GoodsReceiptItemID` int NOT NULL AUTO_INCREMENT,
  `GoodsReceiptID` int NOT NULL,
  `PurchaseOrderItemID` int DEFAULT NULL,
  `DirectPurchaseItemID` int DEFAULT NULL,
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
  KEY `FK_GRI_DPI` (`DirectPurchaseItemID`),
  CONSTRAINT `FK_GoodsReceiptItems_GoodsReceipts` FOREIGN KEY (`GoodsReceiptID`) REFERENCES `goodsreceipts` (`GoodsReceiptID`) ON DELETE CASCADE,
  CONSTRAINT `FK_GoodsReceiptItems_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `productlots` (`ProductLotID`),
  CONSTRAINT `FK_GoodsReceiptItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_GoodsReceiptItems_PurchaseOrderItems` FOREIGN KEY (`PurchaseOrderItemID`) REFERENCES `purchaseorderitems` (`PurchaseOrderItemID`),
  CONSTRAINT `FK_GoodsReceiptItems_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `productserials` (`ProductSerialID`),
  CONSTRAINT `FK_GRI_DPI` FOREIGN KEY (`DirectPurchaseItemID`) REFERENCES `directpurchaseitems` (`DirectPurchaseItemID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goodsreceiptitems`
--

LOCK TABLES `goodsreceiptitems` WRITE;
/*!40000 ALTER TABLE `goodsreceiptitems` DISABLE KEYS */;
INSERT INTO `goodsreceiptitems` VALUES (1,1,3,NULL,1,50.0000,500.0000,NULL,NULL,'50 units received in good condition');
/*!40000 ALTER TABLE `goodsreceiptitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goodsreceipts`
--

DROP TABLE IF EXISTS `goodsreceipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goodsreceipts` (
  `GoodsReceiptID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PurchaseOrderID` int DEFAULT NULL,
  `DirectPurchaseID` int DEFAULT NULL,
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
  KEY `FK_GR_DP` (`DirectPurchaseID`),
  CONSTRAINT `FK_GoodsReceipts_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_GoodsReceipts_Employees` FOREIGN KEY (`ReceivedByEmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_GoodsReceipts_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `purchaseorders` (`PurchaseOrderID`),
  CONSTRAINT `FK_GoodsReceipts_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `suppliers` (`SupplierID`),
  CONSTRAINT `FK_GR_DP` FOREIGN KEY (`DirectPurchaseID`) REFERENCES `directpurchases` (`DirectPurchaseID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goodsreceipts`
--

LOCK TABLES `goodsreceipts` WRITE;
/*!40000 ALTER TABLE `goodsreceipts` DISABLE KEYS */;
INSERT INTO `goodsreceipts` VALUES (1,1,2,NULL,1,'2025-11-13 15:00:00','GR-00001','GD-12345','First partial receipt',1);
/*!40000 ALTER TABLE `goodsreceipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventorytransactions`
--

DROP TABLE IF EXISTS `inventorytransactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventorytransactions` (
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
  CONSTRAINT `FK_InventoryTransactions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_InventoryTransactions_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_InventoryTransactions_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `productlots` (`ProductLotID`),
  CONSTRAINT `FK_InventoryTransactions_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_InventoryTransactions_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `productserials` (`ProductSerialID`),
  CONSTRAINT `FK_InventoryTransactions_Warehouses` FOREIGN KEY (`WarehouseID`) REFERENCES `warehouses` (`WarehouseID`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventorytransactions`
--

LOCK TABLES `inventorytransactions` WRITE;
/*!40000 ALTER TABLE `inventorytransactions` DISABLE KEYS */;
INSERT INTO `inventorytransactions` VALUES (1,1,1,1,'ManualAdjustment',100.0000,'2025-11-13 22:40:16','InventoryAdjustment',1,NULL,NULL,'Opening stock',1),(2,1,1,1,'Sale',-2.0000,'2025-11-13 22:48:52','Sale',2,NULL,NULL,'Sale with stock deduction',1),(3,1,1,1,'PurchaseReceived',50.0000,'2025-11-14 00:08:19','GoodsReceipt',1,NULL,NULL,'50 units received in good condition',1),(4,1,1,1,'Sale',-2.0000,'2025-11-15 00:15:51','Sale',3,NULL,NULL,'Sale from API',NULL),(5,1,1,1,'CreditNote',2.0000,'2025-11-16 00:53:15','NOTA_CREDITO',4,NULL,NULL,'NOTA_CREDITO creada',NULL),(6,1,1,1,'DebitNote',-2.0000,'2025-11-16 01:00:29','NOTA_DEBITO',5,NULL,NULL,'NOTA_DEBITO creada',NULL),(7,1,1,1,'DebitNote',-2.0000,'2025-11-17 23:42:44','NOTA_DEBITO',9,NULL,NULL,'NOTA_DEBITO creada',NULL),(8,5,5,1,'Sale',-1.0000,'2025-11-25 21:13:56','Sale',16,NULL,NULL,'Sale from API',NULL),(9,5,1,1,'Sale',-1.0000,'2025-11-25 21:13:56','Sale',16,NULL,NULL,'Sale from API',NULL),(10,5,2,1,'Sale',-1.0000,'2025-11-25 21:13:56','Sale',16,NULL,NULL,'Sale from API',NULL),(11,5,6,1,'Sale',-1.0000,'2025-11-25 21:13:56','Sale',16,NULL,NULL,'Sale from API',NULL),(12,5,5,1,'Sale',-1.0000,'2025-11-25 22:19:28','Sale',17,NULL,NULL,'Sale from API',NULL),(13,5,1,1,'Sale',-1.0000,'2025-11-25 22:19:28','Sale',17,NULL,NULL,'Sale from API',NULL),(14,5,2,1,'Sale',-1.0000,'2025-11-25 22:19:28','Sale',17,NULL,NULL,'Sale from API',NULL),(15,5,6,1,'Sale',-1.0000,'2025-11-25 22:19:28','Sale',17,NULL,NULL,'Sale from API',NULL),(16,5,5,1,'Sale',-1.0000,'2025-11-25 23:13:35','Sale',19,NULL,NULL,'Sale from API',NULL),(17,5,6,1,'Sale',-1.0000,'2025-11-25 23:13:35','Sale',19,NULL,NULL,'Sale from API',NULL),(18,5,7,1,'Sale',-1.0000,'2025-11-25 23:13:35','Sale',19,NULL,NULL,'Sale from API',NULL),(19,5,4,1,'Sale',-1.0000,'2025-11-25 23:13:35','Sale',19,NULL,NULL,'Sale from API',NULL),(20,5,5,1,'ManualAdjustment',10.0000,'2025-11-26 21:47:45','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(21,5,6,1,'ManualAdjustment',6.0000,'2025-11-26 21:47:45','InventoryBulkSave',4,NULL,NULL,'Bulk inventory save',2),(22,5,7,1,'ManualAdjustment',5.0000,'2025-11-26 21:47:45','InventoryBulkSave',5,NULL,NULL,'Bulk inventory save',2),(23,5,4,1,'ManualAdjustment',6.0000,'2025-11-26 21:47:45','InventoryBulkSave',6,NULL,NULL,'Bulk inventory save',2),(24,5,2,1,'ManualAdjustment',8.0000,'2025-11-26 21:47:45','InventoryBulkSave',3,NULL,NULL,'Bulk inventory save',2),(25,5,1,1,'ManualAdjustment',-132.0000,'2025-11-28 21:34:59','InventoryBulkSave',1,NULL,NULL,'Bulk inventory save',2),(26,5,9,2,'ManualAdjustment',10.0000,'2025-11-28 21:35:29','InventoryBulkSave',7,NULL,NULL,'Bulk inventory save',2),(27,5,8,2,'ManualAdjustment',10.0000,'2025-12-01 23:06:40','InventoryBulkSave',8,NULL,NULL,'Bulk inventory save',2),(28,5,5,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(29,5,6,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(30,5,7,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(31,5,2,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(32,5,1,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(33,5,4,1,'Sale',-1.0000,'2025-12-03 00:40:40','Sale',21,NULL,NULL,'Sale from API',NULL),(34,5,5,1,'Sale',-1.0000,'2025-12-03 23:42:45','Sale',34,NULL,NULL,'Sale from API',NULL),(35,5,5,2,'ManualAdjustment',10.0000,'2025-12-16 23:35:16','InventoryBulkSave',9,NULL,NULL,'Bulk inventory save',2),(36,5,6,2,'ManualAdjustment',10.0000,'2025-12-16 23:35:26','InventoryBulkSave',10,NULL,NULL,'Bulk inventory save',2),(37,5,17,1,'ManualAdjustment',10.0000,'2025-12-17 00:52:32','InventoryBulkSave',11,NULL,NULL,'Bulk inventory save',2),(38,5,18,1,'ManualAdjustment',100.0000,'2025-12-17 23:09:12','LotAdjustment',12,1,NULL,'Lot inventory update',2),(39,5,18,1,'ManualAdjustment',1000.0000,'2025-12-17 23:11:53','InventoryBulkSave',13,NULL,NULL,'Bulk inventory save',2),(40,5,18,1,'ManualAdjustment',10.0000,'2025-12-17 23:49:40','LotAdjustment',14,2,NULL,'Lot inventory update',2),(41,5,5,1,'ManualAdjustment',10.0000,'2025-12-17 23:50:21','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(42,5,5,1,'ManualAdjustment',30.0000,'2025-12-17 23:50:46','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(43,5,5,1,'ManualAdjustment',-45.0000,'2025-12-17 23:50:53','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(44,5,9,1,'ManualAdjustment',45.0000,'2025-12-17 23:51:53','InventoryBulkSave',15,NULL,NULL,'Bulk inventory save',2),(45,5,5,1,'ManualAdjustment',65.0000,'2025-12-17 23:52:45','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(46,5,5,1,'ManualAdjustment',-60.0000,'2025-12-17 23:53:04','InventoryBulkSave',2,NULL,NULL,'Bulk inventory save',2),(47,5,5,1,'ManualAdjustment',5.0000,'2025-12-17 23:59:58','InventoryAdjustment',2,NULL,NULL,'Add stock',2),(48,5,5,1,'ManualAdjustment',10.0000,'2025-12-18 00:10:36','InventoryAdjustment',2,NULL,NULL,'Add stock',2),(49,5,6,1,'ManualAdjustment',5.0000,'2025-12-18 00:10:36','InventoryAdjustment',4,NULL,NULL,'Add stock',2),(50,5,4,1,'ManualAdjustment',10.0000,'2025-12-18 00:16:33','InventoryAdjustment',6,NULL,NULL,'Add stock',2),(51,5,6,1,'ManualAdjustment',5.0000,'2025-12-18 00:16:33','InventoryAdjustment',4,NULL,NULL,'Add stock',2),(52,5,1,1,'ManualAdjustment',141.0000,'2025-12-18 00:16:33','InventoryBulkSave',1,NULL,NULL,'Bulk inventory save',2),(53,5,5,1,'TransferOut',-10.0000,'2026-01-05 23:41:46','InventoryTransfer',NULL,NULL,NULL,'Transfer 10 Almizcle Incense Sticks from Main Bodega to Sazie Bodega',2),(54,5,5,2,'TransferIn',10.0000,'2026-01-05 23:41:46','InventoryTransfer',NULL,NULL,NULL,'Transfer 10 Almizcle Incense Sticks from Main Bodega to Sazie Bodega',2),(55,5,5,2,'TransferOut',-2.0000,'2026-01-05 23:42:16','InventoryTransfer',NULL,NULL,NULL,'Transfer 2 Almizcle Incense Sticks from Sazie Bodega to Main Bodega',2),(56,5,5,1,'TransferIn',2.0000,'2026-01-05 23:42:16','InventoryTransfer',NULL,NULL,NULL,'Transfer 2 Almizcle Incense Sticks from Sazie Bodega to Main Bodega',2);
/*!40000 ALTER TABLE `inventorytransactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journalentries`
--

DROP TABLE IF EXISTS `journalentries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journalentries` (
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
  CONSTRAINT `FK_JournalEntries_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_JournalEntries_FinancialPeriods` FOREIGN KEY (`FinancialPeriodID`) REFERENCES `financialperiods` (`FinancialPeriodID`),
  CONSTRAINT `FK_JournalEntries_PostedBy` FOREIGN KEY (`PostedByEmployeeID`) REFERENCES `employees` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journalentries`
--

LOCK TABLES `journalentries` WRITE;
/*!40000 ALTER TABLE `journalentries` DISABLE KEYS */;
/*!40000 ALTER TABLE `journalentries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journalentryitems`
--

DROP TABLE IF EXISTS `journalentryitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journalentryitems` (
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
  CONSTRAINT `FK_JournalEntryItems_ChartOfAccounts` FOREIGN KEY (`AccountID`) REFERENCES `chartofaccounts` (`AccountID`),
  CONSTRAINT `FK_JournalEntryItems_JournalEntries` FOREIGN KEY (`JournalEntryID`) REFERENCES `journalentries` (`JournalEntryID`) ON DELETE CASCADE,
  CONSTRAINT `CK_JournalEntryItems_DebitOrCredit` CHECK ((((`DebitAmount` <> 0) and (`CreditAmount` = 0)) or ((`CreditAmount` <> 0) and (`DebitAmount` = 0)))),
  CONSTRAINT `journalentryitems_chk_1` CHECK ((`ContactType` in (_utf8mb4'Customer',_utf8mb4'Supplier',_utf8mb4'Employee')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journalentryitems`
--

LOCK TABLES `journalentryitems` WRITE;
/*!40000 ALTER TABLE `journalentryitems` DISABLE KEYS */;
/*!40000 ALTER TABLE `journalentryitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `librocompras`
--

DROP TABLE IF EXISTS `librocompras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `librocompras` (
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
  CONSTRAINT `FK_LibroCompras_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `librocompras`
--

LOCK TABLES `librocompras` WRITE;
/*!40000 ALTER TABLE `librocompras` DISABLE KEYS */;
/*!40000 ALTER TABLE `librocompras` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `libroventas`
--

DROP TABLE IF EXISTS `libroventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `libroventas` (
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
  CONSTRAINT `FK_LibroVentas_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `libroventas`
--

LOCK TABLES `libroventas` WRITE;
/*!40000 ALTER TABLE `libroventas` DISABLE KEYS */;
/*!40000 ALTER TABLE `libroventas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loginsessions`
--

DROP TABLE IF EXISTS `loginsessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loginsessions` (
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
  CONSTRAINT `FK_LoginSessions_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_LoginSessions_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loginsessions`
--

LOCK TABLES `loginsessions` WRITE;
/*!40000 ALTER TABLE `loginsessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `loginsessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyaltypoints`
--

DROP TABLE IF EXISTS `loyaltypoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyaltypoints` (
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
  CONSTRAINT `FK_LoyaltyPoints_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_LoyaltyPoints_Customer` FOREIGN KEY (`CustomerID`) REFERENCES `customers` (`CustomerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyaltypoints`
--

LOCK TABLES `loyaltypoints` WRITE;
/*!40000 ALTER TABLE `loyaltypoints` DISABLE KEYS */;
/*!40000 ALTER TABLE `loyaltypoints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplaces`
--

DROP TABLE IF EXISTS `marketplaces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marketplaces` (
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
  CONSTRAINT `marketplaces_chk_1` CHECK ((`AuthenticationType` in (_utf8mb4'OAuth2',_utf8mb4'APIKeyToken',_utf8mb4'Custom')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplaces`
--

LOCK TABLES `marketplaces` WRITE;
/*!40000 ALTER TABLE `marketplaces` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketplaces` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marketplacesynclogs`
--

DROP TABLE IF EXISTS `marketplacesynclogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marketplacesynclogs` (
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
  CONSTRAINT `FK_MarketplaceSyncLogs_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `companymarketplaceconnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `marketplacesynclogs_chk_1` CHECK ((`SyncType` in (_utf8mb4'Products',_utf8mb4'Orders',_utf8mb4'Inventory',_utf8mb4'Pricing',_utf8mb4'General'))),
  CONSTRAINT `marketplacesynclogs_chk_2` CHECK ((`Status` in (_utf8mb4'InProgress',_utf8mb4'Completed',_utf8mb4'Failed',_utf8mb4'CompletedWithErrors')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marketplacesynclogs`
--

LOCK TABLES `marketplacesynclogs` WRITE;
/*!40000 ALTER TABLE `marketplacesynclogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `marketplacesynclogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modules`
--

DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `modules` (
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
  CONSTRAINT `modules_chk_1` CHECK ((`DefaultBillingCycle` in (_utf8mb4'Monthly',_utf8mb4'Annually',_utf8mb4'OneTime')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modules`
--

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ordermarketplacemappings`
--

DROP TABLE IF EXISTS `ordermarketplacemappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordermarketplacemappings` (
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
  CONSTRAINT `FK_OrderMarketplaceMappings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`),
  CONSTRAINT `FK_OrderMarketplaceMappings_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `companymarketplaceconnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_OrderMarketplaceMappings_Sales` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ordermarketplacemappings`
--

LOCK TABLES `ordermarketplacemappings` WRITE;
/*!40000 ALTER TABLE `ordermarketplacemappings` DISABLE KEYS */;
/*!40000 ALTER TABLE `ordermarketplacemappings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentgateways`
--

DROP TABLE IF EXISTS `paymentgateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentgateways` (
  `PaymentGatewayID` int NOT NULL AUTO_INCREMENT,
  `GatewayCode` varchar(50) NOT NULL,
  `GatewayName` varchar(100) NOT NULL,
  `ApiBaseUrl` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`PaymentGatewayID`),
  UNIQUE KEY `GatewayCode` (`GatewayCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentgateways`
--

LOCK TABLES `paymentgateways` WRITE;
/*!40000 ALTER TABLE `paymentgateways` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentgateways` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentmethods`
--

DROP TABLE IF EXISTS `paymentmethods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentmethods` (
  `PaymentMethodID` int NOT NULL AUTO_INCREMENT,
  `MethodName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`PaymentMethodID`),
  UNIQUE KEY `MethodName` (`MethodName`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentmethods`
--

LOCK TABLES `paymentmethods` WRITE;
/*!40000 ALTER TABLE `paymentmethods` DISABLE KEYS */;
INSERT INTO `paymentmethods` VALUES (1,'Cash',1),(2,'Card',1),(3,'Transfer',1);
/*!40000 ALTER TABLE `paymentmethods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payrollruns`
--

DROP TABLE IF EXISTS `payrollruns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payrollruns` (
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
  CONSTRAINT `FK_PayrollRuns_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PayrollRuns_ProcessedBy` FOREIGN KEY (`ProcessedByEmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `payrollruns_chk_1` CHECK ((`Status` in (_utf8mb4'Pending',_utf8mb4'Processing',_utf8mb4'Completed',_utf8mb4'Cancelled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payrollruns`
--

LOCK TABLES `payrollruns` WRITE;
/*!40000 ALTER TABLE `payrollruns` DISABLE KEYS */;
/*!40000 ALTER TABLE `payrollruns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payslipitems`
--

DROP TABLE IF EXISTS `payslipitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payslipitems` (
  `PayslipItemID` int NOT NULL AUTO_INCREMENT,
  `PayslipID` int NOT NULL,
  `ItemType` varchar(50) NOT NULL,
  `Description` varchar(255) NOT NULL,
  `Amount` decimal(18,4) NOT NULL,
  `GLAccountID` int DEFAULT NULL,
  PRIMARY KEY (`PayslipItemID`),
  KEY `FK_PayslipItems_Payslips` (`PayslipID`),
  KEY `FK_PayslipItems_ChartOfAccounts` (`GLAccountID`),
  CONSTRAINT `FK_PayslipItems_ChartOfAccounts` FOREIGN KEY (`GLAccountID`) REFERENCES `chartofaccounts` (`AccountID`),
  CONSTRAINT `FK_PayslipItems_Payslips` FOREIGN KEY (`PayslipID`) REFERENCES `payslips` (`PayslipID`) ON DELETE CASCADE,
  CONSTRAINT `payslipitems_chk_1` CHECK ((`ItemType` in (_utf8mb4'Earning',_utf8mb4'Deduction',_utf8mb4'CompanyContribution',_utf8mb4'Tax')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payslipitems`
--

LOCK TABLES `payslipitems` WRITE;
/*!40000 ALTER TABLE `payslipitems` DISABLE KEYS */;
/*!40000 ALTER TABLE `payslipitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payslips`
--

DROP TABLE IF EXISTS `payslips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payslips` (
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
  CONSTRAINT `FK_Payslips_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_Payslips_PayrollRuns` FOREIGN KEY (`PayrollRunID`) REFERENCES `payrollruns` (`PayrollRunID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payslips`
--

LOCK TABLES `payslips` WRITE;
/*!40000 ALTER TABLE `payslips` DISABLE KEYS */;
/*!40000 ALTER TABLE `payslips` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pendingproductcustomfieldvalues`
--

DROP TABLE IF EXISTS `pendingproductcustomfieldvalues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pendingproductcustomfieldvalues` (
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
-- Dumping data for table `pendingproductcustomfieldvalues`
--

LOCK TABLES `pendingproductcustomfieldvalues` WRITE;
/*!40000 ALTER TABLE `pendingproductcustomfieldvalues` DISABLE KEYS */;
/*!40000 ALTER TABLE `pendingproductcustomfieldvalues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planfeaturelimits`
--

DROP TABLE IF EXISTS `planfeaturelimits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planfeaturelimits` (
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
  CONSTRAINT `FK_PlanFeatureLimits_Features` FOREIGN KEY (`FeatureLimitID`) REFERENCES `featurelimits` (`FeatureLimitID`),
  CONSTRAINT `FK_PlanFeatureLimits_Plans` FOREIGN KEY (`PlanID`) REFERENCES `subscriptionplans` (`PlanID`) ON DELETE CASCADE,
  CONSTRAINT `planfeaturelimits_chk_1` CHECK ((`EnforcementType` in (_utf8mb4'Soft',_utf8mb4'Hard',_utf8mb4'Notify')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planfeaturelimits`
--

LOCK TABLES `planfeaturelimits` WRITE;
/*!40000 ALTER TABLE `planfeaturelimits` DISABLE KEYS */;
/*!40000 ALTER TABLE `planfeaturelimits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planmodules`
--

DROP TABLE IF EXISTS `planmodules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planmodules` (
  `PlanModuleID` int NOT NULL AUTO_INCREMENT,
  `PlanID` int NOT NULL,
  `ModuleID` int NOT NULL,
  PRIMARY KEY (`PlanModuleID`),
  UNIQUE KEY `UQ_PlanModule` (`PlanID`,`ModuleID`),
  KEY `FK_PlanModules_Modules` (`ModuleID`),
  CONSTRAINT `FK_PlanModules_Modules` FOREIGN KEY (`ModuleID`) REFERENCES `modules` (`ModuleID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PlanModules_Plans` FOREIGN KEY (`PlanID`) REFERENCES `subscriptionplans` (`PlanID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planmodules`
--

LOCK TABLES `planmodules` WRITE;
/*!40000 ALTER TABLE `planmodules` DISABLE KEYS */;
/*!40000 ALTER TABLE `planmodules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posusersettings`
--

DROP TABLE IF EXISTS `posusersettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posusersettings` (
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
  CONSTRAINT `FK_POSUserSettings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_POSUserSettings_Users` FOREIGN KEY (`UserID`) REFERENCES `employees` (`EmployeeID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posusersettings`
--

LOCK TABLES `posusersettings` WRITE;
/*!40000 ALTER TABLE `posusersettings` DISABLE KEYS */;
/*!40000 ALTER TABLE `posusersettings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricelistitems`
--

DROP TABLE IF EXISTS `pricelistitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricelistitems` (
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
  CONSTRAINT `FK_PriceListItems_PriceLists` FOREIGN KEY (`PriceListID`) REFERENCES `pricelists` (`PriceListID`),
  CONSTRAINT `FK_PriceListItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricelistitems`
--

LOCK TABLES `pricelistitems` WRITE;
/*!40000 ALTER TABLE `pricelistitems` DISABLE KEYS */;
INSERT INTO `pricelistitems` VALUES (7,1,5,3.0000,800.0000,1,'2025-11-29 00:12:54'),(8,1,9,3.0000,799.9800,1,'2025-11-29 00:12:54'),(9,1,9,6.0000,700.0000,1,'2025-11-29 00:12:54');
/*!40000 ALTER TABLE `pricelistitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricelists`
--

DROP TABLE IF EXISTS `pricelists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricelists` (
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
-- Dumping data for table `pricelists`
--

LOCK TABLES `pricelists` WRITE;
/*!40000 ALTER TABLE `pricelists` DISABLE KEYS */;
INSERT INTO `pricelists` VALUES (1,5,'Price List 3 items',1,'2025-11-28 23:55:55');
/*!40000 ALTER TABLE `pricelists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productbrands`
--

DROP TABLE IF EXISTS `productbrands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productbrands` (
  `ProductBrandID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `BrandName` varchar(100) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductBrandID`),
  UNIQUE KEY `UQ_ProductBrand_Company_Name` (`CompanyID`,`BrandName`),
  CONSTRAINT `FK_ProductBrands_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productbrands`
--

LOCK TABLES `productbrands` WRITE;
/*!40000 ALTER TABLE `productbrands` DISABLE KEYS */;
INSERT INTO `productbrands` VALUES (1,1,'Comercial Mukti',1),(2,5,'Moksh',1),(4,5,'Satya',1),(5,5,'Nirbana',1);
/*!40000 ALTER TABLE `productbrands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productcategories`
--

DROP TABLE IF EXISTS `productcategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productcategories` (
  `ProductCategoryID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `CategoryName` varchar(100) NOT NULL,
  `ParentCategoryID` int DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductCategoryID`),
  UNIQUE KEY `UQ_ProductCategory_Company_Name` (`CompanyID`,`CategoryName`,`ParentCategoryID`),
  KEY `FK_ProductCategories_Parent` (`ParentCategoryID`),
  CONSTRAINT `FK_ProductCategories_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductCategories_Parent` FOREIGN KEY (`ParentCategoryID`) REFERENCES `productcategories` (`ProductCategoryID`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productcategories`
--

LOCK TABLES `productcategories` WRITE;
/*!40000 ALTER TABLE `productcategories` DISABLE KEYS */;
INSERT INTO `productcategories` VALUES (1,5,'Incense',NULL,1),(2,5,'Velas',NULL,1),(3,5,'Other',NULL,1),(4,5,'Velas Aromatica',2,1),(5,5,'Vela Vaso',4,1),(6,5,'Vela Lata',4,1),(7,5,'Vela Flotante',4,1);
/*!40000 ALTER TABLE `productcategories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productcustomfielddefinitions`
--

DROP TABLE IF EXISTS `productcustomfielddefinitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productcustomfielddefinitions` (
  `ProductCustomFieldDefinitionID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `FieldName` varchar(100) NOT NULL,
  `DataType` varchar(20) NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ProductCustomFieldDefinitionID`),
  UNIQUE KEY `UQ_ProductCFD` (`CompanyID`,`FieldName`),
  CONSTRAINT `FK_ProductCFD_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `productcustomfielddefinitions_chk_1` CHECK ((`DataType` in (_utf8mb4'Text',_utf8mb4'Number',_utf8mb4'Boolean',_utf8mb4'Date',_utf8mb4'JSON')))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productcustomfielddefinitions`
--

LOCK TABLES `productcustomfielddefinitions` WRITE;
/*!40000 ALTER TABLE `productcustomfielddefinitions` DISABLE KEYS */;
INSERT INTO `productcustomfielddefinitions` VALUES (10,5,'Colors','JSON',1),(11,5,'Instructions','Text',1);
/*!40000 ALTER TABLE `productcustomfielddefinitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productcustomfieldoptions`
--

DROP TABLE IF EXISTS `productcustomfieldoptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productcustomfieldoptions` (
  `OptionID` int NOT NULL AUTO_INCREMENT,
  `ProductCustomFieldDefinitionID` int NOT NULL,
  `OptionValue` varchar(255) NOT NULL,
  PRIMARY KEY (`OptionID`),
  UNIQUE KEY `UQ_CF_Option` (`ProductCustomFieldDefinitionID`,`OptionValue`),
  CONSTRAINT `FK_CF_Option_Def` FOREIGN KEY (`ProductCustomFieldDefinitionID`) REFERENCES `productcustomfielddefinitions` (`ProductCustomFieldDefinitionID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productcustomfieldoptions`
--

LOCK TABLES `productcustomfieldoptions` WRITE;
/*!40000 ALTER TABLE `productcustomfieldoptions` DISABLE KEYS */;
INSERT INTO `productcustomfieldoptions` VALUES (9,10,'Blue'),(10,10,'Green'),(11,10,'orange'),(12,10,'Purple'),(13,10,'red'),(14,10,'Yellow');
/*!40000 ALTER TABLE `productcustomfieldoptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productcustomfieldvalues`
--

DROP TABLE IF EXISTS `productcustomfieldvalues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productcustomfieldvalues` (
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
  CONSTRAINT `FK_ProductCFV_Def` FOREIGN KEY (`ProductCustomFieldDefinitionID`) REFERENCES `productcustomfielddefinitions` (`ProductCustomFieldDefinitionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductCFV_Product` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productcustomfieldvalues`
--

LOCK TABLES `productcustomfieldvalues` WRITE;
/*!40000 ALTER TABLE `productcustomfieldvalues` DISABLE KEYS */;
INSERT INTO `productcustomfieldvalues` VALUES (7,5,10,NULL,NULL,NULL,NULL,'[\"Green\",\"orange\",\"Purple\",\"red\"]'),(11,5,11,'Burn the tip of incense stick carefully',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `productcustomfieldvalues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productimages`
--

DROP TABLE IF EXISTS `productimages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productimages` (
  `ProductImageID` int NOT NULL AUTO_INCREMENT,
  `ProductID` int NOT NULL,
  `ImageUrl` varchar(500) NOT NULL,
  `AltText` varchar(255) DEFAULT NULL,
  `SortOrder` int NOT NULL DEFAULT '0',
  `IsPrimary` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductImageID`),
  UNIQUE KEY `UQ_ProductImages_Primary` (`ProductID`,`IsPrimary`) /*!80000 INVISIBLE */,
  CONSTRAINT `FK_ProductImages_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productimages`
--

LOCK TABLES `productimages` WRITE;
/*!40000 ALTER TABLE `productimages` DISABLE KEYS */;
INSERT INTO `productimages` VALUES (1,5,'/uploads/1764217221977_ComfyUI_temp_irfls_00002_.png','ComfyUI_temp_irfls_00002_.png',0,1,'2025-11-27 01:20:21'),(2,5,'/uploads/1764217222005_ComfyUI_temp_irfls_00003_.png','ComfyUI_temp_irfls_00003_.png',0,0,'2025-11-27 01:20:22'),(5,8,'/uploads/1764217453991_Pasted_Image_-_3.png','Pasted Image - 3.png',0,1,'2025-11-27 01:24:14'),(13,5,'/uploads/1764278029055_ComfyUI_temp_irfls_00007_.png','ComfyUI_temp_irfls_00007_.png',0,2,'2025-11-27 18:13:49'),(14,6,'/uploads/1765855609284_retro-coquette-two-teddy-bears-260nw-2584972087.webp','retro-coquette-two-teddy-bears-260nw-2584972087.webp',0,1,'2025-12-16 00:26:49'),(15,7,'/uploads/1765855619376_star_purple_glitter.jpeg','star purple glitter.jpeg',0,1,'2025-12-16 00:26:59'),(16,17,'/uploads/1765943902073_Anvi_7_-_Kpop.png','Anvi 7 - Kpop.png',0,1,'2025-12-17 00:58:22'),(17,19,'/uploads/1766031012933_shopping.webp','shopping.webp',0,1,'2025-12-18 01:10:12');
/*!40000 ALTER TABLE `productimages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productinventorylevels`
--

DROP TABLE IF EXISTS `productinventorylevels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productinventorylevels` (
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
  CONSTRAINT `FK_ProductInventoryLevels_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `productlots` (`ProductLotID`),
  CONSTRAINT `FK_ProductInventoryLevels_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductInventoryLevels_Warehouses` FOREIGN KEY (`WarehouseID`) REFERENCES `warehouses` (`WarehouseID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productinventorylevels`
--

LOCK TABLES `productinventorylevels` WRITE;
/*!40000 ALTER TABLE `productinventorylevels` DISABLE KEYS */;
INSERT INTO `productinventorylevels` (`ProductInventoryLevelID`, `ProductID`, `WarehouseID`, `StockQuantity`, `ReservedQuantity`, `MinStockLevel`, `MaxStockLevel`, `LastUpdatedAt`, `ProductLotID`) VALUES (1,1,1,150.0000,0.0000,NULL,NULL,'2025-12-18 00:16:33',NULL),(2,5,1,12.0000,0.0000,NULL,NULL,'2026-01-05 23:42:16',NULL),(3,2,1,5.0000,0.0000,NULL,NULL,'2025-12-03 00:40:40',NULL),(4,6,1,12.0000,0.0000,NULL,NULL,'2025-12-18 00:16:33',NULL),(5,7,1,3.0000,0.0000,NULL,NULL,'2025-12-03 00:40:40',NULL),(6,4,1,14.0000,0.0000,NULL,NULL,'2025-12-18 00:16:33',NULL),(7,9,2,10.0000,0.0000,5.0000,50.0000,'2025-11-28 21:35:29',NULL),(8,8,2,10.0000,0.0000,NULL,NULL,'2025-12-01 23:06:40',NULL),(9,5,2,18.0000,0.0000,NULL,NULL,'2026-01-05 23:42:16',NULL),(10,6,2,10.0000,0.0000,NULL,NULL,'2025-12-16 23:35:26',NULL),(11,17,1,10.0000,0.0000,NULL,NULL,'2025-12-17 00:52:32',NULL),(12,18,1,100.0000,0.0000,NULL,NULL,'2025-12-17 23:09:12',1),(13,18,1,1000.0000,0.0000,NULL,NULL,'2025-12-17 23:11:53',NULL),(14,18,1,10.0000,0.0000,NULL,NULL,'2025-12-17 23:49:40',2),(15,9,1,45.0000,0.0000,NULL,NULL,'2025-12-17 23:51:53',NULL),(16,19,1,10.0000,0.0000,0.0000,0.0000,'2025-12-18 00:43:28',NULL);
/*!40000 ALTER TABLE `productinventorylevels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productlotinventory`
--

DROP TABLE IF EXISTS `productlotinventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productlotinventory` (
  `ProductLotInventoryID` int NOT NULL AUTO_INCREMENT,
  `ProductLotID` int NOT NULL,
  `WarehouseID` int NOT NULL,
  `Quantity` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductLotInventoryID`),
  UNIQUE KEY `UQ_Lot_Warehouse` (`ProductLotID`,`WarehouseID`),
  KEY `WarehouseID` (`WarehouseID`),
  CONSTRAINT `productlotinventory_ibfk_1` FOREIGN KEY (`ProductLotID`) REFERENCES `productlots` (`ProductLotID`),
  CONSTRAINT `productlotinventory_ibfk_2` FOREIGN KEY (`WarehouseID`) REFERENCES `warehouses` (`WarehouseID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productlotinventory`
--

LOCK TABLES `productlotinventory` WRITE;
/*!40000 ALTER TABLE `productlotinventory` DISABLE KEYS */;
INSERT INTO `productlotinventory` VALUES (1,1,1,100.0000,'2025-12-17 23:09:12'),(2,2,1,10.0000,'2025-12-17 23:49:40');
/*!40000 ALTER TABLE `productlotinventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productlots`
--

DROP TABLE IF EXISTS `productlots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productlots` (
  `ProductLotID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `LotNumber` varchar(100) NOT NULL,
  `ExpirationDate` date DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductLotID`),
  UNIQUE KEY `UQ_ProductLots` (`CompanyID`,`ProductID`,`LotNumber`),
  KEY `FK_ProductLots_Product` (`ProductID`),
  CONSTRAINT `FK_ProductLots_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductLots_Product` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productlots`
--

LOCK TABLES `productlots` WRITE;
/*!40000 ALTER TABLE `productlots` DISABLE KEYS */;
INSERT INTO `productlots` VALUES (1,5,18,'lot001','2027-04-12','2025-12-17 23:09:12'),(2,5,18,'lot002','2027-07-15','2025-12-17 23:49:40');
/*!40000 ALTER TABLE `productlots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productmarketplacemappings`
--

DROP TABLE IF EXISTS `productmarketplacemappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productmarketplacemappings` (
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
  CONSTRAINT `FK_ProductMarketplaceMappings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`),
  CONSTRAINT `FK_ProductMarketplaceMappings_Connections` FOREIGN KEY (`CompanyMarketplaceConnectionID`) REFERENCES `companymarketplaceconnections` (`CompanyMarketplaceConnectionID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductMarketplaceMappings_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`) ON DELETE CASCADE,
  CONSTRAINT `productmarketplacemappings_chk_1` CHECK ((`SyncStatus` in (_utf8mb4'Pending',_utf8mb4'Synced',_utf8mb4'Error',_utf8mb4'Disabled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productmarketplacemappings`
--

LOCK TABLES `productmarketplacemappings` WRITE;
/*!40000 ALTER TABLE `productmarketplacemappings` DISABLE KEYS */;
/*!40000 ALTER TABLE `productmarketplacemappings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productpacks`
--

DROP TABLE IF EXISTS `productpacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productpacks` (
  `ProductPackID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `PackProductID` int NOT NULL,
  `ComponentProductID` int NOT NULL,
  `ComponentQuantity` decimal(18,4) NOT NULL,
  PRIMARY KEY (`ProductPackID`),
  UNIQUE KEY `UQ_ProductPacks` (`PackProductID`,`ComponentProductID`),
  KEY `FK_ProductPacks_Company` (`CompanyID`),
  KEY `FK_ProductPacks_ComponentProduct` (`ComponentProductID`),
  CONSTRAINT `FK_ProductPacks_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductPacks_ComponentProduct` FOREIGN KEY (`ComponentProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_ProductPacks_PackProduct` FOREIGN KEY (`PackProductID`) REFERENCES `products` (`ProductID`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productpacks`
--

LOCK TABLES `productpacks` WRITE;
/*!40000 ALTER TABLE `productpacks` DISABLE KEYS */;
INSERT INTO `productpacks` VALUES (6,5,17,5,1.0000),(7,5,17,6,1.0000);
/*!40000 ALTER TABLE `productpacks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
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
  `UsesLots` tinyint(1) NOT NULL DEFAULT '0',
  `UsesSerials` tinyint(1) NOT NULL DEFAULT '0',
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
  CONSTRAINT `FK_Products_Brands` FOREIGN KEY (`ProductBrandID`) REFERENCES `productbrands` (`ProductBrandID`),
  CONSTRAINT `FK_Products_Categories` FOREIGN KEY (`ProductCategoryID`) REFERENCES `productcategories` (`ProductCategoryID`),
  CONSTRAINT `FK_Products_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Products_DimensionUnit` FOREIGN KEY (`DimensionUnitID`) REFERENCES `unitsofmeasure` (`UnitID`),
  CONSTRAINT `FK_Products_Unit` FOREIGN KEY (`UnitID`) REFERENCES `unitsofmeasure` (`UnitID`),
  CONSTRAINT `FK_Products_WeightUnit` FOREIGN KEY (`WeightUnitID`) REFERENCES `unitsofmeasure` (`UnitID`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,5,'PS-001','Palo Santo Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',NULL),(2,5,'PS-002','Ruda Incense Sticks',NULL,1,2,1,500.0000,1000.0000,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',NULL),(3,5,'PS-003','Vainilla Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',1),(4,5,'PS-004','Myrrh Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',1),(5,5,'PS-005','Almizcle Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',1),(6,5,'PS-006','Canela Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',1),(7,5,'PS-007','Lavanda Incense Sticks',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1.23E+12',1,'2025-11-13 01:48:16','2025-11-13 01:48:16',1),(8,5,'PS-010','Amor Incense Hexagonal',NULL,1,2,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/1764129713112_ComfyUI_temp_irfls_00002_.png',NULL,1,'2025-11-26 01:01:53','2025-11-26 01:01:53',1),(9,5,'PS-011','product 1',NULL,2,2,1,1000.0000,2000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412353',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(10,5,'PS-012','product 2',NULL,3,2,1,1500.0000,3000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412354',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(11,5,'PS-013','product 3',NULL,3,2,1,2500.0000,5000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412355',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(12,5,'PS-014','product 4',NULL,3,2,1,4000.0000,9000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412356',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(13,5,'PS-015','product 5',NULL,3,2,1,1500.0000,4000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412357',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',NULL),(14,5,'PS-016','product 6',NULL,3,2,1,4000.0000,7000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412358',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(15,5,'PS-017','product 7',NULL,3,2,1,3000.0000,8000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234123412359',1,'2025-11-28 18:54:16','2025-11-28 18:54:16',1),(16,6,'1234','jkjkkhkh',NULL,NULL,NULL,1,500.0000,1000.0000,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-12-12 00:09:58','2025-12-12 00:09:58',NULL),(17,5,'pk001','incense pack',NULL,1,2,1,1000.0000,1750.0400,1,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-12-17 00:28:28','2025-12-17 00:28:28',NULL),(18,5,'M001','Paracetamol',NULL,3,NULL,1,500.0000,1000.0000,1,0,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-12-17 21:53:03','2025-12-17 21:53:03',1),(19,5,'S001','Laptop',NULL,3,2,1,35000.0000,60000.0000,1,0,0,1,5.000,1,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-12-18 00:35:53','2025-12-18 00:35:53',1);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productserials`
--

DROP TABLE IF EXISTS `productserials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productserials` (
  `ProductSerialID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `ProductID` int NOT NULL,
  `SerialNumber` varchar(100) NOT NULL,
  `Status` varchar(50) DEFAULT 'InStock',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductSerialID`),
  UNIQUE KEY `UQ_ProductSerials` (`CompanyID`,`ProductID`,`SerialNumber`),
  KEY `FK_ProductSerials_Product` (`ProductID`),
  CONSTRAINT `FK_ProductSerials_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductSerials_Product` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `productserials_chk_1` CHECK ((`Status` in (_utf8mb4'InStock',_utf8mb4'Reserved',_utf8mb4'Sold',_utf8mb4'Returned',_utf8mb4'Scrapped')))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productserials`
--

LOCK TABLES `productserials` WRITE;
/*!40000 ALTER TABLE `productserials` DISABLE KEYS */;
INSERT INTO `productserials` VALUES (1,5,19,'1','InStock','2025-12-18 00:43:28'),(2,5,19,'2','InStock','2025-12-18 00:43:28'),(3,5,19,'3','InStock','2025-12-18 00:43:28'),(4,5,19,'4','InStock','2025-12-18 00:43:28'),(5,5,19,'5','InStock','2025-12-18 00:43:28'),(6,5,19,'6','InStock','2025-12-18 00:43:28'),(7,5,19,'7','InStock','2025-12-18 00:43:28'),(8,5,19,'8','InStock','2025-12-18 00:43:28'),(9,5,19,'9','InStock','2025-12-18 00:43:28'),(10,5,19,'10','InStock','2025-12-18 00:43:28');
/*!40000 ALTER TABLE `productserials` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotion_scopes`
--

LOCK TABLES `promotion_scopes` WRITE;
/*!40000 ALTER TABLE `promotion_scopes` DISABLE KEYS */;
INSERT INTO `promotion_scopes` VALUES (92,2,'product','product 1'),(91,2,'category','Velas'),(93,2,'channel','POS'),(98,3,'product','Almizcle Incense Sticks'),(99,3,'channel','POS'),(107,7,'product','Canela Incense Sticks'),(108,7,'product','product 1'),(109,7,'channel','POS'),(110,8,'product','Laptop'),(111,8,'channel','POS');
/*!40000 ALTER TABLE `promotion_scopes` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `promotion_usages`
--

LOCK TABLES `promotion_usages` WRITE;
/*!40000 ALTER TABLE `promotion_usages` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotion_usages` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
INSERT INTO `promotions` VALUES (2,'vela',NULL,NULL,'percent',50.0000,NULL,1,1,100,6,NULL,NULL,NULL,NULL,NULL,'America/Santiago','2025-12-08 23:45:25','2025-12-25 23:36:35',5),(3,'xx',NULL,NULL,'bogo',2.0000,NULL,1,1,100,10,NULL,NULL,NULL,NULL,NULL,'America/Santiago','2025-12-08 23:46:22','2025-12-25 23:51:01',5),(7,'Bundle Inc y Vela',NULL,NULL,'bundle',2500.0000,NULL,1,1,100,NULL,NULL,NULL,NULL,NULL,NULL,'America/Santiago','2025-12-28 00:32:04','2025-12-28 00:32:48',5),(8,'Electronics',NULL,NULL,'shipping',0.0000,NULL,1,1,100,NULL,NULL,NULL,NULL,NULL,NULL,'America/Santiago','2025-12-28 01:17:59','2025-12-28 01:17:59',5);
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchaseorderitems`
--

DROP TABLE IF EXISTS `purchaseorderitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchaseorderitems` (
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
  CONSTRAINT `FK_PurchaseOrderItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_PurchaseOrderItems_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `purchaseorders` (`PurchaseOrderID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchaseorderitems`
--

LOCK TABLES `purchaseorderitems` WRITE;
/*!40000 ALTER TABLE `purchaseorderitems` DISABLE KEYS */;
INSERT INTO `purchaseorderitems` (`PurchaseOrderItemID`, `PurchaseOrderID`, `ProductID`, `Description`, `Quantity`, `UnitPrice`, `TaxAmount`, `ReceivedQuantity`) VALUES (3,2,1,'Palo Santo Caja 12 und',100.0000,500.0000,0.0000,50.0000),(4,3,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.0000,0.0000),(5,3,19,'Laptop',1.0000,60000.0000,0.0000,0.0000),(6,4,19,'Laptop',1.0000,60000.0000,35000.0000,0.0000);
/*!40000 ALTER TABLE `purchaseorderitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchaseorders`
--

DROP TABLE IF EXISTS `purchaseorders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchaseorders` (
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
  CONSTRAINT `FK_PurchaseOrders_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PurchaseOrders_CreatedBy` FOREIGN KEY (`CreatedByEmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_PurchaseOrders_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `suppliers` (`SupplierID`),
  CONSTRAINT `purchaseorders_chk_1` CHECK ((`Status` in (_utf8mb4'Draft',_utf8mb4'Submitted',_utf8mb4'Approved',_utf8mb4'PartiallyReceived',_utf8mb4'Received',_utf8mb4'Cancelled')))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchaseorders`
--

LOCK TABLES `purchaseorders` WRITE;
/*!40000 ALTER TABLE `purchaseorders` DISABLE KEYS */;
INSERT INTO `purchaseorders` VALUES (2,1,1,'2025-11-13 10:00:00','2025-11-20 10:00:00','PO-00001','PartiallyReceived',50000.0000,'Test purchase order from API','Av. Siempre Viva 123, Santiago',1),(3,5,2,'2025-12-19 00:42:24','2026-01-18 00:00:00','PO-705635','Draft',61000.0000,NULL,NULL,2),(4,5,2,'2025-12-19 00:44:40','2026-01-01 00:00:00','PO-743837','Draft',95000.0000,NULL,NULL,2);
/*!40000 ALTER TABLE `purchaseorders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rolepermissions`
--

DROP TABLE IF EXISTS `rolepermissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rolepermissions` (
  `RolePermissionID` int NOT NULL AUTO_INCREMENT,
  `RoleID` int NOT NULL,
  `PermissionName` varchar(100) NOT NULL,
  `PermissionDescription` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`RolePermissionID`),
  UNIQUE KEY `UQ_Role_Permission` (`RoleID`,`PermissionName`),
  CONSTRAINT `FK_RolePermissions_Roles` FOREIGN KEY (`RoleID`) REFERENCES `roles` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rolepermissions`
--

LOCK TABLES `rolepermissions` WRITE;
/*!40000 ALTER TABLE `rolepermissions` DISABLE KEYS */;
INSERT INTO `rolepermissions` VALUES (4,1,'inventory.view',NULL),(5,1,'sales.view',NULL);
/*!40000 ALTER TABLE `rolepermissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `RoleID` int NOT NULL AUTO_INCREMENT,
  `CompanyID` int NOT NULL,
  `RoleName` varchar(100) NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`RoleID`),
  UNIQUE KEY `UQ_Role_Company_Name` (`CompanyID`,`RoleName`),
  CONSTRAINT `FK_Roles_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,5,'Bodeguero',NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
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
  CONSTRAINT `FK_Sales_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_Sales_Currencies` FOREIGN KEY (`CurrencyID`) REFERENCES `currencies` (`CurrencyID`),
  CONSTRAINT `FK_Sales_Customers` FOREIGN KEY (`CustomerID`) REFERENCES `customers` (`CustomerID`),
  CONSTRAINT `FK_Sales_Employees` FOREIGN KEY (`EmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_Sales_GeneratedFromGuia` FOREIGN KEY (`GeneratedFromGuiaID`) REFERENCES `sales` (`SaleID`),
  CONSTRAINT `FK_Sales_OriginalSale` FOREIGN KEY (`OriginalSaleID`) REFERENCES `sales` (`SaleID`),
  CONSTRAINT `CK_Sales_DocumentType` CHECK ((`DocumentType` in (_utf8mb4'FACTURA',_utf8mb4'BOLETA',_utf8mb4'GUIA_DESPACHO',_utf8mb4'NOTA_CREDITO',_utf8mb4'NOTA_DEBITO',_utf8mb4'FACTURA_EXENTA',_utf8mb4'BOLETA_EXENTA',_utf8mb4'COTIZACION'))),
  CONSTRAINT `CK_Sales_TaxAmount_Exenta` CHECK ((((`IsExenta` = 1) and (`TaxAmountTotal` = 0)) or (`IsExenta` = 0))),
  CONSTRAINT `sales_chk_1` CHECK ((`PaymentStatus` in (_utf8mb4'Unpaid',_utf8mb4'PartiallyPaid',_utf8mb4'Paid',_utf8mb4'Overdue')))
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
INSERT INTO `sales` (`SaleID`, `CompanyID`, `CustomerID`, `EmployeeID`, `SaleDate`, `DocumentType`, `DocumentNumber`, `IsExenta`, `OriginalSaleID`, `GeneratedFromGuiaID`, `TotalAmount`, `DiscountAmountTotal`, `TaxAmountTotal`, `AmountPaid`, `PaymentStatus`, `CurrencyID`, `Status`, `Notes`, `ShippingAddress`, `BillingAddress`, `MarketplaceOrderID_External`, `CreatedAt`, `UpdatedAt`) VALUES (1,1,1,1,'2025-11-13 10:00:00','FACTURA','F-00001',0,NULL,NULL,2000.0000,0.0000,380.0000,2380.0000,'Paid',1,'Completed','Test sale from API','Av. Siempre Viva 123, Santiago','Av. Siempre Viva 123, Santiago',NULL,'2025-11-13 22:31:56','2025-11-13 22:31:56'),(2,1,1,1,'2025-11-13 10:00:00','FACTURA','F-00002',0,NULL,NULL,2000.0000,0.0000,380.0000,2380.0000,'Paid',1,'Completed','Sale with stock deduction','Av. Siempre Viva 123, Santiago','Av. Siempre Viva 123, Santiago',NULL,'2025-11-13 22:48:52','2025-11-13 22:48:52'),(3,1,1,1,'2025-11-14 10:00:00','FACTURA','F-00003',0,NULL,NULL,2000.0000,0.0000,380.0000,0.0000,'Unpaid',1,'Completed','Test sale from API','Av. Siempre Viva 123','Av. Siempre Viva 123',NULL,'2025-11-15 00:15:51','2025-11-15 00:15:51'),(4,1,1,1,'2025-11-16 00:53:15','NOTA_CREDITO','NC-00001',0,1,NULL,2000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','NC for full return',NULL,NULL,NULL,'2025-11-16 00:53:15','2025-11-16 00:53:15'),(5,1,1,1,'2025-11-16 01:00:29','NOTA_DEBITO','ND-00001',0,1,NULL,2000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','Extra 2 units delivered',NULL,NULL,NULL,'2025-11-16 01:00:29','2025-11-16 01:00:29'),(7,1,NULL,1,'2025-11-17 00:07:00','COTIZACION','COT-20251117-1763348820700',0,NULL,NULL,3000.0000,0.0000,570.0000,0.0000,'Unpaid',1,'Draft','Ticket from Counter 3',NULL,NULL,NULL,'2025-11-17 00:07:00','2025-11-17 00:07:00'),(9,1,1,1,'2025-11-17 23:42:44','NOTA_DEBITO','ND-00002',0,1,NULL,2000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','Extra 2 units delivered',NULL,NULL,NULL,'2025-11-17 23:42:44','2025-11-17 23:42:44'),(10,5,NULL,2,'2025-11-24 23:27:42','COTIZACION','COT-20251124-1764037662043',0,NULL,NULL,57000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-24 23:27:42','2025-12-03 23:34:01'),(11,5,NULL,2,'2025-11-24 23:47:42','COTIZACION','COT-20251124-1764038862774',0,NULL,NULL,2000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-24 23:47:42','2025-12-03 23:34:01'),(12,5,NULL,2,'2025-11-24 23:53:40','COTIZACION','COT-20251124-1764039220701',0,NULL,NULL,17000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-24 23:53:40','2025-12-03 23:34:00'),(13,5,NULL,2,'2025-11-24 23:54:46','COTIZACION','COT-20251124-1764039286518',0,NULL,NULL,15000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-24 23:54:46','2025-12-03 23:33:59'),(14,5,NULL,2,'2025-11-24 23:56:35','COTIZACION','COT-20251124-1764039395933',0,NULL,NULL,16000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-24 23:56:35','2025-11-25 19:23:54'),(15,5,1,2,'2025-11-25 21:12:44','COTIZACION','TKT-20251125-1764115964040',0,NULL,NULL,4000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-25 21:12:44','2025-12-03 23:33:59'),(16,5,1,2,'2025-11-25 21:13:56','BOLETA','BOLETA-1764116036507',0,NULL,NULL,4000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','POS Sale',NULL,NULL,NULL,'2025-11-25 21:13:56','2025-11-25 21:13:56'),(17,5,1,2,'2025-11-25 22:19:28','COTIZACION','COTIZACION-1764119968942',0,NULL,NULL,4000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','POS Sale',NULL,NULL,NULL,'2025-11-25 22:19:28','2025-11-25 22:19:28'),(18,5,1,2,'2025-11-25 23:12:56','COTIZACION','TKT-20251125-1764123176833',0,NULL,NULL,4000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-11-25 23:12:56','2025-12-03 23:33:58'),(19,5,1,2,'2025-11-25 23:13:35','COTIZACION','COTIZACION-1764123215836',0,NULL,NULL,4000.0000,0.0000,0.0000,0.0000,'Unpaid',1,'Completed','POS Sale',NULL,NULL,NULL,'2025-11-25 23:13:35','2025-11-25 23:13:35'),(20,5,1,2,'2025-12-02 23:47:07','COTIZACION','TKT-20251202-1764730027358',0,NULL,NULL,1000.0000,0.0000,190.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-02 23:47:07','2025-12-03 23:33:58'),(21,5,4,2,'2025-12-03 00:40:40','BOLETA','BOLETA-1764733240509',0,NULL,NULL,6000.0000,0.0000,950.0000,6950.0000,'Paid',1,'Completed','POS Sale',NULL,NULL,NULL,'2025-12-03 00:40:40','2025-12-03 00:40:40'),(22,5,1,2,'2025-12-03 22:57:02','COTIZACION','TKT-20251203-1764813422215',0,NULL,NULL,2000.0000,0.0000,380.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 22:57:02','2025-12-03 23:33:57'),(23,5,1,2,'2025-12-03 23:09:28','COTIZACION','TKT-20251203-1764814168284',0,NULL,NULL,6000.0000,0.0000,950.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:09:28','2025-12-03 23:33:57'),(24,5,1,2,'2025-12-03 23:13:36','COTIZACION','TKT-20251203-1764814416834',0,NULL,NULL,2000.0000,0.0000,380.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:13:36','2025-12-03 23:33:56'),(25,5,1,2,'2025-12-03 23:14:13','COTIZACION','TKT-20251203-1764814453896',0,NULL,NULL,1000.0000,0.0000,190.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:14:13','2025-12-03 23:33:56'),(26,5,1,2,'2025-12-03 23:16:14','COTIZACION','TKT-20251203-1764814574156',0,NULL,NULL,5000.0000,0.0000,760.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:16:14','2025-12-03 23:33:55'),(27,5,1,2,'2025-12-03 23:17:31','COTIZACION','TKT-20251203-1764814651374',0,NULL,NULL,10000.0000,0.0000,1900.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:17:31','2025-12-03 23:33:55'),(28,5,1,2,'2025-12-03 23:18:06','COTIZACION','TKT-20251203-1764814686039',0,NULL,NULL,8000.0000,0.0000,1520.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:18:06','2025-12-03 23:33:53'),(29,5,1,2,'2025-12-03 23:19:35','COTIZACION','TKT-20251203-1764814775255',0,NULL,NULL,11000.0000,0.0000,2090.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:19:35','2025-12-03 23:33:54'),(30,5,1,2,'2025-12-03 23:21:20','COTIZACION','TKT-20251203-1764814880489',0,NULL,NULL,2000.0000,0.0000,380.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:21:20','2025-12-03 23:33:52'),(31,5,1,2,'2025-12-03 23:24:08','COTIZACION','TKT-20251203-1764815048133',0,NULL,NULL,4000.0000,0.0000,760.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:24:08','2025-12-03 23:33:51'),(32,5,1,2,'2025-12-03 23:26:20','COTIZACION','TKT-20251203-1764815180575',0,NULL,NULL,6000.0000,0.0000,950.0000,0.0000,'Unpaid',1,'TicketCancelled','POS Ticket',NULL,NULL,NULL,'2025-12-03 23:26:20','2025-12-03 23:33:51'),(33,5,1,2,'2025-12-03 23:30:04','COTIZACION','TKT-20251203-1764815404084',0,NULL,NULL,1000.0000,0.0000,190.0000,0.0000,'Unpaid',1,'TicketBilled','POS Ticket INTENDED_DOC:TICKET',NULL,NULL,NULL,'2025-12-03 23:30:04','2025-12-03 23:30:04'),(34,5,1,2,'2025-12-03 23:42:45','BOLETA','BOLETA-1764816165757',0,NULL,NULL,1000.0000,0.0000,190.0000,1190.0000,'Paid',1,'Completed','POS Sale',NULL,NULL,NULL,'2025-12-03 23:42:45','2025-12-03 23:42:45');
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `salesitems`
--

DROP TABLE IF EXISTS `salesitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salesitems` (
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
  CONSTRAINT `FK_SalesItems_Lot` FOREIGN KEY (`ProductLotID`) REFERENCES `productlots` (`ProductLotID`),
  CONSTRAINT `FK_SalesItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_SalesItems_Sales` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SalesItems_Serial` FOREIGN KEY (`ProductSerialID`) REFERENCES `productserials` (`ProductSerialID`),
  CONSTRAINT `CK_SalesItems_Tax_Exenta` CHECK ((((`IsLineExenta` = 1) and (`TaxAmountItem` = 0)) or (`IsLineExenta` = 0)))
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `salesitems`
--

LOCK TABLES `salesitems` WRITE;
/*!40000 ALTER TABLE `salesitems` DISABLE KEYS */;
INSERT INTO `salesitems` (`SalesItemID`, `SaleID`, `ProductID`, `Description`, `Quantity`, `UnitPrice`, `DiscountPercentage`, `DiscountAmountItem`, `TaxRatePercentage`, `TaxAmountItem`, `IsLineExenta`, `ProductLotID`, `ProductSerialID`, `TaxRateID`) VALUES (1,1,1,'Palo Santo Pack',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(2,2,1,'Palo Santo Pack',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(3,3,1,'Palo Santo Caja 12 und',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(4,4,1,'Returned 2 units',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(5,5,1,'Extra delivery',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(7,7,1,'Palo Santo Incense Sticks',3.0000,1000.0000,0.00,0.0000,19.00,570.0000,0,NULL,NULL,NULL),(8,9,1,'Extra delivery',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(9,10,1,'Palo Santo Incense Sticks',57.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(10,11,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(11,11,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(12,12,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(13,12,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(14,12,3,'Vainilla Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(15,12,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(16,12,5,'Almizcle Incense Sticks',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(17,12,1,'Palo Santo Incense Sticks',11.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(18,13,5,'Almizcle Incense Sticks',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(19,13,2,'Ruda Incense Sticks',4.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(20,13,3,'Vainilla Incense Sticks',4.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(21,13,6,'Canela Incense Sticks',2.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(22,13,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(23,13,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(24,13,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(25,14,5,'Almizcle Incense Sticks',13.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(26,14,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(27,14,3,'Vainilla Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(28,14,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(29,15,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(30,15,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(31,15,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(32,15,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(33,16,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(34,16,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(35,16,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(36,16,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(37,17,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(38,17,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(39,17,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(40,17,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(41,18,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(42,18,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(43,18,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(44,18,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(45,19,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(46,19,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(47,19,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(48,19,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,0,NULL,NULL,NULL),(49,20,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(50,21,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1),(51,21,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1),(52,21,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1),(53,21,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,1,NULL,NULL,NULL),(54,21,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1),(55,21,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1),(56,22,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(57,22,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(58,23,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(59,23,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(60,23,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(61,23,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(62,23,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(63,23,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,1,NULL,NULL,NULL),(64,24,5,'Almizcle Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(65,25,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(66,26,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(67,26,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(68,26,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(69,26,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,1,NULL,NULL,NULL),(70,26,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(71,27,6,'Canela Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(72,27,1,'Palo Santo Incense Sticks',3.0000,1000.0000,0.00,0.0000,19.00,570.0000,0,NULL,NULL,NULL),(73,27,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(74,27,5,'Almizcle Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(75,27,4,'Myrrh Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(76,28,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(77,28,4,'Myrrh Incense Sticks',7.0000,1000.0000,0.00,0.0000,19.00,1330.0000,0,NULL,NULL,NULL),(78,29,5,'Almizcle Incense Sticks',8.0000,1000.0000,0.00,0.0000,19.00,1520.0000,0,NULL,NULL,NULL),(79,29,6,'Canela Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(80,29,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(81,30,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(82,30,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(83,31,5,'Almizcle Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(84,31,4,'Myrrh Incense Sticks',2.0000,1000.0000,0.00,0.0000,19.00,380.0000,0,NULL,NULL,NULL),(85,32,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(86,32,4,'Myrrh Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(87,32,1,'Palo Santo Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(88,32,6,'Canela Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(89,32,7,'Lavanda Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(90,32,2,'Ruda Incense Sticks',1.0000,1000.0000,0.00,0.0000,0.00,0.0000,1,NULL,NULL,NULL),(91,33,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,NULL),(92,34,5,'Almizcle Incense Sticks',1.0000,1000.0000,0.00,0.0000,19.00,190.0000,0,NULL,NULL,1);
/*!40000 ALTER TABLE `salesitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `salespayments`
--

DROP TABLE IF EXISTS `salespayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salespayments` (
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
  CONSTRAINT `FK_SalesPayments_Method` FOREIGN KEY (`PaymentMethodID`) REFERENCES `paymentmethods` (`PaymentMethodID`),
  CONSTRAINT `FK_SalesPayments_Sale` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `salespayments`
--

LOCK TABLES `salespayments` WRITE;
/*!40000 ALTER TABLE `salespayments` DISABLE KEYS */;
INSERT INTO `salespayments` VALUES (1,1,1,2380.0000,'2025-11-13 22:31:56','CAJA-1',NULL),(2,2,1,2380.0000,'2025-11-13 22:48:53','CAJA-2',NULL),(3,21,1,6950.0000,'2025-12-03 00:40:40',NULL,NULL),(4,34,1,1190.0000,'2025-12-03 23:42:45',NULL,NULL);
/*!40000 ALTER TABLE `salespayments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `siicaf`
--

DROP TABLE IF EXISTS `siicaf`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `siicaf` (
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
  CONSTRAINT `FK_SiiCAF_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `siicaf`
--

LOCK TABLES `siicaf` WRITE;
/*!40000 ALTER TABLE `siicaf` DISABLE KEYS */;
/*!40000 ALTER TABLE `siicaf` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `siidtelogs`
--

DROP TABLE IF EXISTS `siidtelogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `siidtelogs` (
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
  CONSTRAINT `FK_SiiDteLogs_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiDteLogs_Sales` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `siidtelogs`
--

LOCK TABLES `siidtelogs` WRITE;
/*!40000 ALTER TABLE `siidtelogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `siidtelogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `siirejecteddocs`
--

DROP TABLE IF EXISTS `siirejecteddocs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `siirejecteddocs` (
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
  CONSTRAINT `FK_SiiRejectedDocs_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiRejectedDocs_Sale` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `siirejecteddocs`
--

LOCK TABLES `siirejecteddocs` WRITE;
/*!40000 ALTER TABLE `siirejecteddocs` DISABLE KEYS */;
/*!40000 ALTER TABLE `siirejecteddocs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `siisendqueue`
--

DROP TABLE IF EXISTS `siisendqueue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `siisendqueue` (
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
  CONSTRAINT `FK_SiiSendQueue_Company` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SiiSendQueue_Sale` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`),
  CONSTRAINT `siisendqueue_chk_1` CHECK ((`Status` in (_utf8mb4'Pending',_utf8mb4'Processing',_utf8mb4'Sent',_utf8mb4'Failed',_utf8mb4'Retried',_utf8mb4'Completed')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `siisendqueue`
--

LOCK TABLES `siisendqueue` WRITE;
/*!40000 ALTER TABLE `siisendqueue` DISABLE KEYS */;
/*!40000 ALTER TABLE `siisendqueue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptionplans`
--

DROP TABLE IF EXISTS `subscriptionplans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptionplans` (
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
  CONSTRAINT `FK_SubscriptionPlans_Currency` FOREIGN KEY (`PlanCurrencyID`) REFERENCES `currencies` (`CurrencyID`),
  CONSTRAINT `subscriptionplans_chk_1` CHECK ((`BillingCycle` in (_utf8mb4'Monthly',_utf8mb4'Annually',_utf8mb4'OneTime')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptionplans`
--

LOCK TABLES `subscriptionplans` WRITE;
/*!40000 ALTER TABLE `subscriptionplans` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscriptionplans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplierinvoiceitems`
--

DROP TABLE IF EXISTS `supplierinvoiceitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplierinvoiceitems` (
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
  CONSTRAINT `FK_SupplierInvoiceItems_GLAccount` FOREIGN KEY (`GLAccountID`) REFERENCES `chartofaccounts` (`AccountID`),
  CONSTRAINT `FK_SupplierInvoiceItems_Products` FOREIGN KEY (`ProductID`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_SupplierInvoiceItems_SupplierInvoices` FOREIGN KEY (`SupplierInvoiceID`) REFERENCES `supplierinvoices` (`SupplierInvoiceID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplierinvoiceitems`
--

LOCK TABLES `supplierinvoiceitems` WRITE;
/*!40000 ALTER TABLE `supplierinvoiceitems` DISABLE KEYS */;
INSERT INTO `supplierinvoiceitems` (`SupplierInvoiceItemID`, `SupplierInvoiceID`, `ProductID`, `Description`, `Quantity`, `UnitPrice`, `TaxAmountItem`, `GLAccountID`) VALUES (1,1,1,'Palo Santo Caja 12 und',50.0000,500.0000,0.0000,NULL);
/*!40000 ALTER TABLE `supplierinvoiceitems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplierinvoices`
--

DROP TABLE IF EXISTS `supplierinvoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplierinvoices` (
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
  `DirectPurchaseID` int DEFAULT NULL,
  `OriginalSupplierInvoiceID` int DEFAULT NULL,
  `SiiTrackID` varchar(100) DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`SupplierInvoiceID`),
  UNIQUE KEY `UQ_SupplierInvoice_Company_Supplier_InvNum_DocType` (`CompanyID`,`SupplierID`,`InvoiceNumber_Supplier`,`DocumentType`),
  KEY `FK_SupplierInvoices_Suppliers` (`SupplierID`),
  KEY `FK_SupplierInvoices_PurchaseOrders` (`PurchaseOrderID`),
  KEY `FK_SupplierInvoices_GoodsReceipts` (`GoodsReceiptID`),
  KEY `FK_SupplierInvoices_Original` (`OriginalSupplierInvoiceID`),
  KEY `FK_SI_DP` (`DirectPurchaseID`),
  CONSTRAINT `FK_SI_DP` FOREIGN KEY (`DirectPurchaseID`) REFERENCES `directpurchases` (`DirectPurchaseID`),
  CONSTRAINT `FK_SupplierInvoices_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierInvoices_GoodsReceipts` FOREIGN KEY (`GoodsReceiptID`) REFERENCES `goodsreceipts` (`GoodsReceiptID`),
  CONSTRAINT `FK_SupplierInvoices_Original` FOREIGN KEY (`OriginalSupplierInvoiceID`) REFERENCES `supplierinvoices` (`SupplierInvoiceID`),
  CONSTRAINT `FK_SupplierInvoices_PurchaseOrders` FOREIGN KEY (`PurchaseOrderID`) REFERENCES `purchaseorders` (`PurchaseOrderID`),
  CONSTRAINT `FK_SupplierInvoices_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `suppliers` (`SupplierID`),
  CONSTRAINT `supplierinvoices_chk_1` CHECK ((`Status` in (_utf8mb4'Unpaid',_utf8mb4'PartiallyPaid',_utf8mb4'Paid',_utf8mb4'Void')))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplierinvoices`
--

LOCK TABLES `supplierinvoices` WRITE;
/*!40000 ALTER TABLE `supplierinvoices` DISABLE KEYS */;
INSERT INTO `supplierinvoices` VALUES (1,1,1,'FACTURA_PROVEEDOR','F-1001',0,'2025-11-15','2025-12-15',250000.0000,47500.0000,50000.0000,'PartiallyPaid',2,1,NULL,NULL,NULL,'Invoice for received goods');
/*!40000 ALTER TABLE `supplierinvoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplierpaymentallocations`
--

DROP TABLE IF EXISTS `supplierpaymentallocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplierpaymentallocations` (
  `SupplierPaymentAllocationID` int NOT NULL AUTO_INCREMENT,
  `SupplierPaymentID` int NOT NULL,
  `SupplierInvoiceID` int NOT NULL,
  `AmountAllocated` decimal(18,4) NOT NULL,
  `AllocationDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`SupplierPaymentAllocationID`),
  UNIQUE KEY `UQ_SupplierPaymentAllocation` (`SupplierPaymentID`,`SupplierInvoiceID`),
  KEY `FK_SupplierPaymentAllocations_Invoices` (`SupplierInvoiceID`),
  CONSTRAINT `FK_SupplierPaymentAllocations_Invoices` FOREIGN KEY (`SupplierInvoiceID`) REFERENCES `supplierinvoices` (`SupplierInvoiceID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierPaymentAllocations_Payments` FOREIGN KEY (`SupplierPaymentID`) REFERENCES `supplierpayments` (`SupplierPaymentID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplierpaymentallocations`
--

LOCK TABLES `supplierpaymentallocations` WRITE;
/*!40000 ALTER TABLE `supplierpaymentallocations` DISABLE KEYS */;
INSERT INTO `supplierpaymentallocations` VALUES (1,2,1,50000.0000,'2025-11-14 00:28:26');
/*!40000 ALTER TABLE `supplierpaymentallocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplierpayments`
--

DROP TABLE IF EXISTS `supplierpayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplierpayments` (
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
  CONSTRAINT `FK_SupplierPayments_BankAccounts` FOREIGN KEY (`BankAccountID`) REFERENCES `bankaccounts` (`BankAccountID`),
  CONSTRAINT `FK_SupplierPayments_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierPayments_Employees` FOREIGN KEY (`ProcessedByEmployeeID`) REFERENCES `employees` (`EmployeeID`),
  CONSTRAINT `FK_SupplierPayments_PaymentMethods` FOREIGN KEY (`PaymentMethodID`) REFERENCES `paymentmethods` (`PaymentMethodID`),
  CONSTRAINT `FK_SupplierPayments_Suppliers` FOREIGN KEY (`SupplierID`) REFERENCES `suppliers` (`SupplierID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplierpayments`
--

LOCK TABLES `supplierpayments` WRITE;
/*!40000 ALTER TABLE `supplierpayments` DISABLE KEYS */;
INSERT INTO `supplierpayments` VALUES (2,1,1,'2025-11-20 10:00:00',50000.0000,1,NULL,'PAY-0001','Partial payment for invoice 1',1);
/*!40000 ALTER TABLE `supplierpayments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
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
  CONSTRAINT `FK_Suppliers_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,1,'Palo Santo Import Chile','Carlos','carlos@palo.cl','+56 9 1234 5678','76.123.456-7','Av. Siempre Viva 123','Santiago',1,'2025-11-13 23:05:41'),(2,5,'khushbu','avadvv','cscajcjcn@gmail.com','956262221','11.111.111.4','dsabhbvhb','saniago',1,'2025-12-19 00:22:52');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `systemsettings`
--

DROP TABLE IF EXISTS `systemsettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `systemsettings` (
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
  CONSTRAINT `FK_SystemSettings_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `systemsettings_chk_1` CHECK ((`DataType` in (_utf8mb4'String',_utf8mb4'Integer',_utf8mb4'Boolean',_utf8mb4'JSON',_utf8mb4'Decimal')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `systemsettings`
--

LOCK TABLES `systemsettings` WRITE;
/*!40000 ALTER TABLE `systemsettings` DISABLE KEYS */;
/*!40000 ALTER TABLE `systemsettings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `taxrates`
--

DROP TABLE IF EXISTS `taxrates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxrates` (
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
  UNIQUE KEY `uk_taxrates_company_name` (`CompanyID`,`Name`),
  KEY `idx_taxrates_company_default` (`CompanyID`,`IsDefault`),
  KEY `idx_taxrates_company_active` (`CompanyID`,`IsActive`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `taxrates`
--

LOCK TABLES `taxrates` WRITE;
/*!40000 ALTER TABLE `taxrates` DISABLE KEYS */;
INSERT INTO `taxrates` VALUES (1,5,'IVA',19.000,'goods',1,NULL,NULL,1,'2025-12-02 23:14:49','2025-12-02 23:15:10'),(2,5,'Iva Service',14.000,'services',0,NULL,NULL,1,'2025-12-02 23:15:06','2025-12-02 23:15:06');
/*!40000 ALTER TABLE `taxrates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `unitsofmeasure`
--

DROP TABLE IF EXISTS `unitsofmeasure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unitsofmeasure` (
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
-- Dumping data for table `unitsofmeasure`
--

LOCK TABLES `unitsofmeasure` WRITE;
/*!40000 ALTER TABLE `unitsofmeasure` DISABLE KEYS */;
INSERT INTO `unitsofmeasure` VALUES (1,'Piece','Pc',1),(2,'Centimeter','CM',1);
/*!40000 ALTER TABLE `unitsofmeasure` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
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
  CONSTRAINT `FK_Warehouses_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES (1,5,'Main Bodega','Av. Siempre Viva 123, lo barnechea','Santiago',1,1,'2025-11-13 22:39:06'),(2,5,'Sazie Bodega','sazie 2557','santiago',0,1,'2025-11-28 19:24:07');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workorders`
--

DROP TABLE IF EXISTS `workorders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workorders` (
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
  CONSTRAINT `FK_WorkOrders_BOM` FOREIGN KEY (`BOMID`) REFERENCES `billofmaterials` (`BOMID`),
  CONSTRAINT `FK_WorkOrders_Companies` FOREIGN KEY (`CompanyID`) REFERENCES `companies` (`CompanyID`) ON DELETE CASCADE,
  CONSTRAINT `FK_WorkOrders_Products` FOREIGN KEY (`ProductID_ToProduce`) REFERENCES `products` (`ProductID`),
  CONSTRAINT `FK_WorkOrders_Sales` FOREIGN KEY (`SaleID`) REFERENCES `sales` (`SaleID`),
  CONSTRAINT `workorders_chk_1` CHECK ((`Status` in (_utf8mb4'Planned',_utf8mb4'InProgress',_utf8mb4'Completed',_utf8mb4'Cancelled',_utf8mb4'OnHold')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workorders`
--

LOCK TABLES `workorders` WRITE;
/*!40000 ALTER TABLE `workorders` DISABLE KEYS */;
/*!40000 ALTER TABLE `workorders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `fact_inventory_balances`
--

/*!50001 DROP VIEW IF EXISTS `fact_inventory_balances`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `fact_inventory_balances` AS with `ordered` as (select `t`.`CompanyID` AS `company_id`,`t`.`ProductID` AS `product_id`,`t`.`WarehouseID` AS `warehouse_id`,`p`.`ProductCategoryID` AS `category_id`,`t`.`ProductLotID` AS `product_lot_id`,`t`.`ProductSerialID` AS `product_serial_id`,cast(`t`.`TransactionDate` as date) AS `snapshot_date`,sum(`t`.`QuantityChange`) OVER (PARTITION BY `t`.`CompanyID`,`t`.`ProductID`,`t`.`WarehouseID`,coalesce(`t`.`ProductLotID`,0),coalesce(`t`.`ProductSerialID`,0) ORDER BY `t`.`TransactionDate`,`t`.`InventoryTransactionID` ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)  AS `stock_on_hand`,`pl`.`ExpirationDate` AS `lot_expiry` from ((`inventorytransactions` `t` left join `products` `p` on((`p`.`ProductID` = `t`.`ProductID`))) left join `productlots` `pl` on((`pl`.`ProductLotID` = `t`.`ProductLotID`)))), `summarized` as (select `ordered`.`company_id` AS `company_id`,`ordered`.`product_id` AS `product_id`,`ordered`.`warehouse_id` AS `warehouse_id`,`ordered`.`category_id` AS `category_id`,`ordered`.`snapshot_date` AS `snapshot_date`,`ordered`.`product_lot_id` AS `product_lot_id`,`ordered`.`product_serial_id` AS `product_serial_id`,max(`ordered`.`stock_on_hand`) AS `stock_on_hand`,max(`ordered`.`lot_expiry`) AS `lot_expiry` from `ordered` group by `ordered`.`company_id`,`ordered`.`product_id`,`ordered`.`warehouse_id`,`ordered`.`category_id`,`ordered`.`snapshot_date`,`ordered`.`product_lot_id`,`ordered`.`product_serial_id`) select `s`.`company_id` AS `company_id`,`s`.`product_id` AS `product_id`,`s`.`warehouse_id` AS `warehouse_id`,`s`.`category_id` AS `category_id`,`s`.`snapshot_date` AS `snapshot_date`,`s`.`product_lot_id` AS `product_lot_id`,`s`.`product_serial_id` AS `product_serial_id`,`s`.`stock_on_hand` AS `stock_on_hand`,0 AS `stock_reserved`,`s`.`lot_expiry` AS `lot_expiry`,`p`.`SKU` AS `product_sku`,`p`.`ProductName` AS `product_name`,`p`.`ProductBrandID` AS `brand_id`,`brand`.`BrandName` AS `brand_name`,`cat`.`CategoryName` AS `category_name`,`w`.`WarehouseName` AS `warehouse_name`,`w`.`AddressLine1` AS `warehouse_address`,`w`.`City` AS `warehouse_city` from ((((`summarized` `s` left join `products` `p` on((`p`.`ProductID` = `s`.`product_id`))) left join `productbrands` `brand` on((`brand`.`ProductBrandID` = `p`.`ProductBrandID`))) left join `productcategories` `cat` on((`cat`.`ProductCategoryID` = `s`.`category_id`))) left join `warehouses` `w` on((`w`.`WarehouseID` = `s`.`warehouse_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `fact_payments`
--

/*!50001 DROP VIEW IF EXISTS `fact_payments`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `fact_payments` AS select `s`.`CompanyID` AS `company_id`,`sp`.`SalesPaymentID` AS `payment_id`,`sp`.`SaleID` AS `sale_id`,cast(`sp`.`PaymentDate` as date) AS `payment_date`,`sp`.`PaymentDate` AS `payment_timestamp`,`sp`.`Amount` AS `amount`,`pm`.`MethodName` AS `method`,`s`.`PaymentStatus` AS `status`,`s`.`PaymentStatus` AS `sale_payment_status`,`s`.`Status` AS `sale_status`,`s`.`CustomerID` AS `customer_id`,`s`.`EmployeeID` AS `employee_id`,`s`.`CurrencyID` AS `currency_id`,`curr`.`CurrencyCode` AS `currency_code`,`curr`.`Symbol` AS `currency_symbol`,`sp`.`ReferenceNumber` AS `reference_number`,`sp`.`BankTransactionID` AS `bank_transaction_id`,`s`.`DocumentType` AS `document_type`,`s`.`DocumentNumber` AS `document_number`,`c`.`CustomerName` AS `customer_name`,`c`.`TaxID` AS `customer_tax_id`,`c`.`Email` AS `customer_email`,`c`.`PhoneNumber` AS `customer_phone`,`c`.`BillingAddressLine1` AS `customer_billing_address`,`c`.`BillingCity` AS `customer_billing_city`,`c`.`ShippingAddressLine1` AS `customer_shipping_address`,`c`.`ShippingCity` AS `customer_shipping_city`,`c`.`CustomerGroupID` AS `customer_group_id`,`cg`.`GroupName` AS `customer_group_name`,`e`.`FirstName` AS `employee_first_name`,`e`.`LastName` AS `employee_last_name`,concat_ws(' ',`e`.`FirstName`,`e`.`LastName`) AS `employee_full_name`,`e`.`Email` AS `employee_email`,`e`.`PhoneNumber` AS `employee_phone` from ((((((`salespayments` `sp` join `sales` `s` on((`s`.`SaleID` = `sp`.`SaleID`))) left join `paymentmethods` `pm` on((`pm`.`PaymentMethodID` = `sp`.`PaymentMethodID`))) left join `currencies` `curr` on((`curr`.`CurrencyID` = `s`.`CurrencyID`))) left join `customers` `c` on((`c`.`CustomerID` = `s`.`CustomerID`))) left join `customergroups` `cg` on((`cg`.`CustomerGroupID` = `c`.`CustomerGroupID`))) left join `employees` `e` on((`e`.`EmployeeID` = `s`.`EmployeeID`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `fact_sales_orders`
--

/*!50001 DROP VIEW IF EXISTS `fact_sales_orders`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `fact_sales_orders` AS select `s`.`CompanyID` AS `company_id`,`s`.`SaleID` AS `sale_id`,cast(`s`.`SaleDate` as date) AS `order_date`,`s`.`SaleDate` AS `order_timestamp`,`s`.`DocumentType` AS `document_type`,`s`.`DocumentNumber` AS `document_number`,coalesce(nullif(trim(`s`.`MarketplaceOrderID_External`),''),'POS') AS `channel`,`s`.`PaymentStatus` AS `payment_status`,`s`.`Status` AS `status`,`s`.`EmployeeID` AS `employee_id`,`s`.`CustomerID` AS `customer_id`,`s`.`CurrencyID` AS `currency_id`,`s`.`TotalAmount` AS `gross_total`,`s`.`SubTotal` AS `net_total`,`s`.`TaxAmountTotal` AS `tax_total`,`s`.`DiscountAmountTotal` AS `discount_total`,`s`.`FinalAmount` AS `final_total`,`item_agg`.`line_count` AS `line_count`,`item_agg`.`distinct_products` AS `distinct_products`,`item_agg`.`total_quantity` AS `total_quantity`,`product_dim`.`product_ids` AS `product_ids`,`product_dim`.`product_skus` AS `product_skus`,`product_dim`.`product_names` AS `product_names`,`product_dim`.`product_brand_ids` AS `product_brand_ids`,`product_dim`.`product_brand_names` AS `product_brand_names`,`product_dim`.`product_category_ids` AS `product_category_ids`,`product_dim`.`product_category_names` AS `product_category_names`,`c`.`CustomerName` AS `customer_name`,`c`.`TaxID` AS `customer_tax_id`,`c`.`Email` AS `customer_email`,`c`.`PhoneNumber` AS `customer_phone`,`c`.`BillingAddressLine1` AS `customer_billing_address`,`c`.`BillingCity` AS `customer_billing_city`,`c`.`ShippingAddressLine1` AS `customer_shipping_address`,`c`.`ShippingCity` AS `customer_shipping_city`,`c`.`CustomerGroupID` AS `customer_group_id`,`cg`.`GroupName` AS `customer_group_name`,`e`.`FirstName` AS `employee_first_name`,`e`.`LastName` AS `employee_last_name`,concat_ws(' ',`e`.`FirstName`,`e`.`LastName`) AS `employee_full_name`,`e`.`Email` AS `employee_email`,`e`.`PhoneNumber` AS `employee_phone`,`curr`.`CurrencyCode` AS `currency_code`,`curr`.`Symbol` AS `currency_symbol`,`s`.`CreatedAt` AS `created_at`,`s`.`UpdatedAt` AS `updated_at` from ((((((`sales` `s` left join (select `si`.`SaleID` AS `SaleID`,count(0) AS `line_count`,count(distinct `si`.`ProductID`) AS `distinct_products`,sum(`si`.`Quantity`) AS `total_quantity` from `salesitems` `si` group by `si`.`SaleID`) `item_agg` on((`item_agg`.`SaleID` = `s`.`SaleID`))) left join (select `si`.`SaleID` AS `SaleID`,group_concat(distinct `si`.`ProductID` order by `si`.`ProductID` ASC separator ',') AS `product_ids`,group_concat(distinct `p`.`SKU` order by `p`.`SKU` ASC separator ',') AS `product_skus`,group_concat(distinct `p`.`ProductName` order by `p`.`ProductName` ASC separator ',') AS `product_names`,group_concat(distinct `p`.`ProductBrandID` order by `p`.`ProductBrandID` ASC separator ',') AS `product_brand_ids`,group_concat(distinct `brand`.`BrandName` order by `brand`.`BrandName` ASC separator ',') AS `product_brand_names`,group_concat(distinct `p`.`ProductCategoryID` order by `p`.`ProductCategoryID` ASC separator ',') AS `product_category_ids`,group_concat(distinct `cat`.`CategoryName` order by `cat`.`CategoryName` ASC separator ',') AS `product_category_names` from (((`salesitems` `si` left join `products` `p` on((`p`.`ProductID` = `si`.`ProductID`))) left join `productbrands` `brand` on((`brand`.`ProductBrandID` = `p`.`ProductBrandID`))) left join `productcategories` `cat` on((`cat`.`ProductCategoryID` = `p`.`ProductCategoryID`))) group by `si`.`SaleID`) `product_dim` on((`product_dim`.`SaleID` = `s`.`SaleID`))) left join `customers` `c` on((`c`.`CustomerID` = `s`.`CustomerID`))) left join `customergroups` `cg` on((`cg`.`CustomerGroupID` = `c`.`CustomerGroupID`))) left join `employees` `e` on((`e`.`EmployeeID` = `s`.`EmployeeID`))) left join `currencies` `curr` on((`curr`.`CurrencyID` = `s`.`CurrencyID`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-19  1:18:55
