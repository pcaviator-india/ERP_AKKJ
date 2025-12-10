const { pool } = require("../db");

async function ensureTaxSchema() {
  // TaxRates table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS TaxRates (
      TaxRateID INT AUTO_INCREMENT PRIMARY KEY,
      CompanyID INT NOT NULL,
      Name VARCHAR(100) NOT NULL,
      RatePercentage DECIMAL(8,3) NOT NULL DEFAULT 0,
      AppliesTo ENUM('goods','services','all') NOT NULL DEFAULT 'all',
      IsDefault TINYINT(1) NOT NULL DEFAULT 0,
      EffectiveFrom DATETIME NULL,
      EffectiveTo DATETIME NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_taxrates_company_name (CompanyID, Name),
      KEY idx_taxrates_company_default (CompanyID, IsDefault),
      KEY idx_taxrates_company_active (CompanyID, IsActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Allow linking tax rates to products and sales items for history
  await pool.query(
    `ALTER TABLE Products ADD COLUMN IF NOT EXISTS TaxRateID INT NULL DEFAULT NULL`
  );
  await pool.query(
    `ALTER TABLE SalesItems ADD COLUMN IF NOT EXISTS TaxRateID INT NULL DEFAULT NULL`
  );
}

module.exports = { ensureTaxSchema };
