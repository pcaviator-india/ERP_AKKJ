const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function loginApi(payload) {
  await delay(500);
  if (!payload.Email || !payload.Password) {
    throw new Error("Email and password are required");
  }
  return {
    token: "mock-jwt-token",
    user: {
      email: payload.Email,
      companyId: 1,
      role: "CompanyAdmin",
    },
  };
}

export async function registerAccount(payload) {
  await delay(700);
  if (!payload.CompanyName || !payload.AdminEmail || !payload.Password) {
    throw new Error("Missing required fields");
  }
  return {
    companyId: Math.floor(Math.random() * 1000),
    message: "Account registered",
  };
}

export async function updateCompanyProfile(payload) {
  await delay(600);
  return {
    message: "Company profile saved",
    profile: payload,
  };
}

export async function createEmployee(payload) {
  await delay(400);
  if (!payload.firstName || !payload.email) {
    throw new Error("Employee needs a name and email");
  }
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    ...payload,
  };
}
