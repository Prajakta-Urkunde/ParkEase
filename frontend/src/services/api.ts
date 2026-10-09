const API_URL = "http://127.0.0.1:8000";

export type PaymentMethod = "upi" | "card" | "cash";

type CheckoutReservation = {
  id: number;
  user_id: number;
  parking_lot_id: number;
  parking_slot_id: number;
  status: string;
  reserved_at: string;
};

type CheckoutPayment = {
  id: number;
  reservation_id: number;
  user_id: number;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: string;
  transaction_id: string;
  created_at: string;
  failure_reason: string | null;
};

export type CheckoutResponse = {
  reservation: CheckoutReservation;
  payment: CheckoutPayment;
  parking_fee: string;
  outstanding_cancellation_fines: CancellationFineRecord[];
  total_amount: string;
};

export type CancellationFineRecord = {
  id: number;
  cancellation_reservation_id: number;
  amount: string;
  status: "PENDING" | "PAID";
  payment_method: PaymentMethod | null;
  created_at: string;
  paid_at: string | null;
};

export type CheckoutQuote = {
  parking_fee: string;
  parking_duration_minutes: number;
  outstanding_cancellation_fines: CancellationFineRecord[];
  total_amount: string;
};

export type OwnerVerificationDocument = {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string | null;
};

export type OwnerVerificationStatus = {
  status:
    | "NOT_SUBMITTED"
    | "PENDING"
    | "UNDER_REVIEW"
    | "NEEDS_MORE_INFORMATION"
    | "VERIFIED"
    | "REJECTED";
  property_name: string | null;
  property_address: string | null;
  latitude: number | null;
  longitude: number | null;
  property_relationship: "OWNER" | "TENANT" | "AUTHORIZED_OPERATOR" | null;
  property_identifier: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  documents: OwnerVerificationDocument[];
};

export type AdminVerificationStatus = OwnerVerificationStatus["status"];

export type AdminVerificationApplication = OwnerVerificationStatus & {
  id: number;
  owner_id: number;
  owner_name: string | null;
  owner_email: string | null;
};

export type VerificationReviewDecision =
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "NEEDS_MORE_INFORMATION"
  | "REJECTED";

export type OwnerVerificationSubmission = {
  property_name: string;
  property_address: string;
  property_relationship: "OWNER" | "TENANT" | "AUTHORIZED_OPERATOR";
  property_identifier?: string;
  latitude: number;
  longitude: number;
  files: File[];
};

function describeError(err: unknown, fallback: string): Error {
  if (err instanceof DOMException && err.name === "AbortError") {
    return err;
  }

  if (err instanceof TypeError) {
    return new Error(
      "Cannot reach the server. Please make sure the backend is running on port 8000."
    );
  }

  return err instanceof Error ? err : new Error(fallback);
}

async function parseErrorDetail(
  response: Response,
  fallback: string
): Promise<Error> {
  try {
    const result = await response.json();

    // FastAPI validation errors (422) come as an array
    if (Array.isArray(result.detail)) {
      const first = result.detail[0];
      const field = first.loc?.[first.loc.length - 1] ?? "input";
      return new Error(`${String(field)}: ${first.msg}`);
    }

    if (typeof result.detail === "string") {
      return new Error(result.detail);
    }

    return new Error(fallback);
  } catch {
    return new Error(fallback);
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
  fallback: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (err) {
    throw describeError(err, fallback);
  }

  if (!response.ok) {
    throw await parseErrorDetail(response, fallback);
  }

  return response.json();
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Please log in to continue.");
  }

  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  return request("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }, "Registration failed");
}

  export async function getOwnerVerification() {
    return request<OwnerVerificationStatus>("/owner/verification", {
      method: "GET",
      headers: authHeaders(),
    }, "Failed to load property verification status");
  }

  export async function submitOwnerVerification(
    data: OwnerVerificationSubmission
  ) {
    const formData = new FormData();
    formData.append("property_name", data.property_name);
    formData.append("property_address", data.property_address);
    formData.append("property_relationship", data.property_relationship);
    if (data.property_identifier) {
      formData.append("property_identifier", data.property_identifier);
    }
    if (data.latitude !== undefined) {
      formData.append("latitude", String(data.latitude));
    }
    if (data.longitude !== undefined) {
      formData.append("longitude", String(data.longitude));
    }
    data.files.forEach((file) => formData.append("files", file));

    return request<OwnerVerificationStatus>("/owner/verification", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    }, "Property verification submission failed");
  }

  export async function getAdminVerifications(
    status: AdminVerificationStatus | "ALL" = "ALL"
  ) {
    const query = new URLSearchParams({ status });
    return request<AdminVerificationApplication[]>(
      `/admin/owner-verifications?${query.toString()}`,
      {
        method: "GET",
        headers: authHeaders(),
      },
      "Failed to load verification applications"
    );
  }

  export async function getAdminVerification(applicationId: number) {
    return request<AdminVerificationApplication>(
      `/admin/owner-verifications/${applicationId}`,
      {
        method: "GET",
        headers: authHeaders(),
      },
      "Failed to load verification application"
    );
  }

  export async function reviewAdminVerification(
    applicationId: number,
    status: VerificationReviewDecision,
    reviewNotes?: string
  ) {
    return request<OwnerVerificationStatus>(
      `/admin/owner-verifications/${applicationId}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          status,
          review_notes: reviewNotes,
        }),
      },
      "Unable to save verification decision"
    );
  }

  export async function getAdminVerificationDocument(documentId: number) {
    let response: Response;
    try {
      response = await fetch(
        `${API_URL}/admin/owner-verification-documents/${documentId}`,
        { method: "GET", headers: authHeaders() }
      );
    } catch (error) {
      throw describeError(error, "Unable to retrieve verification document");
    }

    if (!response.ok) {
      throw await parseErrorDetail(response, "Unable to retrieve verification document");
    }

    const responseContentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!responseContentType || !allowedTypes.includes(responseContentType)) {
      throw new Error("The server returned an unsupported document type.");
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("The server returned an empty document.");
    }
    if (blob.type && blob.type.toLowerCase() !== responseContentType) {
      throw new Error("The server returned an unsupported document type.");
    }
    return blob.type ? blob : blob.slice(0, blob.size, responseContentType);
  }

  export async function loginUser(email: string, password: string) {
  const formData = new URLSearchParams();

  formData.append("username", email);
  formData.append("password", password);

  return request("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  }, "Login failed");
}

export async function getCurrentUser(signal?: AbortSignal) {
  return request("/auth/me", {
    method: "GET",
    headers: authHeaders(),
    signal,
  }, "Failed to get current user");
}

export async function getAvailableParkingLots() {
  return request("/parking/lots/available", {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load parking lots");
}

export async function getParkingLotSlots(lotId: number) {
  return request(`/parking/lots/${lotId}/slots`, {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load parking slots");
}

export async function createReservation(
  parkingLotId: number,
  parkingSlotId: number,
  vehicleType = "2_wheeler"
) {
  return request("/parking/reservations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      parking_lot_id: parkingLotId,
      parking_slot_id: parkingSlotId,
      vehicle_type: vehicleType,
    }),
  }, "Reservation failed");
}

export async function startParking(reservationId: number) {
  return request(`/parking/reservations/${reservationId}/start`, {
    method: "PATCH",
    headers: authHeaders(),
  }, "Failed to start parking");
}

export async function checkoutReservation(
  parkingLotId: number,
  parkingSlotId: number,
  paymentMethod: PaymentMethod,
  vehicleType = "2_wheeler",
  parkingDurationMinutes = 60
): Promise<CheckoutResponse> {
  return request<CheckoutResponse>("/parking/reservations/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      parking_lot_id: parkingLotId,
      parking_slot_id: parkingSlotId,
      payment_method: paymentMethod,
      vehicle_type: vehicleType,
      parking_duration_minutes: parkingDurationMinutes,
    }),
  }, "Checkout failed");
}

export async function getCheckoutQuote(
  parkingDurationMinutes = 60
): Promise<CheckoutQuote> {
  const query = new URLSearchParams({
    parking_duration_minutes: String(parkingDurationMinutes),
  });
  return request<CheckoutQuote>(
    `/parking/reservations/checkout-quote?${query.toString()}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
    "Failed to calculate checkout total"
  );
}

export async function getCancellationFines(): Promise<CancellationFineRecord[]> {
  return request<CancellationFineRecord[]>(
    "/parking/reservations/cancellation-fines",
    {
      method: "GET",
      headers: authHeaders(),
    },
    "Failed to load cancellation fines"
  );
}

export async function getUserReservations() {
  return request("/parking/reservations", {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load reservations");
}

export async function cancelReservation(
  reservationId: number,
  paymentMethod: PaymentMethod = "upi"
) {
  return request(`/parking/reservations/${reservationId}/cancel`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      payment_method: paymentMethod,
    }),
  }, "Failed to cancel reservation");
}

export async function completeReservation(reservationId: number) {
  return request(`/parking/reservations/${reservationId}/complete`, {
    method: "PATCH",
    headers: authHeaders(),
  }, "Failed to complete reservation");
}

export async function createParkingLot(data: {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  total_slots: number;
}) {
  return request("/parking/lots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  }, "Failed to create parking lot");
}

export async function getOwnerParkingLots() {
  return request("/parking/lots", {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load parking lots");
}

export async function createParkingSlot(
  slotNumber: string,
  parkingLotId: number,
  vehicleType = "2_wheeler"
) {
  return request("/parking/slots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      slot_number: slotNumber,
      parking_lot_id: parkingLotId,
      vehicle_type: vehicleType,
    }),
  }, "Failed to create parking slot");
}

export async function getOwnerParkingLotSlots(lotId: number) {
  return request(`/parking/lots/${lotId}/owner-slots`, {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load parking slots");
}

export async function getParkingLotSummary(lotId: number) {
  return request(`/parking/lots/${lotId}/summary`, {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load parking summary");
}

export async function getOwnerReservations() {
  return request("/parking/owner/reservations", {
    method: "GET",
    headers: authHeaders(),
  }, "Failed to load owner reservations");
}

export async function confirmOwnerCashPayment(reservationId: number) {
  return request(`/parking/owner/reservations/${reservationId}/confirm-cash-payment`, {
    method: "PATCH",
    headers: authHeaders(),
  }, "Failed to confirm cash receipt");
}
